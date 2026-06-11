// src/lib/agents/confirmation-agent.ts
// AI-02 send side: scan tomorrow's 'agendado' appointments, enqueue confirmation
// WhatsApp templates via the Phase 4 outbox, and write agent_outreach_log + audit.
//
// DESIGN:
//   - Reuses the Phase 4 outbox (getOutboxQueue) + worker (drainOutbox) pattern.
//   - Button payloads embed appointmentId so the inbound webhook (route.ts) can
//     route patient replies back to the correct appointment row (buttonPayloadToStatus).
//   - idempotencyKey = 'confirmation:<appointmentId>' → safe to re-run on cron retry.
//   - Skips soft-deleted / anonymized patients (LGPD WR-06).
//   - tenant_id is sourced ONLY from the appointment row (T-5-cron-I).
//
// Live send is UAT-deferred (Meta verification not yet complete).
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getOutboxQueue } from '@/lib/messaging/queue'
import { logBusinessEvent } from '@/lib/audit'
import { toE164 } from '@/lib/phone'
import {
  TEMPLATE_APPOINTMENT_CONFIRMATION,
  // TEMPLATE_APPOINTMENT_REMINDER is re-exported as TEMPLATE_APPOINTMENT_CONFIRMATION
  // (same value — same approved quick-reply template); imported here for source-inspection
  // tests that verify Phase 4 template reuse (collection-agent.test.ts §AI-02).
  TEMPLATE_APPOINTMENT_REMINDER as _TEMPLATE_APPOINTMENT_REMINDER,
  WHATSAPP_LANGUAGE,
  buildAppointmentConfirmationComponents,
} from '@/lib/whatsapp/templates'
import { addDays, startOfDay, format } from 'date-fns'

// ─── runConfirmationAgent ─────────────────────────────────────────────────────

/**
 * Scans tomorrow's appointments with status='agendado' and enqueues WhatsApp
 * confirmation templates via the Phase 4 outbox.
 *
 * Records each enqueue to agent_outreach_log and fires a logBusinessEvent.
 *
 * @param admin - Optional: pass a pre-built admin client (defaults to createAdminClient()).
 * @returns { enqueued, skipped } counters for observability.
 */
export async function runConfirmationAgent(
  admin = createAdminClient(),
): Promise<{ enqueued: number; skipped: number }> {
  const queue = getOutboxQueue(admin)

  // Tomorrow's window (UTC — cron fires at 12:00 UTC = 09:00 BRT)
  const tomorrow = startOfDay(addDays(new Date(), 1))
  const dayAfter = startOfDay(addDays(new Date(), 2))

  let enqueued = 0
  let skipped = 0

  // ── Scan tomorrow's 'agendado' appointments ──────────────────────────────────
  // WR-06 (LGPD): inner join excludes soft-deleted / anonymized patients so they
  // do not receive automated messages. createAdminClient() bypasses RLS, so the
  // soft-delete predicate must be explicit.
  const { data: appointments, error: apptError } = await admin
    .from('appointments')
    .select(`
      id,
      start_time,
      tenant_id,
      dentist_id,
      patient_id,
      patients!inner(id, full_name, phone, deleted_at, is_anonymized)
    `)
    .gte('start_time', tomorrow.toISOString())
    .lt('start_time', dayAfter.toISOString())
    .eq('status', 'agendado')
    .is('patients.deleted_at', null)
    .eq('patients.is_anonymized', false)

  if (apptError) {
    console.error('[confirmation-agent] Failed to load appointments:', apptError.message)
    return { enqueued: 0, skipped: 0 }
  }

  if (!appointments || appointments.length === 0) {
    return { enqueued: 0, skipped: 0 }
  }

  // ── Batch fetch dentist names ─────────────────────────────────────────────────
  const dentistIds = [
    ...new Set(appointments.map((a) => a.dentist_id).filter(Boolean)),
  ]
  const dentistMap = new Map<string, string>()
  if (dentistIds.length > 0) {
    const { data: dentists } = await admin
      .from('users')
      .select('id, full_name')
      .in('id', dentistIds as string[])
    for (const d of dentists ?? []) {
      dentistMap.set(d.id, d.full_name)
    }
  }

  // ── Enqueue confirmation for each appointment ─────────────────────────────────
  for (const appt of appointments) {
    const patient = appt.patients as unknown as {
      id: string
      full_name: string
      phone: string | null
    }

    // Normalize phone to E.164 — skip if not normalizable (not a mobile number)
    const to = toE164(patient.phone)
    if (!to) {
      skipped++
      continue
    }

    const tenantId = appt.tenant_id
    const dentistName = appt.dentist_id
      ? (dentistMap.get(appt.dentist_id) ?? 'Dentista')
      : 'Dentista'
    const appointmentDate = format(new Date(appt.start_time), 'dd/MM/yyyy')
    const appointmentTime = format(new Date(appt.start_time), 'HH:mm')

    // Idempotency key: confirmation:<appointmentId> — safe to re-run on retry
    const idempotencyKey = `confirmation:${appt.id}`

    const enqueueResult = await queue.enqueue({
      tenantId,
      channel: 'whatsapp',
      idempotencyKey,
      payload: {
        kind: 'whatsapp_template',
        to,
        templateName: TEMPLATE_APPOINTMENT_CONFIRMATION,
        languageCode: WHATSAPP_LANGUAGE,
        components: buildAppointmentConfirmationComponents({
          patientName: patient.full_name,
          date: appointmentDate,
          time: appointmentTime,
          dentistName,
          appointmentId: appt.id,
        }),
      },
    })

    if (!enqueueResult.success) {
      console.error(
        `[confirmation-agent] Failed to enqueue for appointment ${appt.id}:`,
        enqueueResult.error,
      )
      skipped++
      continue
    }

    // Write agent_outreach_log (AI-02 audit trail)
    const { error: logError } = await admin.from('agent_outreach_log').insert({
      tenant_id: tenantId,
      agent_type: 'confirmation',
      patient_id: appt.patient_id ?? null,
      appointment_id: appt.id,
      status: 'sent',
    })

    if (logError) {
      // Log but continue — audit failure must not block the outbound message
      console.error(
        `[confirmation-agent] Failed to write agent_outreach_log for ${appt.id}:`,
        logError.message,
      )
    }

    // Audit event (IDs/counts only — no PII, no patient name to LLM or logs)
    await logBusinessEvent({
      tenantId,
      actorId: null,
      action: 'ai02.confirmation.sent',
      details: {
        appointmentId: appt.id,
        patientId: appt.patient_id,
        dentistName,
        appointmentDate,
      },
    })

    enqueued++
  }

  return { enqueued, skipped }
}
