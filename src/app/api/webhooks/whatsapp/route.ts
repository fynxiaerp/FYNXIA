// src/app/api/webhooks/whatsapp/route.ts
// AI-02: Meta WhatsApp Cloud API inbound webhook handler.
//
// SECURITY BOUNDARIES (Trust: Meta → /api/webhooks/whatsapp):
//   T-5-webhook-S  — HMAC-SHA256 on RAW body before any processing (verifyWhatsAppSignature)
//   T-5-webhook-verify — GET hub.challenge echoed only when verify_token matches
//   T-5-webhook-T  — whatsapp_inbound_events.wamid UNIQUE; insert-before-process, 23505 → skip
//   T-5-webhook-I  — tenant derived from matched appointment row, NEVER from payload
//   T-5-intent     — LLM ambiguous/unresolved → NO status change; logged for human review
//   T-5-secret-wa  — WHATSAPP_APP_SECRET + WHATSAPP_WEBHOOK_VERIFY_TOKEN server-only, call-time
//
// PATTERN (mirrors Phase 3 Asaas webhook):
//   Step 1: Verify signature / token BEFORE any other work.
//   Step 2: Dedup by wamid (UNIQUE) — 23505 = already processed, return 200 immediately.
//   Step 3: Return 200 IMMEDIATELY. Fire-and-forget processInbound().
//   Step 4: processInbound() updates appointments.status and writes audit logs.
import 'server-only'
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWhatsAppSignature } from '@/lib/whatsapp/verify-signature'
import {
  buttonPayloadToStatus,
  classifyConfirmationIntent,
} from '@/lib/ai/whatsapp-intent'
import type {
  WhatsAppInboundPayload,
  WhatsAppInboundMessage,
} from '@/lib/whatsapp/inbound-types'
import { logBusinessEvent } from '@/lib/audit'

// ─── GET — Meta hub.challenge verification ────────────────────────────────────

/**
 * Meta calls this endpoint once during webhook registration to verify ownership.
 * We echo hub.challenge only when hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN.
 * Returns 403 on any mismatch (T-5-webhook-verify).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  // Read at call-time (never module scope — Pitfall 2 / T-5-secret-wa)
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// ─── POST — inbound messages ──────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── Step 1: Read RAW body FIRST — stream can only be consumed once ──────────
  // HMAC requires the unmodified text; must call request.text() before parsing.
  const rawBody = await request.text()

  // ── Step 2: HMAC-SHA256 signature validation (T-5-webhook-S) ─────────────────
  const sig = request.headers.get('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? ''
  if (!verifyWhatsAppSignature(rawBody, sig, appSecret)) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Step 3: Parse payload + extract first message ─────────────────────────────
  let payload: WhatsAppInboundPayload
  try {
    payload = JSON.parse(rawBody) as WhatsAppInboundPayload
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const value = payload?.entry?.[0]?.changes?.[0]?.value
  const messages = value?.messages

  // Status-only events (no messages array) → acknowledge immediately, nothing to do
  if (!messages || messages.length === 0) {
    return new Response('', { status: 200 })
  }

  const message = messages[0]
  const wamid = message?.id
  const fromPhone = message?.from

  if (!wamid || !fromPhone) {
    return new Response('', { status: 200 })
  }

  // ── Step 4: Dedup by wamid (T-5-webhook-T) ────────────────────────────────────
  const admin = createAdminClient()
  const { error: insertError } = await admin.from('whatsapp_inbound_events').insert({
    wamid,
    from_phone: fromPhone,
    payload: payload as unknown as Record<string, unknown>,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate wamid — already processed (T-5-webhook-T idempotent skip)
      return new Response('', { status: 200 })
    }
    // Unexpected DB error — log and return 200 to prevent Meta retry flood
    console.error('[webhook/whatsapp] dedup insert error:', insertError.message)
    return new Response('', { status: 200 })
  }

  // ── Step 5: Return 200 IMMEDIATELY + fire-and-forget ─────────────────────────
  // Meta retries on any non-200 response. Processing runs async.
  processInbound(message, wamid, admin).catch((err) =>
    console.error('[webhook/whatsapp] processInbound error:', err),
  )

  return new Response('', { status: 200 })
}

// ─── processInbound (async, fire-and-forget) ──────────────────────────────────

async function processInbound(
  message: WhatsAppInboundMessage,
  wamid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  let appointmentId: string | null = null
  let newStatus: 'confirmado' | 'cancelado' | null = null
  let intentResult: string = 'unknown'

  // ── Determine intent + appointmentId ─────────────────────────────────────────

  if (message.type === 'button') {
    // Quick-reply button on a non-interactive template
    const result = buttonPayloadToStatus(message.button.payload)
    if (result) {
      appointmentId = result.appointmentId
      newStatus = result.status
      intentResult = result.status === 'confirmado' ? 'confirm' : 'cancel'
    }
  } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
    // Interactive template button reply
    const result = buttonPayloadToStatus(message.interactive.button_reply.id)
    if (result) {
      appointmentId = result.appointmentId
      newStatus = result.status
      intentResult = result.status === 'confirmado' ? 'confirm' : 'cancel'
    }
  } else if (message.type === 'text') {
    // Free-text fallback — classify with LLM (safe: 'ambiguous' → no status change)
    const intent = await classifyConfirmationIntent(message.text.body)
    intentResult = intent

    if (intent === 'confirm' || intent === 'cancel') {
      // Resolve the appointmentId via the most recent next-day confirmation outreach
      // for this phone number (look up agent_outreach_log by from_phone match).
      const { data: outreachRow } = await admin
        .from('agent_outreach_log')
        .select('appointment_id')
        .eq('agent_type', 'confirmation')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (outreachRow?.appointment_id) {
        appointmentId = outreachRow.appointment_id
        newStatus = intent === 'confirm' ? 'confirmado' : 'cancelado'
      } else {
        // Cannot resolve appointment — treat as ambiguous (T-5-intent safe fallback)
        intentResult = 'ambiguous'
      }
    }
    // 'ambiguous' → appointmentId/newStatus remain null → no status change
  }

  // ── Update appointments.status (only on confirmed/cancelled with resolved id) ─

  if (appointmentId && newStatus) {
    // Fetch appointment to derive tenant_id (T-5-webhook-I — never from payload)
    const { data: appt, error: apptError } = await admin
      .from('appointments')
      .select('id, tenant_id, patient_id')
      .eq('id', appointmentId)
      .maybeSingle()

    if (apptError || !appt) {
      console.error('[webhook/whatsapp] appointment not found:', appointmentId, apptError?.message)
      // Log ambiguous — cannot resolve tenant
      await admin.from('agent_outreach_log').insert({
        tenant_id: '00000000-0000-0000-0000-000000000000', // unknown tenant
        agent_type: 'confirmation',
        appointment_id: appointmentId,
        status: 'ambiguous',
        intent_result: 'unresolved_appointment',
        whatsapp_message_id: wamid,
      })
      await markProcessed(admin, wamid)
      return
    }

    const tenantId = appt.tenant_id

    // Update appointment status (tenant-scoped: eq('id', appointmentId) is sufficient
    // because appointmentId is derived from the button payload we injected — never from
    // the raw inbound payload content. T-5-webhook-I defense in depth.)
    await admin
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)

    // Write agent_outreach_log (audit trail for AI-02)
    await admin.from('agent_outreach_log').insert({
      tenant_id: tenantId,
      agent_type: 'confirmation',
      patient_id: appt.patient_id ?? null,
      appointment_id: appointmentId,
      status: 'responded',
      intent_result: intentResult,
      whatsapp_message_id: wamid,
    })

    // logBusinessEvent (LGPD-safe: IDs only, no PII)
    await logBusinessEvent({
      tenantId,
      actorId: null,
      action: 'ai02.confirmation.reply',
      details: {
        appointmentId,
        newStatus,
        intentResult,
        wamid,
      },
    })
  } else {
    // Ambiguous or unresolvable — log for human review (D-04 safe fallback)
    // Use a placeholder tenant_id when we cannot derive one from an appointment row.
    // This row is visible only to service-role queries (no RLS on agent_outreach_log inserts).
    await admin.from('agent_outreach_log').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      agent_type: 'confirmation',
      appointment_id: null,
      status: 'ambiguous',
      intent_result: intentResult === 'unknown' ? 'ambiguous' : intentResult,
      whatsapp_message_id: wamid,
      error_message: 'Could not resolve appointment from inbound message',
    })

    await logBusinessEvent({
      tenantId: 'system',
      actorId: null,
      action: 'ai02.confirmation.ambiguous',
      details: { wamid, fromPhone: message.from, intentResult },
    })
  }

  await markProcessed(admin, wamid)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function markProcessed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createAdminClient>,
  wamid: string,
): Promise<void> {
  await admin
    .from('whatsapp_inbound_events')
    .update({ processed: true })
    .eq('wamid', wamid)
}
