'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { appointmentSchema, type AppointmentInput } from '@/lib/validators/appointment'

// ─── Helper: get authenticated actor ────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── createAppointment ────────────────────────────────────────────────────────
// CLINIC-02: criar agendamento sem conflito.
// T-2-01: EXCLUDE USING GIST no banco garante atomicidade contra race conditions.
// CRÍTICO: capturar código PostgreSQL '23P01' (exclusion_violation) e retornar
// mensagem amigável ao usuário (UI-SPEC Error States).
export async function createAppointment(
  input: AppointmentInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = appointmentSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  // Role gate: only staff can create appointments
  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para criar agendamento' }
  }

  const { dentist_id, patient_id, start_time, end_time, status, notes } = parsed.data

  const supabase = await createClient()

  const { data: appointment, error: insertError } = await supabase
    .from('appointments')
    .insert({
      tenant_id: actor.tenant_id,
      dentist_id,
      patient_id: patient_id ?? null,
      start_time,
      end_time,
      status: status ?? 'agendado',
      notes: notes ?? null,
      source: 'interno',
    })
    .select('id')
    .single()

  if (insertError) {
    // 23P01 = exclusion_violation — EXCLUDE USING GIST constraint (no_overlap) fired
    // Covers T-2-01: double-booking rejected atomically at DB layer
    if (insertError.code === '23P01') {
      return {
        success: false,
        error:
          'Horário indisponível. Este horário foi reservado enquanto você preenchia. Selecione outro horário.',
      }
    }
    return { success: false, error: insertError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'appointment.created',
    details: {
      appointment_id: appointment!.id,
      dentist_id,
      patient_id: patient_id ?? null,
    },
  })

  return { success: true, id: appointment!.id }
}

// ─── updateAppointment ────────────────────────────────────────────────────────
// CLINIC-02: editar agendamento (inclui drag-to-reschedule).
// Captura 23P01 também aqui — cobre o caso de arrastar evento para slot ocupado.
export async function updateAppointment(
  id: string,
  input: Partial<AppointmentInput>
): Promise<{ success: boolean; error?: string }> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para editar agendamento' }
  }

  // Build partial update — only include fields that are present in input
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.start_time !== undefined) updateFields.start_time = input.start_time
  if (input.end_time !== undefined) updateFields.end_time = input.end_time
  if (input.dentist_id !== undefined) updateFields.dentist_id = input.dentist_id
  if (input.patient_id !== undefined) updateFields.patient_id = input.patient_id
  if (input.status !== undefined) updateFields.status = input.status
  if (input.notes !== undefined) updateFields.notes = input.notes

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('appointments')
    .update(updateFields)
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard (T-2-02)

  if (updateError) {
    // 23P01 = exclusion_violation — covers drag-to-reschedule into occupied slot (T-2-01)
    if (updateError.code === '23P01') {
      return {
        success: false,
        error:
          'Horário indisponível. Este horário foi reservado enquanto você preenchia. Selecione outro horário.',
      }
    }
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'appointment.updated',
    details: { appointment_id: id },
  })

  return { success: true }
}

// ─── cancelAppointment ────────────────────────────────────────────────────────
// CLINIC-02: cancelar agendamento (soft — sets status='cancelado', preserva o registro).
// Não deleta — cancelado é excluído do GIST constraint WHERE (status NOT IN ('cancelado')).
export async function cancelAppointment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para cancelar agendamento' }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status: 'cancelado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'appointment.cancelled',
    details: { appointment_id: id },
  })

  return { success: true }
}
