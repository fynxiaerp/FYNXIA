// src/lib/crc/segment.ts
// CRC-03 (D-07/D-08/A2): consent-gated "inativo há X dias" segment builder.
//
// DESIGN:
//   - "Inativo há X dias": patients whose most recent appointment.start_time is
//     older than now() - inactiveDays. Patients with NO appointment ever count
//     as inactive (D-07).
//   - Query-time unit resolution (Pitfall 3): `patients` has no unit_id column.
//     The optional `unitId` filter is resolved via the patient's LAST appointment
//     (appointments.unit_id — added in Phase 7's operational_unit_id migration).
//   - CONSENT GATE (mandatory, D-08/A2 — T-18-15): only patients with a
//     patient_consents row consent_type='marketing_whatsapp' AND revoked_at IS
//     NULL are ever included. marketing_whatsapp is the umbrella marketing
//     consent for BOTH WhatsApp and e-mail channels in v1 (Assumption A2) — this
//     gate must NEVER be omitted; sending to a non-consented patient is an LGPD
//     violation.
//   - LGPD-explicit predicates on patients (deleted_at IS NULL, is_anonymized =
//     false) — mirrors collection-agent.ts's admin-client query discipline
//     (admin client bypasses RLS, so explicit predicates are required here).
import 'server-only'

import { differenceInDays, differenceInYears } from 'date-fns'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { CampaignSegmentInput } from '@/lib/validators/crc'

type AdminClient = ReturnType<typeof createAdminClient>

export type SegmentRecipient = {
  patientId: string
  firstName: string
  phone: string | null
  email: string | null
}

type PatientRow = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  date_of_birth: string | null
}

type AppointmentRow = {
  id: string
  patient_id: string
  start_time: string
  unit_id: string
}

type ProcedureRow = {
  appointment_id: string
  service_id: string
}

/**
 * buildInactiveSegmentQuery — resolves the consent-gated "inativo há X dias"
 * segment for a campaign (D-07/D-08). Read-only; no writes.
 *
 * Steps:
 *  1. CONSENT GATE (mandatory) — only patients with a non-revoked
 *     marketing_whatsapp consent row (A2 umbrella).
 *  2. LGPD-scoped patients (tenant_id, deleted_at IS NULL, is_anonymized=false).
 *  3. Optional age filter (ageMin/ageMax) from patients.date_of_birth.
 *  4. Last appointment per patient — drives "inativo há X dias" AND the
 *     query-time unit resolution (Pitfall 3) AND the optional lastProcedure
 *     filter.
 *  5. Optional unitId filter — matched against the LAST appointment's unit_id.
 *     Patients with no appointment can never match a unitId filter.
 *  6. Optional lastProcedureServiceId filter — matched against
 *     appointment_procedures for the LAST appointment.
 */
export async function buildInactiveSegmentQuery(
  admin: AdminClient,
  clinicId: string,
  filters: CampaignSegmentInput
): Promise<SegmentRecipient[]> {
  const now = new Date()

  // 1. CONSENT GATE (T-18-15 — never omit): marketing_whatsapp, revoked_at IS NULL
  const { data: consentRows, error: consentError } = await admin
    .from('patient_consents')
    .select('patient_id')
    .eq('tenant_id', clinicId)
    .eq('consent_type', 'marketing_whatsapp')
    .is('revoked_at', null)

  if (consentError) {
    console.error('[segment] Failed to load patient_consents:', consentError.message)
    return []
  }

  const consentedIds = Array.from(
    new Set(((consentRows ?? []) as Array<{ patient_id: string }>).map((r) => r.patient_id))
  )
  if (consentedIds.length === 0) return []

  // 2. LGPD-scoped patients (admin client bypasses RLS — explicit predicates required)
  const { data: patients, error: patientsError } = await admin
    .from('patients')
    .select('id, full_name, phone, email, date_of_birth')
    .eq('tenant_id', clinicId)
    .is('deleted_at', null)
    .eq('is_anonymized', false)
    .in('id', consentedIds)

  if (patientsError || !patients) {
    console.error('[segment] Failed to load patients:', patientsError?.message)
    return []
  }

  // 3. Optional age filter (D-07)
  const ageFiltered = (patients as PatientRow[]).filter((p) => {
    if (filters.ageMin === undefined && filters.ageMax === undefined) return true
    if (!p.date_of_birth) return false
    const age = differenceInYears(now, new Date(p.date_of_birth))
    if (filters.ageMin !== undefined && age < filters.ageMin) return false
    if (filters.ageMax !== undefined && age > filters.ageMax) return false
    return true
  })

  if (ageFiltered.length === 0) return []
  const patientIds = ageFiltered.map((p) => p.id)

  // 4. Last appointment per patient (query-time unit resolution — Pitfall 3;
  //    patients has no unit_id column). Also drives "inativo há X dias".
  const { data: appointments, error: apptError } = await admin
    .from('appointments')
    .select('id, patient_id, start_time, unit_id')
    .eq('tenant_id', clinicId)
    .in('patient_id', patientIds)
    .order('start_time', { ascending: false })

  if (apptError) {
    console.error('[segment] Failed to load appointments:', apptError.message)
    return []
  }

  const lastApptByPatient = new Map<string, AppointmentRow>()
  for (const appt of (appointments ?? []) as AppointmentRow[]) {
    if (!lastApptByPatient.has(appt.patient_id)) {
      lastApptByPatient.set(appt.patient_id, appt)
    }
  }

  // 5. Optional last-procedure filter (via appointment_procedures on the LAST appointment)
  let lastApptServiceMap: Map<string, Set<string>> | null = null
  if (filters.lastProcedureServiceId) {
    const lastApptIds = Array.from(lastApptByPatient.values()).map((a) => a.id)
    lastApptServiceMap = new Map()
    if (lastApptIds.length > 0) {
      const { data: procedures } = await admin
        .from('appointment_procedures')
        .select('appointment_id, service_id')
        .in('appointment_id', lastApptIds)

      for (const proc of (procedures ?? []) as ProcedureRow[]) {
        const set = lastApptServiceMap.get(proc.appointment_id) ?? new Set<string>()
        set.add(proc.service_id)
        lastApptServiceMap.set(proc.appointment_id, set)
      }
    }
  }

  // 6. Assemble the final segment
  const recipients: SegmentRecipient[] = []
  for (const patient of ageFiltered) {
    const lastAppt = lastApptByPatient.get(patient.id)

    // "Inativo há X dias" (D-07): no appointment ever = inactive; else compare
    // days since the last appointment's start_time.
    const daysSinceLast = lastAppt
      ? differenceInDays(now, new Date(lastAppt.start_time))
      : Number.POSITIVE_INFINITY
    if (daysSinceLast < filters.inactiveDays) continue

    // Optional unit filter — query-time via last appointment.unit_id (Pitfall 3)
    if (filters.unitId) {
      if (!lastAppt || lastAppt.unit_id !== filters.unitId) continue
    }

    // Optional last-procedure filter
    if (filters.lastProcedureServiceId) {
      if (!lastAppt) continue
      const services = lastApptServiceMap?.get(lastAppt.id)
      if (!services || !services.has(filters.lastProcedureServiceId)) continue
    }

    recipients.push({
      patientId: patient.id,
      firstName: patient.full_name.split(' ')[0] ?? patient.full_name,
      phone: patient.phone,
      email: patient.email,
    })
  }

  return recipients
}

/**
 * previewSegment — read-only UI preview: total count + first 3 sample rows.
 * No writes. Used both by the campaign preview screen (Plan 09) and by
 * requestCampaignPersonalization (Plan 05) to pick a sample first name.
 */
export async function previewSegment(
  admin: AdminClient,
  clinicId: string,
  filters: CampaignSegmentInput
): Promise<{ count: number; sample: SegmentRecipient[] }> {
  const recipients = await buildInactiveSegmentQuery(admin, clinicId, filters)
  return { count: recipients.length, sample: recipients.slice(0, 3) }
}
