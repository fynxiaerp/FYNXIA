'use server'
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
  if (!clinicSlug || !input.dentist_id || !input.start_time || !input.end_time) {
    return { success: false, error: 'Dados incompletos para o agendamento' }
  }

  // Validate end_time > start_time
  if (new Date(input.end_time) <= new Date(input.start_time)) {
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

  // Build notes with requester contact info (staff links patient later)
  const notesLines = [
    `Solicitante: ${input.requester_name}`,
    `Telefone: ${input.requester_phone}`,
  ]
  if (input.requester_email) {
    notesLines.push(`E-mail: ${input.requester_email}`)
  }
  notesLines.push('[Agendamento público — vincular paciente na recepção]')
  const notes = notesLines.join('\n')

  // Insert appointment — GIST constraint handles slot atomicity (T-2-01)
  const { data: appointment, error: insertError } = await admin
    .from('appointments')
    .insert({
      tenant_id: clinic.id,
      dentist_id: input.dentist_id,
      patient_id: null, // linked by receptionist after
      start_time: input.start_time,
      end_time: input.end_time,
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
