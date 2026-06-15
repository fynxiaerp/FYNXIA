'use server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { isSlotWithinAvailability, type AvailabilityWindow, type AvailabilityException } from '@/lib/scheduling/availability'

// ─── getBookedSlots ───────────────────────────────────────────────────────────
// CLINIC-09: Returns the list of occupied start_time ISO strings for a given
// dentist on a given date, so the public booking form can disable those slots.
//
// Uses service-role client (createAdminClient) — no auth session in public flow.
// Tenant resolved by clinic slug (same pattern as createPublicAppointment).
// Excludes appointments with status='cancelado' (matching the GIST constraint).
// Returns [] on any validation/lookup error — never leaks details to public callers.

const bookedSlotsInputSchema = z.object({
  clinicSlug: z.string().min(1),
  dentistId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function getBookedSlots(
  clinicSlug: string,
  dentistId: string,
  date: string
): Promise<string[]> {
  const parsed = bookedSlotsInputSchema.safeParse({ clinicSlug, dentistId, date })
  if (!parsed.success) return []

  const admin = createAdminClient()

  // Resolve clinic by slug
  const { data: clinic } = await admin
    .from('clinics')
    .select('id')
    .eq('slug', parsed.data.clinicSlug)
    .is('deleted_at', null)
    .single()

  if (!clinic) return []

  // CR-01: verify the dentist belongs to this clinic
  const { data: dentist } = await admin
    .from('users')
    .select('id')
    .eq('id', parsed.data.dentistId)
    .eq('tenant_id', clinic.id)
    .eq('role', 'dentist')
    .is('deleted_at', null)
    .single()

  if (!dentist) return []

  // Query appointments for this dentist on this date (Brazil -03:00, no DST)
  // Range: [date 00:00:00-03:00, date+1 00:00:00-03:00)
  const rangeStart = `${parsed.data.date}T00:00:00-03:00`
  const nextDate = new Date(new Date(`${parsed.data.date}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000)
  const rangeEnd = nextDate.toISOString()

  const { data: appointments } = await admin
    .from('appointments')
    .select('start_time')
    .eq('tenant_id', clinic.id)
    .eq('dentist_id', parsed.data.dentistId)
    .gte('start_time', rangeStart)
    .lt('start_time', rangeEnd)
    .neq('status', 'cancelado')

  return (appointments ?? []).map((a) => a.start_time)
}

// ─── Public Booking Types ─────────────────────────────────────────────────────

export interface PublicBookingInput {
  dentist_id: string
  start_time: string // ISO datetime
  end_time: string // ISO datetime
  // Solicitant contact info (patient_id is null — receptionist links later)
  requester_name: string
  requester_phone: string
  requester_email?: string
}

// ─── Public Booking Zod Schema (CR-01) ────────────────────────────────────────
// This action runs under the service-role client (RLS bypassed), so the
// untrusted public payload MUST be validated strictly before use. Bounds the
// free-text fields (they end up in `notes`) and enforces UUID/ISO-datetime shapes.
const publicBookingSchema = z.object({
  dentist_id: z.string().uuid('Dentista inválido'),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  requester_name: z.string().trim().min(2, 'Nome inválido').max(120),
  requester_phone: z.string().trim().min(8, 'Telefone inválido').max(20),
  requester_email: z.string().trim().email().max(160).optional().or(z.literal('')),
})

// ─── createPublicAppointment ──────────────────────────────────────────────────
// CLINIC-09: Paciente agenda sem login via /agendar/[clinic-slug].
// Uses service-role client (createAdminClient) — no session available.
// Tenant resolved by clinic slug (never by session).
//
// T-2-01: GIST constraint (no_overlap) fires atomically.
// Pitfall 7: captures 23P01 exclusion_violation → friendly message.
// source='publico': appointment flagged so staff knows origin.
// patient_id=null: receptionist links patient after (no CPF placeholder — security).
// Notes contain requester contact info so staff can reach them.

export async function createPublicAppointment(
  clinicSlug: string,
  input: PublicBookingInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!clinicSlug) {
    return { success: false, error: 'Dados incompletos para o agendamento' }
  }

  // CR-01: strict validation of the untrusted public payload (service-role flow).
  const parsed = publicBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Dados incompletos para o agendamento' }
  }
  const data = parsed.data

  // Validate end_time > start_time
  if (new Date(data.end_time) <= new Date(data.start_time)) {
    return { success: false, error: 'Horário de fim deve ser posterior ao horário de início' }
  }

  const admin = createAdminClient()

  // Resolve clinic by slug (tenant is identified by slug — not session)
  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, name')
    .eq('slug', clinicSlug)
    .is('deleted_at', null)
    .single()

  if (clinicError || !clinic) {
    return { success: false, error: 'Clínica não encontrada' }
  }

  // CR-01: verify the dentist exists, has role 'dentist', and belongs to THIS
  // clinic. The appointments.dentist_id FK references users(id) globally (not
  // tenant-scoped), so without this check a caller could inject a foreign
  // dentist_id and mix tenant_id = clinic.id with another tenant's user.
  const { data: dentist } = await admin
    .from('users')
    .select('id')
    .eq('id', data.dentist_id)
    .eq('tenant_id', clinic.id)
    .eq('role', 'dentist')
    .is('deleted_at', null)
    .single()

  if (!dentist) {
    return { success: false, error: 'Dentista inválido para esta clínica' }
  }

  // ── PRO-02: Availability pre-flight guard (public booking path) ─────────────
  // Resolve professional via user_id = dentist_id (no professional_id FK — Phase 11 intentional).
  // Keep returning vague error on any failure — never leak internal details to public callers.
  const { data: professional } = await admin
    .from('professionals')
    .select('id')
    .eq('user_id', data.dentist_id)
    .eq('clinic_id', clinic.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (professional) {
    const { data: grade } = await admin
      .from('professional_availability')
      .select('weekday, start_time, end_time')
      .eq('professional_id', professional.id)

    const slotDate = data.start_time.slice(0, 10)
    const { data: exceptions } = await admin
      .from('professional_availability_exceptions')
      .select('exception_date, exception_type, start_time, end_time')
      .eq('professional_id', professional.id)
      .eq('exception_date', slotDate)

    const within = isSlotWithinAvailability(
      (grade ?? []) as AvailabilityWindow[],
      (exceptions ?? []) as AvailabilityException[],
      { start: data.start_time, end: data.end_time },
    )
    if (!within) {
      return { success: false, error: 'Horário fora da disponibilidade do profissional.' }
    }
  }

  // Build notes with requester contact info (staff links patient later)
  const notesLines = [
    `Solicitante: ${data.requester_name}`,
    `Telefone: ${data.requester_phone}`,
  ]
  if (data.requester_email) {
    notesLines.push(`E-mail: ${data.requester_email}`)
  }
  notesLines.push('[Agendamento público — vincular paciente na recepção]')
  const notes = notesLines.join('\n')

  // Insert appointment — GIST constraint handles slot atomicity (T-2-01)
  const { data: appointment, error: insertError } = await admin
    .from('appointments')
    .insert({
      tenant_id: clinic.id,
      dentist_id: data.dentist_id,
      patient_id: null, // linked by receptionist after
      start_time: data.start_time,
      end_time: data.end_time,
      status: 'agendado',
      source: 'publico',
      notes,
    })
    .select('id')
    .single()

  if (insertError) {
    // 23P01 = exclusion_violation — GIST constraint fired (Pitfall 7 / T-2-01)
    // Race condition: another booking took the slot between selection and confirm
    if (insertError.code === '23P01') {
      return {
        success: false,
        error: 'Este horário acabou de ser reservado. Por favor, escolha outro horário.',
      }
    }
    return { success: false, error: insertError.message }
  }

  // Audit — only IDs; no PII (T-2-08); actorId=null (public/sessionless action).
  // WR-02: audit_logs.actor_id is UUID + nullable for system events. Passing the literal
  // string 'system' triggers Postgres 22P02 (invalid uuid) which logBusinessEvent swallows,
  // so every public booking previously wrote NO audit row (LGPD traceability gap).
  await logBusinessEvent({
    tenantId: clinic.id,
    actorId: null,
    action: 'appointment.public_created',
    details: { appointment_id: appointment!.id, clinic_id: clinic.id },
  })

  return { success: true, id: appointment!.id }
}

// ─── getAvailableSlots ────────────────────────────────────────────────────────
// PRO-02 / Pitfall 5: Returns 30-min slot start_times that fall within the
// professional's availability windows for the given date, so the public form
// only offers slots the professional is actually available for.
//
// Uses admin client — no auth session in public flow.
// Returns [] on any error — never leaks details to public callers.

const availableSlotsInputSchema = z.object({
  clinicSlug: z.string().min(1),
  dentistId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function getAvailableSlots(
  clinicSlug: string,
  dentistId: string,
  date: string
): Promise<string[]> {
  const parsed = availableSlotsInputSchema.safeParse({ clinicSlug, dentistId, date })
  if (!parsed.success) return []

  const admin = createAdminClient()

  // Resolve clinic
  const { data: clinic } = await admin
    .from('clinics')
    .select('id')
    .eq('slug', parsed.data.clinicSlug)
    .is('deleted_at', null)
    .single()
  if (!clinic) return []

  // Verify dentist belongs to this clinic
  const { data: dentist } = await admin
    .from('users')
    .select('id')
    .eq('id', parsed.data.dentistId)
    .eq('tenant_id', clinic.id)
    .eq('role', 'dentist')
    .is('deleted_at', null)
    .single()
  if (!dentist) return []

  // Resolve professional row for availability check (user_id lookup — PRO-02)
  const { data: professional } = await admin
    .from('professionals')
    .select('id')
    .eq('user_id', parsed.data.dentistId)
    .eq('clinic_id', clinic.id)
    .is('deleted_at', null)
    .maybeSingle()

  // If no professional row exists, no availability windows are configured → no slots
  if (!professional) return []

  const { data: grade } = await admin
    .from('professional_availability')
    .select('weekday, start_time, end_time')
    .eq('professional_id', professional.id)
  if (!grade || grade.length === 0) return []

  const { data: exceptions } = await admin
    .from('professional_availability_exceptions')
    .select('exception_date, exception_type, start_time, end_time')
    .eq('professional_id', professional.id)
    .eq('exception_date', parsed.data.date)

  // WR-03: generate 30-min candidate slots in the clinic's Brazil offset (-03:00),
  // mirroring getBookedSlots. Availability windows are entered as Brazil wall-clock, so the
  // slot instants must be anchored at -03:00 (not 'Z') for isSlotWithinAvailability — which
  // now reads clinic-local components — to compare against the right window.
  const slots: string[] = []
  const baseDate = `${parsed.data.date}T`
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const slotStart = `${baseDate}${hh}:${mm}:00-03:00`
      const slotEnd = new Date(new Date(slotStart).getTime() + 30 * 60 * 1000).toISOString()

      const within = isSlotWithinAvailability(
        (grade ?? []) as AvailabilityWindow[],
        (exceptions ?? []) as AvailabilityException[],
        { start: slotStart, end: slotEnd },
      )
      if (within) slots.push(slotStart)
    }
  }

  return slots
}
