// src/lib/crc/nps-scan.ts
// Self-healing NPS invite scan (CRC-04, D-12/D-13) — nightly cron scans concluded
// appointments and enqueues one NPS invite (WhatsApp + email) per appointment that
// doesn't yet have an nps_responses row.
//
// SELF-HEALING (18-RESEARCH.md Pitfall 5): dedup is per-appointment via the plain
// UNIQUE(appointment_id) constraint on nps_responses — NOT a date-window/expression
// index (the Phase 17 42P17 trap). A 23505 conflict below means "already invited";
// this is enforced atomically by Postgres, so a missed night (or an overlapping
// cron run) is simply caught by the next invocation with no risk of double-invite.
// No AT TIME ZONE anywhere in this file.
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getOutboxQueue } from '@/lib/messaging/queue'
import { logBusinessEvent } from '@/lib/audit'
import { toE164 } from '@/lib/phone'
import {
  TEMPLATE_NPS_INVITE,
  WHATSAPP_LANGUAGE,
  buildNpsInviteComponents,
} from '@/lib/whatsapp/templates'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Token TTL for the public NPS survey link (D-13). */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type PatientRel = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

/**
 * CRC-04 nightly NPS invite scan main entry point.
 *
 * Scans every appointment with status='concluido' (self-healing — no date window)
 * across all tenants (admin client — service role), and for each one that does not
 * yet have an nps_responses row, creates a single-use-token invite row and enqueues
 * a WhatsApp template + email via the Phase 4 outbox (D-12/D-13).
 *
 * Security / correctness invariants:
 *   - LGPD: only patients with deleted_at IS NULL + is_anonymized=false (WR-06,
 *     mirrors collection-agent's explicit predicates since RLS is bypassed here).
 *   - Dedup: UNIQUE(appointment_id) on nps_responses — a 23505 insert conflict
 *     means "already invited" and is treated as an idempotent skip (Pitfall 5).
 *   - Idempotency of the outbox leg: idempotencyKey `nps-invite:{appointmentId}:{channel}`
 *     (T-18-23 — UNIQUE(idempotency_key) backstop prevents duplicate sends).
 *   - Audit: logBusinessEvent 'crc.nps.invited' per successful invite (IDs only).
 *
 * @param admin - Admin Supabase client (defaults to createAdminClient()).
 * @returns { invited, skipped } counters for observability.
 */
export async function runNpsInviteScan(
  admin = createAdminClient(),
): Promise<{ invited: number; skipped: number }> {
  let invited = 0
  let skipped = 0

  // ── Query concluded appointments + patient join ───────────────────────────
  // Self-healing (Pitfall 5): no date window — every 'concluido' appointment is
  // re-scanned; already-invited ones are caught by the UNIQUE constraint below,
  // not filtered out here (avoids an app-level NOT EXISTS pre-check race).
  // WR-06 (LGPD): explicit soft-delete/anonymize predicates — admin client
  // bypasses RLS, so these must be applied here.
  const { data: appointments, error: fetchError } = await admin
    .from('appointments')
    .select(
      `
      id,
      tenant_id,
      unit_id,
      patient_id,
      patients!inner(id, full_name, phone, email, deleted_at, is_anonymized)
    `,
    )
    .eq('status', 'concluido')
    .is('patients.deleted_at', null)
    .eq('patients.is_anonymized', false)

  if (fetchError) {
    console.error('[nps-scan] Failed to fetch concluded appointments:', fetchError.message)
    return { invited: 0, skipped: 0 }
  }

  if (!appointments || appointments.length === 0) {
    return { invited: 0, skipped: 0 }
  }

  const queue = getOutboxQueue(admin)

  for (const appt of appointments) {
    const patient = appt.patients as unknown as PatientRel

    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

    // ── Create the invite row (token defaults to gen_random_uuid()) ──────────
    // On 23505 (UNIQUE appointment_id violation) → already invited, skip.
    const { data: inserted, error: insertError } = await admin
      .from('nps_responses')
      .insert({
        clinic_id: appt.tenant_id,
        unit_id: appt.unit_id,
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        token_expires_at: tokenExpiresAt,
      })
      .select('token')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        // Already invited (self-healing dedup guard — Pitfall 5).
        skipped++
        continue
      }
      console.error(
        `[nps-scan] Failed to insert nps_responses for appointment ${appt.id}:`,
        insertError.message,
      )
      skipped++
      continue
    }

    if (!inserted) {
      skipped++
      continue
    }

    const npsLink = `${SITE_URL}/nps/${appt.patient_id}/${inserted.token}`
    const firstName = patient.full_name.split(' ')[0] ?? patient.full_name

    let sentAny = false

    // WhatsApp channel — only if patient has a normalizable phone number.
    const e164 = toE164(patient.phone)
    if (e164) {
      const result = await queue.enqueue({
        tenantId: appt.tenant_id,
        channel: 'whatsapp',
        idempotencyKey: `nps-invite:${appt.id}:whatsapp`,
        payload: {
          kind: 'whatsapp_template',
          to: e164,
          templateName: TEMPLATE_NPS_INVITE,
          languageCode: WHATSAPP_LANGUAGE,
          components: buildNpsInviteComponents({ patientName: firstName, npsLink }),
        },
      })
      if (result.success) sentAny = true
    }

    // Email channel — only if patient has an email address.
    if (patient.email) {
      const result = await queue.enqueue({
        tenantId: appt.tenant_id,
        channel: 'email',
        idempotencyKey: `nps-invite:${appt.id}:email`,
        payload: {
          kind: 'nps_invite',
          to: patient.email,
          subject: 'Como foi seu atendimento?',
          html: `<p>Olá, ${firstName}! Gostaríamos de saber como foi seu atendimento. Avalie em: <a href="${npsLink}">${npsLink}</a></p>`,
        },
      })
      if (result.success) sentAny = true
    }

    if (sentAny) {
      invited++
      // Audit: IDs only, no PHI beyond first name resolution above (T-4-worker-phi convention).
      await logBusinessEvent({
        tenantId: appt.tenant_id,
        actorId: null,
        action: 'crc.nps.invited',
        details: { appointment_id: appt.id, patient_id: appt.patient_id },
      })
    } else {
      // No usable channel (no phone, no email) — invite row exists but nothing enqueued.
      skipped++
    }
  }

  return { invited, skipped }
}
