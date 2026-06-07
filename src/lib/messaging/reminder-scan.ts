/**
 * reminder-scan.ts — Pure appointment reminder selection logic (COMMS-01, COMMS-02)
 *
 * PURE function — no server-only imports, no DB client, no I/O.
 * Fully importable in Vitest node environment.
 *
 * Responsibility: Given a list of appointment records (already fetched by the cron),
 * return ReminderTarget[] for the OutboxQueue to enqueue.
 *
 * NOTE: The cron (Plan 04 — reminder-dispatch/route.ts) is responsible for:
 *   1. Supplying the date window (tomorrow 00:00–next-day 00:00 in America/Sao_Paulo)
 *   2. Fetching appointments + joined patient data from Supabase (createAdminClient)
 *   3. Applying E.164 normalization (toE164) to patient.phone before enqueue
 *   4. Calling OutboxQueue.enqueue() per target
 *
 * This function is window-agnostic and channel-independent so each channel
 * (whatsapp/email) fails/succeeds on its own — Pitfall 8 compliance.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ScanAppointment {
  id: string
  start_time: string
  status: string
  patient: {
    phone: string | null
    email: string | null
  }
}

export interface ReminderTarget {
  appointmentId: string
  channel: 'whatsapp' | 'email'
  type: '24h'
  idempotencyKey: string
}

// ─── Core function ──────────────────────────────────────────────────────────────

/**
 * selectReminderTargets — pure function, no side effects.
 *
 * For each non-cancelled appointment, emits independent targets per available channel:
 *   - A whatsapp target IF patient.phone is present (non-null, non-empty)
 *   - An email target IF patient.email is present (non-null, non-empty)
 *
 * Each channel target is independent: missing phone drops whatsapp only;
 * missing email drops email only. Both channels can fire for the same appointment
 * when both contact details are available.
 *
 * Dedup: idempotencyKey = `reminder:${appointmentId}:${channel}:24h`
 * This key maps to the UNIQUE idempotency_key in message_outbox — re-running the
 * cron produces a 23505 conflict on enqueue → silently skipped (idempotent).
 *
 * Also maps to the UNIQUE (appointment_id, channel, type) in message_log for
 * reminder dedup tracking.
 *
 * @param appointments - List of appointment records to scan (caller scopes to
 *   tomorrow's window; this function re-checks status for safety)
 * @returns Flat array of ReminderTarget — one entry per (appointment × channel)
 */
export function selectReminderTargets(appointments: ScanAppointment[]): ReminderTarget[] {
  const targets: ReminderTarget[] = []

  for (const appt of appointments) {
    // Skip cancelled appointments — value is 'cancelado' per Phase 2 schema
    // (appointments.status CHECK constraint: 'agendado','confirmado','em_atendimento','concluido','cancelado')
    if (appt.status === 'cancelado') {
      continue
    }

    // WhatsApp channel — only if patient has a phone number
    // (Cron applies E.164 normalization before passing to sendTemplateMessage)
    if (appt.patient.phone) {
      const channel = 'whatsapp' as const
      targets.push({
        appointmentId: appt.id,
        channel,
        type: '24h',
        idempotencyKey: `reminder:${appt.id}:${channel}:24h`,
      })
    }

    // Email channel — only if patient has an email address
    if (appt.patient.email) {
      const channel = 'email' as const
      targets.push({
        appointmentId: appt.id,
        channel,
        type: '24h',
        idempotencyKey: `reminder:${appt.id}:${channel}:24h`,
      })
    }
  }

  return targets
}
