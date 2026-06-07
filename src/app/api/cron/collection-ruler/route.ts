/**
 * GET /api/cron/collection-ruler
 *
 * Vercel Cron endpoint — runs daily at 08:00 UTC (D-09).
 * Scans all tenants with active collection rules, finds due/overdue receivables,
 * and sends idempotent Resend email reminders per (receivable_id + milestone).
 *
 * SECURITY:
 * - T-3-cron-E: Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch (Pitfall 6).
 *   Vercel injects CRON_SECRET automatically when invoking the cron; manual callers must supply it.
 * - T-3-cron-I: Processes each tenant's receivables separately via their collection_rules row.
 *   Cross-tenant data never mixed in a single query.
 *
 * IDEMPOTENCY (T-3-cron-T / D-10):
 * - Each send is gated by INSERT INTO collection_log with UNIQUE(receivable_id, milestone, channel).
 * - ON CONFLICT (23505) → skip — the reminder was already sent for this milestone.
 * - This guarantees no duplicate emails even if the cron fires twice (Vercel at-least-once).
 *
 * RUNTIME: Node.js (not Edge) — required for server-only imports (resend, admin client).
 */

// CRITICAL: Node.js runtime required (Pitfall 7 — Edge has no 'net' module)
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { selectReminders } from '@/lib/collection/ruler'
import { getOutboxQueue } from '@/lib/messaging/queue'
import { drainOutbox } from '@/lib/messaging/worker'
import { gateway } from '@/lib/asaas/gateway'
import { toE164 } from '@/lib/phone'
import {
  TEMPLATE_COLLECTION,
  WHATSAPP_LANGUAGE,
  buildCollectionComponents,
} from '@/lib/whatsapp/templates'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function GET(request: Request) {
  // ── CRON_SECRET validation (T-3-cron-E, Pitfall 6, CR-01) ───────────────────
  // Vercel injects Authorization: Bearer {CRON_SECRET} when invoking the cron.
  // isCronAuthorized fails CLOSED (rejects when CRON_SECRET is unset) and uses a
  // constant-time compare — see src/lib/cron-auth.ts. Without this, any public
  // caller (or a "Bearer undefined" probe on a misconfigured deploy) could
  // trigger mass email sends. Returns 401 on mismatch before any DB query.
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  let totalProcessed = 0
  let totalSkipped = 0

  try {
    // ── Load all active collection rules (Open Question 2 — skip disabled clinics) ──
    // Only query tenants that have at least one reminder enabled.
    const { data: rules, error: rulesError } = await admin
      .from('collection_rules')
      .select('id, tenant_id, due_date_reminder_enabled, overdue_reminder_enabled, overdue_interval_days')
      .or('due_date_reminder_enabled.eq.true,overdue_reminder_enabled.eq.true')

    if (rulesError) {
      console.error('[cron/collection-ruler] Failed to load rules:', rulesError.message)
      return Response.json({ error: 'Failed to load collection rules' }, { status: 500 })
    }

    if (!rules || rules.length === 0) {
      return Response.json({ processed: 0, message: 'No active collection rules' })
    }

    // ── Process each tenant separately (T-3-cron-I — no cross-tenant mixing) ──
    for (const rule of rules) {
      try {
        // Load unpaid receivables for this tenant with patient contact info.
        // WR-06 (LGPD): exclude soft-deleted / anonymized patients — a patient who
        // exercised deletion/opt-out must NOT receive automated billing messages.
        // createAdminClient() bypasses RLS, so the soft-delete predicate is explicit.
        const { data: receivables, error: receivablesError } = await admin
          .from('receivables')
          .select(`
            id,
            due_date,
            status,
            value,
            charge_id,
            provider_charge_id,
            charges!inner(description, billing_type),
            patients!inner(id, full_name, email, phone, deleted_at, is_anonymized)
          `)
          .eq('tenant_id', rule.tenant_id)
          .in('status', ['pendente'])
          .is('patients.deleted_at', null)
          .eq('patients.is_anonymized', false)

        if (receivablesError || !receivables) {
          console.error(
            `[cron/collection-ruler] Failed to load receivables for tenant ${rule.tenant_id}:`,
            receivablesError?.message
          )
          continue
        }

        // Determine which milestones are due today using the pure ruler engine
        const targets = selectReminders(
          {
            due_date_reminder_enabled: rule.due_date_reminder_enabled,
            overdue_reminder_enabled: rule.overdue_reminder_enabled,
            overdue_interval_days: rule.overdue_interval_days,
          },
          receivables.map((r) => ({
            id: r.id,
            due_date: r.due_date,
            status: r.status,
          })),
          today
        )

        if (targets.length === 0) continue

        // WR-05: resolve the real clinic name once per tenant for the email greeting.
        // Without this, patients would receive emails showing the raw tenant UUID.
        const { data: clinic } = await admin
          .from('clinics')
          .select('name')
          .eq('id', rule.tenant_id)
          .single()
        const clinicName = clinic?.name ?? 'Sua clínica'

        // ── For each target milestone: check idempotency, then send ─────────────
        for (const target of targets) {
          const receivable = receivables.find((r) => r.id === target.receivableId)
          if (!receivable) continue

          const patient = receivable.patients as unknown as { id: string; full_name: string; email: string | null; phone: string | null }
          const charge = receivable.charges as unknown as { description: string | null; billing_type: string }

          const e164Phone = toE164(patient?.phone)

          // Skip if patient has no email AND no usable phone — nothing to send
          if (!patient?.email && !e164Phone) {
            totalSkipped++
            continue
          }

          const isOverdue = target.milestone !== 'due_date'
          const dueDateFormatted = format(parseISO(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })
          const queue = getOutboxQueue(admin)

          // WR-01: resolve the VERIFIED Asaas payment link live (GET /payments/{id} →
          // invoiceUrl). We no longer guess the `asaas.com/i/{id}` pattern. Resolved once
          // per target and shared across channels; null if Asaas has no hosted page.
          const providerChargeId = (receivable as { provider_charge_id?: string | null }).provider_charge_id
          const paymentLink = providerChargeId
            ? await gateway.getInvoiceUrl(providerChargeId)
            : null

          // ── Email channel: route through the outbox (WR-02 — durable retry) ──────
          // Previously the email was sent INLINE after inserting collection_log, so a
          // transient Resend failure permanently lost the reminder (the log row blocked
          // the retry). Now the email is enqueued; the outbox worker retries on failure.
          // Dedup: message_outbox idempotency_key UNIQUE — duplicate enqueue is a no-op.
          if (patient?.email) {
            const emailSubject = isOverdue
              ? `Cobrança em atraso — ${charge.description ?? 'FYNXIA ERP'}`
              : `Lembrete de vencimento hoje — ${charge.description ?? 'FYNXIA ERP'}`

            const emailResult = await queue.enqueue({
              tenantId: rule.tenant_id,
              channel: 'email',
              idempotencyKey: `collection:${target.receivableId}:${target.milestone}:email`,
              payload: {
                kind: 'collection_reminder',
                to: patient.email,
                subject: emailSubject,
                props: {
                  patientName: patient.full_name,
                  clinicName, // WR-05: real clinic name, not the tenant UUID
                  chargeDescription: charge.description ?? 'Cobrança odontológica',
                  amount: receivable.value,
                  dueDate: dueDateFormatted,
                  isOverdue,
                },
              },
            })

            if (!emailResult.success) {
              console.error(
                `[cron/collection-ruler] Failed to enqueue collection email for receivable ${target.receivableId}:`,
                emailResult.error
              )
            } else {
              // Idempotency/metrics gate. Insert AFTER a successful enqueue so a failed
              // enqueue does not block a future retry (23505 = already enqueued/logged).
              await admin
                .from('collection_log')
                .insert({
                  tenant_id: rule.tenant_id,
                  receivable_id: target.receivableId,
                  milestone: target.milestone,
                  channel: 'email',
                })
              totalProcessed++
            }
          }

          // ── WhatsApp channel D-05: enqueue via outbox (independent of email) ──
          // Dedup: message_outbox idempotency_key UNIQUE `collection:{receivableId}:{milestone}:whatsapp`.
          // This is independent of collection_log (email dedup) — Pitfall 8 compliance.
          // Guard: toE164 returns null if phone is absent or non-normalizable → skip silently.
          // WR-01: only send WhatsApp when we have a VERIFIED payment link — never ship a
          // guessed/generic URL on a billing message.
          if (e164Phone && paymentLink) {
            await queue.enqueue({
              tenantId: rule.tenant_id,
              channel: 'whatsapp',
              idempotencyKey: `collection:${target.receivableId}:${target.milestone}:whatsapp`,
              payload: {
                kind: 'whatsapp_template',
                to: e164Phone,
                templateName: TEMPLATE_COLLECTION,
                languageCode: WHATSAPP_LANGUAGE,
                components: buildCollectionComponents({
                  patientName: patient.full_name,
                  description: charge.description ?? 'cobrança odontológica',
                  amount: `R$ ${Number(receivable.value).toFixed(2).replace('.', ',')}`,
                  dueDate: dueDateFormatted,
                  paymentLink,
                }),
              },
            })
          } else if (e164Phone && !paymentLink) {
            // No verified payment link — skip the WhatsApp collection send rather than
            // shipping a dead/guessed link on the highest-stakes (money) message (WR-01).
            console.warn(
              `[cron/collection-ruler] Skipping WhatsApp collection for receivable ${target.receivableId}: no verified Asaas invoiceUrl`
            )
            totalSkipped++
          }
        }
      } catch (tenantError) {
        console.error(
          `[cron/collection-ruler] Error processing tenant ${rule.tenant_id}:`,
          tenantError
        )
        // Continue with next tenant — one failure should not block others
      }
    }

    // ── Drain the outbox after all tenants processed (D-05 WhatsApp sends same-day) ──
    // drainOutbox selects ONLY status='pending' rows — status-idempotent.
    // Already-sent rows from the reminder-dispatch cron are never re-selected here.
    // Pending collection WhatsApp rows enqueued above are picked up and sent.
    const drain = await drainOutbox(admin)

    return Response.json({
      processed: totalProcessed,
      skipped: totalSkipped,
      whatsapp_drained: drain.processed,
      whatsapp_failed: drain.failed,
      date: today.toISOString(),
    })
  } catch (error) {
    console.error('[cron/collection-ruler] Fatal error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
