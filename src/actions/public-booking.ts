'use server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'

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

  // Audit — only IDs; no PII (T-2-08); actorId=null (public system action)
  await logBusinessEvent({
    tenantId: clinic.id,
    actorId: 'system',
    action: 'appointment.public_created',
    details: { appointment_id: appointment!.id, clinic_id: clinic.id },
  })

  return { success: true, id: appointment!.id }
}
