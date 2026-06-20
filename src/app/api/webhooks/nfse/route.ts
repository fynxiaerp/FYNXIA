// src/app/api/webhooks/nfse/route.ts
// OS-02: Fiscal provider async webhook → nfse_records status advance + Hub log
//
// SECURITY:
//   T-15-20: x-fiscal-webhook-secret verified against FISCAL_WEBHOOK_SECRET; 401 on mismatch
//   T-15-22: forward-only CAS — status only moves forward (Pitfall 8)
//            nfse_autorizada: 'processando' → 'emitida' (CAS guard: .eq('status','processando'))
//            nfse_cancelada:  any → 'cancelada'
//            nfse_erro:       'processando' → 'erro' (CAS guard: .eq('status','processando'))
//   T-09-09: logToHub fire-and-forget with .catch() — hub log failure never blocks 200
//
// ENV:
//   FISCAL_WEBHOOK_SECRET — shared secret from fiscal provider (Focus NFe or other)
//                           Set in Vercel environment variables; never commit a value.
//
// Runtime: Node.js (NOT Edge — requires Supabase TCP + admin client; CLAUDE.md constraint)

export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { logToHub } from '@/lib/integrations/hub-log'

// ─── Webhook event types (Focus NFe — RESEARCH §"NFS-e Aggregator API Shape" lines 734-738) ──

type FiscalWebhookEvent = {
  event: 'nfse_autorizada' | 'nfse_cancelada' | 'nfse_erro'
  ref?: string          // provider_ref / idempotency_key
  numero?: string       // assigned NFS-e number (on autorizada)
  serie?: string
  numero_rps?: string   // RPS number (may be present)
  cnpj_prestador?: string
  data_emissao?: string
  error_message?: string
  // Fallback identification
  service_order_id?: string
}

export async function POST(request: Request): Promise<Response> {
  // Step 1: Validate fiscal provider secret header BEFORE parsing body (T-15-20)
  const secret = request.headers.get('x-fiscal-webhook-secret')
  if (!secret || secret !== process.env.FISCAL_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Step 2: Parse payload
  let event: FiscalWebhookEvent
  try {
    event = (await request.json()) as FiscalWebhookEvent
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const admin = createAdminClient()

  // Step 3: Resolve nfse_records row by provider_ref (or service_order_id as fallback)
  let nfseId: string | null = null
  let clinicId: string | null = null

  if (event.ref) {
    const { data } = await admin
      .from('nfse_records')
      .select('id, clinic_id, status')
      .eq('provider_ref', event.ref)
      .maybeSingle()
    if (data) {
      nfseId = data.id
      clinicId = data.clinic_id as string | null
    }
  }

  if (!nfseId && event.service_order_id) {
    const { data } = await admin
      .from('nfse_records')
      .select('id, clinic_id, status')
      .eq('service_order_id', event.service_order_id)
      .neq('status', 'cancelada')
      .maybeSingle()
    if (data) {
      nfseId = data.id
      clinicId = data.clinic_id as string | null
    }
  }

  if (!nfseId) {
    // Unknown ref — log and return 200 so provider does not retry-flood
    console.error('[webhook/nfse] nfse_records row not found for ref:', event.ref, 'service_order_id:', event.service_order_id)
    logToHub({
      admin,
      connectorType: 'nfse',
      direction: 'inbound',
      clinicId: null,
      externalEventId: event.ref,
      eventType: event.event,
      status: 'failed',
      lastError: 'nfse_records row not found',
    }).catch((err) => console.error('[webhook/nfse] hub log error:', err))
    return new Response('', { status: 200 })
  }

  // Step 4: Advance nfse_records status — FORWARD ONLY (T-15-22, Pitfall 8)
  const now = new Date().toISOString()

  if (event.event === 'nfse_autorizada') {
    // CAS guard: only advance from 'processando' (never move backward)
    await admin
      .from('nfse_records')
      .update({
        status: 'emitida',
        numero: event.numero ?? null,
        serie: event.serie ?? null,
        emitida_at: now,
        updated_at: now,
      })
      .eq('id', nfseId)
      .eq('status', 'processando') // CAS forward-only guard (Pitfall 8)

  } else if (event.event === 'nfse_cancelada') {
    // Can move from any non-cancelada status (provider cancelled it externally)
    await admin
      .from('nfse_records')
      .update({
        status: 'cancelada',
        cancelada_at: now,
        updated_at: now,
      })
      .eq('id', nfseId)
      .neq('status', 'cancelada') // idempotency guard

  } else if (event.event === 'nfse_erro') {
    // CAS guard: only set erro from 'processando' (do not regress emitida → erro)
    await admin
      .from('nfse_records')
      .update({
        status: 'erro',
        error_message: event.error_message ?? 'Erro retornado pelo provedor fiscal',
        updated_at: now,
      })
      .eq('id', nfseId)
      .eq('status', 'processando') // CAS forward-only guard (Pitfall 8)
  }

  // Step 5: Log to Hub — fire-and-forget AFTER DB update (T-09-09)
  // .catch() ensures hub log failure NEVER blocks the 200 response
  logToHub({
    admin,
    connectorType: 'nfse',
    direction: 'inbound',
    clinicId,
    externalEventId: event.ref,
    eventType: event.event,
    status: 'received',
  }).catch((err) => console.error('[webhook/nfse] hub log error:', err))

  // Step 6: Return 200 always (except auth 401) so provider does not retry-flood
  return new Response('', { status: 200 })
}
