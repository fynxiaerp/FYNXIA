// src/app/api/webhooks/asaas/route.ts
// FIN-09: Idempotent Asaas webhook handler
// D-07: HTTP 200 immediately, validate asaas-access-token, dedup by asaas_event_id
// T-3-webhook-S: Spoofing mitigation — validate token BEFORE any processing
// T-3-webhook-T: Tampering mitigation — UNIQUE webhook_events.asaas_event_id + pre-insert check
// T-3-webhook-I: derive tenant from matched charge, never from payload

export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import type { AsaasWebhookEvent } from '@/lib/asaas/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logToHub } from '@/lib/integrations/hub-log'

export async function POST(request: Request): Promise<Response> {
  // Step 1: Validate asaas-access-token BEFORE parsing body (T-3-webhook-S)
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Step 2: Parse payload
  let event: AsaasWebhookEvent
  try {
    event = (await request.json()) as AsaasWebhookEvent
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Step 3: Dedup via webhook_events table (UNIQUE on asaas_event_id)
  // ignoreDuplicates: true → if row already exists, upsert is a no-op and returns null
  const admin = createAdminClient()
  const { data: upserted, error: upsertError } = await admin
    .from('webhook_events')
    .upsert(
      {
        asaas_event_id: event.id,
        event_type: event.event,
        payload: event as unknown as Record<string, unknown>,
        processed: false,
      },
      { onConflict: 'asaas_event_id', ignoreDuplicates: true }
    )
    .select('id, processed')
    .maybeSingle()

  // ignoreDuplicates: true makes upsert return null data (not an error) on conflict
  if (upsertError) {
    // Log but still return 200 — Asaas retries on non-200, which would cause more duplicates
    console.error('[webhook] upsert error:', upsertError.message)
    return new Response('', { status: 200 })
  }

  if (!upserted) {
    // Duplicate event — already processed or processing; return 200 immediately (idempotent)
    return new Response('', { status: 200 })
  }

  // Step 4: Fire-and-forget — do NOT await; return 200 immediately (D-07)
  // Safe in Vercel Fluid Compute for < 10s processing operations (A-02)
  processWebhookEvent(event, admin, upserted.id).catch((err) =>
    console.error('[webhook] processing error', err)
  )

  // INT-02: Log inbound event to hub (additive, fire-and-forget — T-09-09).
  // clinicId = null: not yet resolved at this point (system-level inbound log).
  // payloadRef = upserted.id: opaque reference to the webhook_events row (not the payload body).
  logToHub({
    admin, connectorType: 'asaas', direction: 'inbound',
    clinicId: null, externalEventId: event.id,
    payloadRef: upserted.id, eventType: event.event, status: 'received',
  }).catch((err) => console.error('[webhook/asaas] hub log error:', err))

  return new Response('', { status: 200 })
}

// ─── processWebhookEvent ──────────────────────────────────────────────────────
// Runs asynchronously after the 200 response is sent.
// Only handles PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_REFUNDED.
// PAYMENT_OVERDUE: no-op (vencido derived at read time — D-04).

async function processWebhookEvent(
  event: AsaasWebhookEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  webhookEventRowId: string
): Promise<void> {
  const { event: eventType, payment } = event

  if (
    eventType !== 'PAYMENT_RECEIVED' &&
    eventType !== 'PAYMENT_CONFIRMED' &&
    eventType !== 'PAYMENT_REFUNDED'
  ) {
    // Mark processed — no action needed for other events
    await admin
      .from('webhook_events')
      .update({ processed: true })
      .eq('id', webhookEventRowId)
    return
  }

  // Find the local receivable by provider_charge_id (T-3-webhook-I: derive from local data)
  const { data: receivable, error: receivableError } = await admin
    .from('receivables')
    .select('id, charge_id, tenant_id, patient_id, value, status')
    .eq('provider_charge_id', payment.id)
    .maybeSingle()

  if (receivableError || !receivable) {
    // Log and mark as processed — unknown charge IDs are not retried
    console.error('[webhook] receivable not found for provider_charge_id:', payment.id)
    await admin
      .from('webhook_events')
      .update({ processed: true })
      .eq('id', webhookEventRowId)
    return
  }

  if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
    // Only process if not already pago (defense in depth)
    if (receivable.status === 'pago') {
      await admin
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', webhookEventRowId)
      return
    }

    // Update receivable status → pago
    await admin
      .from('receivables')
      .update({
        status: 'pago',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', receivable.id)

    // Defense in depth: check for existing income row before inserting (Pitfall 2)
    const { data: existingTx } = await admin
      .from('financial_transactions')
      .select('id')
      .eq('receivable_id', receivable.id)
      .eq('type', 'receita')
      .maybeSingle()

    if (!existingTx) {
      // CR-02: post the TRUSTED local receivable value, never the untrusted payload value.
      // The token only authenticates the caller — it does not guarantee per-field integrity.
      if (payment.value != null && payment.value !== receivable.value) {
        console.error(
          '[webhook] reconciliation discrepancy: payload value',
          payment.value,
          'does not match local receivable value',
          receivable.value,
          'for receivable',
          receivable.id
        )
      }

      // Auto-post income row (D-08: regime de caixa)
      await admin.from('financial_transactions').insert({
        tenant_id: receivable.tenant_id,
        receivable_id: receivable.id,
        type: 'receita',
        amount: receivable.value, // trusted local amount (CR-02)
        transaction_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        description: `Pagamento confirmado via Asaas (${event.event})`,
        posted_by: null, // auto-posted by webhook
      })
    }

    // Check if all parcels of the parent charge are pago → update charges.status
    const { data: allReceivables } = await admin
      .from('receivables')
      .select('id, status')
      .eq('charge_id', receivable.charge_id)

    if (allReceivables && allReceivables.every((r) => r.status === 'pago' || r.id === receivable.id)) {
      await admin
        .from('charges')
        .update({ status: 'pago', updated_at: new Date().toISOString() })
        .eq('id', receivable.charge_id)
    }
  } else if (eventType === 'PAYMENT_REFUNDED') {
    // WR-02: idempotency guard — Asaas can send multiple distinct refund-related events
    // for the same receivable (refund + chargeback/partial). Without this guard each one
    // would post another negative row and over-reverse the cash flow.
    if (receivable.status === 'estornado') {
      await admin
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', webhookEventRowId)
      return
    }

    const { data: existingReversal } = await admin
      .from('financial_transactions')
      .select('id')
      .eq('receivable_id', receivable.id)
      .lt('amount', 0)
      .maybeSingle()

    if (existingReversal) {
      await admin
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', webhookEventRowId)
      return
    }

    // Mark receivable as estornado
    await admin
      .from('receivables')
      .update({ status: 'estornado', updated_at: new Date().toISOString() })
      .eq('id', receivable.id)

    // Insert negative income row (reversal) — CR-02: reverse the trusted local amount.
    await admin.from('financial_transactions').insert({
      tenant_id: receivable.tenant_id,
      receivable_id: receivable.id,
      type: 'receita',
      amount: -Math.abs(receivable.value),
      transaction_date: new Date().toISOString().split('T')[0],
      description: `Estorno via Asaas (${event.event})`,
      posted_by: null,
    })
  }

  // Mark webhook event as processed
  await admin
    .from('webhook_events')
    .update({ processed: true })
    .eq('id', webhookEventRowId)
}
