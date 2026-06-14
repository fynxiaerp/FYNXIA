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
import { toE164 } from '@/lib/phone'
import { logToHub } from '@/lib/integrations/hub-log'

// Recency window for matching a free-text reply to a recent confirmation outreach.
// Outside this window an inbound free-text reply will NOT be auto-resolved (CR-01).
const INBOUND_MATCH_WINDOW_MS = 48 * 60 * 60 * 1000 // 48h

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
  processInbound(message, wamid, fromPhone, admin).catch((err) =>
    console.error('[webhook/whatsapp] processInbound error:', err),
  )

  // INT-02: Log inbound event to hub (additive, fire-and-forget — T-09-09).
  // clinicId = null: tenant not yet resolved at this point (system-level inbound log).
  logToHub({
    admin, connectorType: 'whatsapp', direction: 'inbound',
    clinicId: null, externalEventId: wamid,
    eventType: message?.type, status: 'received',
  }).catch((err) => console.error('[webhook/whatsapp] hub log error:', err))

  return new Response('', { status: 200 })
}

// ─── processInbound (async, fire-and-forget) ──────────────────────────────────

async function processInbound(
  message: WhatsAppInboundMessage,
  wamid: string,
  fromPhone: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  let appointmentId: string | null = null
  let newStatus: 'confirmado' | 'cancelado' | null = null
  let intentResult: string = 'unknown'
  // The matched 'sent' outreach row, when the appointmentId came from a free-text
  // reply resolution. Used to transition that row 'sent' → 'responded' (WR-03) and to
  // source the tenant_id (CR-02) instead of trusting a derived/placeholder value.
  let matchedOutreach: { id: string; tenant_id: string } | null = null

  // The sender's phone, normalized to E.164 — used to bind the free-text resolution
  // and to verify ownership of the resolved appointment (CR-01 / CR-02).
  const senderE164 = toE164(fromPhone)

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

    if ((intent === 'confirm' || intent === 'cancel') && senderE164) {
      // CR-01: Resolve the appointment ONLY among confirmation outreach rows actually
      // SENT TO THIS SENDER (to_phone), still 'sent', and within the recency window.
      // No phone binding → no resolution → no status change (safe fallback).
      const windowStart = new Date(Date.now() - INBOUND_MATCH_WINDOW_MS).toISOString()
      const { data: outreachRow } = await admin
        .from('agent_outreach_log')
        .select('id, appointment_id, tenant_id')
        .eq('agent_type', 'confirmation')
        .eq('status', 'sent')
        .eq('to_phone', senderE164)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (outreachRow?.appointment_id) {
        appointmentId = outreachRow.appointment_id
        newStatus = intent === 'confirm' ? 'confirmado' : 'cancelado'
        matchedOutreach = { id: outreachRow.id, tenant_id: outreachRow.tenant_id }
      } else {
        // Cannot resolve appointment for this sender — treat as ambiguous (T-5-intent).
        intentResult = 'ambiguous'
      }
    } else if (intent === 'confirm' || intent === 'cancel') {
      // Sender phone not normalizable to E.164 → cannot safely bind → no status change.
      intentResult = 'ambiguous'
    }
    // 'ambiguous' → appointmentId/newStatus remain null → no status change
  }

  // ── Update appointments.status (only on confirmed/cancelled with resolved id) ─

  if (appointmentId && newStatus) {
    // Fetch appointment to derive tenant_id (T-5-webhook-I — never from payload) and the
    // patient phone for identity verification (CR-02).
    const { data: appt, error: apptError } = await admin
      .from('appointments')
      .select('id, tenant_id, patient_id, patients!inner(phone)')
      .eq('id', appointmentId)
      .maybeSingle()

    // CR-02: For a free-text-resolved appointment, the resolved appointment MUST belong
    // to the sender — verify the appointment's patient phone equals the sender's phone.
    // (The button/interactive path embeds the appointmentId we injected, so identity is
    // implicit there; we still verify when senderE164 is available.)
    const apptPatient = appt?.patients as unknown as { phone: string | null } | null
    const ownershipOk =
      !!appt &&
      (matchedOutreach === null
        ? // Button/interactive path: verify when we can, otherwise trust the injected id.
          senderE164 === null || toE164(apptPatient?.phone ?? null) === senderE164
        : // Free-text path: ownership is mandatory.
          toE164(apptPatient?.phone ?? null) === senderE164)

    if (apptError || !appt || !ownershipOk) {
      console.error(
        '[webhook/whatsapp] appointment unresolved or sender mismatch:',
        appointmentId,
        apptError?.message,
      )

      // WR-02: Do NOT insert an audit row with a fake tenant_id (would violate the
      // clinics FK and be silently dropped). When we have a real tenant from the
      // matched outreach row, log against it; otherwise log to the server console only.
      if (matchedOutreach) {
        const { error: logError } = await admin.from('agent_outreach_log').insert({
          tenant_id: matchedOutreach.tenant_id,
          agent_type: 'confirmation',
          appointment_id: appointmentId,
          status: 'ambiguous',
          intent_result: 'unresolved_or_sender_mismatch',
          whatsapp_message_id: wamid,
        })
        if (logError) {
          console.error('[webhook/whatsapp] ambiguous audit insert failed:', logError.message)
        }
      } else {
        console.warn(
          '[webhook/whatsapp] unresolved inbound (no tenant); logged to console only:',
          { wamid, appointmentId },
        )
      }

      await markProcessed(admin, wamid)
      return
    }

    // CR-02: source tenant_id from the matched outreach row when available; otherwise
    // from the appointment row (button path). Never from the payload.
    const tenantId = matchedOutreach?.tenant_id ?? appt.tenant_id

    // Update appointment status, scoped by id AND tenant_id (CR-02 defense-in-depth).
    await admin
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)

    // WR-03: transition the matched 'sent' outreach row to 'responded' so it can no
    // longer be re-matched as the newest 'sent' row by an unrelated subsequent reply.
    if (matchedOutreach) {
      const { error: transitionError } = await admin
        .from('agent_outreach_log')
        .update({
          status: 'responded',
          intent_result: intentResult,
          whatsapp_message_id: wamid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchedOutreach.id)
      if (transitionError) {
        console.error(
          '[webhook/whatsapp] outreach status transition failed:',
          transitionError.message,
        )
      }
    } else {
      // Button/interactive path: write a fresh 'responded' audit row (no matched 'sent' row).
      const { error: logError } = await admin.from('agent_outreach_log').insert({
        tenant_id: tenantId,
        agent_type: 'confirmation',
        patient_id: appt.patient_id ?? null,
        appointment_id: appointmentId,
        status: 'responded',
        intent_result: intentResult,
        whatsapp_message_id: wamid,
      })
      if (logError) {
        console.error('[webhook/whatsapp] responded audit insert failed:', logError.message)
      }
    }

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
    // Ambiguous or unresolvable — log for human review (D-04 safe fallback).
    // WR-02: we have no real tenant_id here, so do NOT insert an audit row with a fake
    // tenant_id (FK violation → silent drop). Log to the server console instead, and emit
    // a system-scoped business event (logBusinessEvent does not touch the clinics FK).
    console.warn('[webhook/whatsapp] ambiguous/unresolved inbound (logged for review):', {
      wamid,
      fromPhone,
      intentResult,
    })

    await logBusinessEvent({
      tenantId: 'system',
      actorId: null,
      action: 'ai02.confirmation.ambiguous',
      details: { wamid, fromPhone, intentResult },
    })
  }

  await markProcessed(admin, wamid)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function markProcessed(
  admin: ReturnType<typeof createAdminClient>,
  wamid: string,
): Promise<void> {
  await admin
    .from('whatsapp_inbound_events')
    .update({ processed: true })
    .eq('wamid', wamid)
}
