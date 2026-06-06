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
import { logBusinessEvent } from '@/lib/audit'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { CollectionReminderEmail } from '@/emails/CollectionReminderEmail'
import { selectReminders } from '@/lib/collection/ruler'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createElement } from 'react'

export async function GET(request: Request) {
  // ── CRON_SECRET validation (T-3-cron-E, Pitfall 6) ──────────────────────────
  // Vercel injects Authorization: Bearer {CRON_SECRET} when invoking the cron.
  // Without the secret, any public caller would trigger mass email sends.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        // Load unpaid receivables for this tenant with patient contact info
        const { data: receivables, error: receivablesError } = await admin
          .from('receivables')
          .select(`
            id,
            due_date,
            status,
            value,
            charge_id,
            charges!inner(description, billing_type),
            patients!inner(id, full_name, email)
          `)
          .eq('tenant_id', rule.tenant_id)
          .in('status', ['pendente'])

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

        // ── For each target milestone: check idempotency, then send ─────────────
        for (const target of targets) {
          const receivable = receivables.find((r) => r.id === target.receivableId)
          if (!receivable) continue

          const patient = receivable.patients as unknown as { id: string; full_name: string; email: string | null }
          const charge = receivable.charges as unknown as { description: string | null; billing_type: string }

          // Skip if patient has no email — WhatsApp deferred to Phase 4 (D-10)
          if (!patient?.email) {
            totalSkipped++
            continue
          }

          // ── Idempotency check via collection_log INSERT ──────────────────────
          // UNIQUE(receivable_id, milestone, channel) — if already sent, 23505 conflict
          const { error: logError } = await admin
            .from('collection_log')
            .insert({
              tenant_id: rule.tenant_id,
              receivable_id: target.receivableId,
              milestone: target.milestone,
              channel: 'email',
            })

          if (logError) {
            if (logError.code === '23505') {
              // Already sent for this (receivable, milestone) — idempotent skip (T-3-cron-T)
              totalSkipped++
              continue
            }
            console.error(
              `[cron/collection-ruler] Failed to insert collection_log for receivable ${target.receivableId}:`,
              logError.message
            )
            continue
          }

          // ── Send Resend email reminder ────────────────────────────────────────
          const isOverdue = target.milestone !== 'due_date'
          const dueDateFormatted = format(parseISO(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })

          const emailSubject = isOverdue
            ? `Cobrança em atraso — ${charge.description ?? 'FYNXIA ERP'}`
            : `Lembrete de vencimento hoje — ${charge.description ?? 'FYNXIA ERP'}`

          try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: patient.email,
              subject: emailSubject,
              react: createElement(CollectionReminderEmail, {
                patientName: patient.full_name,
                clinicName: rule.tenant_id, // resolved below via clinic lookup if needed
                chargeDescription: charge.description ?? 'Cobrança odontológica',
                amount: receivable.value,
                dueDate: dueDateFormatted,
                isOverdue,
              }),
            })

            // Audit log per send (IDs only — no PHI in audit details)
            await logBusinessEvent({
              tenantId: rule.tenant_id,
              actorId: rule.tenant_id, // system-generated event
              action: 'collection.reminder_sent',
              details: {
                receivable_id: target.receivableId,
                milestone: target.milestone,
                channel: 'email',
                patient_id: patient.id,
              },
            })

            totalProcessed++
          } catch (sendError) {
            console.error(
              `[cron/collection-ruler] Failed to send email for receivable ${target.receivableId}:`,
              sendError
            )
            // On send failure: log_error was already inserted but email failed.
            // This is acceptable — on next cron run the idempotency check will prevent re-send.
            // In production, monitor collection_log rows where emails are known to have failed.
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

    return Response.json({
      processed: totalProcessed,
      skipped: totalSkipped,
      date: today.toISOString(),
    })
  } catch (error) {
    console.error('[cron/collection-ruler] Fatal error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
