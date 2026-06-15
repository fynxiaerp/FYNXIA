'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { appointmentSchema, type AppointmentInput } from '@/lib/validators/appointment'
import { isSlotWithinAvailability, type AvailabilityWindow, type AvailabilityException } from '@/lib/scheduling/availability'
import { isResourceAvailable } from '@/lib/scheduling/resources'

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

  const { dentist_id, patient_id, start_time, end_time, status, notes, resource_id } = parsed.data

  const supabase = await createClient()

  // ── PRO-02: Availability pre-flight guard ────────────────────────────────────
  // Resolve the professional row for this dentist (user_id lookup — no professional_id FK).
  // Phase 11 intentional: professional↔appointment link is query-time via user_id, not a FK.
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', dentist_id)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (professional) {
    // Fetch recurring weekly availability windows for this professional
    const { data: grade } = await supabase
      .from('professional_availability')
      .select('weekday, start_time, end_time')
      .eq('professional_id', professional.id)

    // Fetch date-specific exceptions (folga / extra) that touch the slot's date
    const slotDate = start_time.slice(0, 10) // YYYY-MM-DD
    const { data: exceptions } = await supabase
      .from('professional_availability_exceptions')
      .select('exception_date, exception_type, start_time, end_time')
      .eq('professional_id', professional.id)
      .eq('exception_date', slotDate)

    const within = isSlotWithinAvailability(
      (grade ?? []) as AvailabilityWindow[],
      (exceptions ?? []) as AvailabilityException[],
      { start: start_time, end: end_time },
    )
    if (!within) {
      return { success: false, error: 'Horário fora da disponibilidade do profissional.' }
    }
  }

  // ── RES-02: Resource pre-flight guard ────────────────────────────────────────
  if (resource_id) {
    const { data: resource } = await supabase
      .from('resources')
      .select('status')
      .eq('id', resource_id)
      .eq('clinic_id', actor.tenant_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!isResourceAvailable(resource?.status)) {
      return { success: false, error: 'Recurso em manutenção ou indisponível.' }
    }

    // App-level overlap check: any non-cancelled appointment with the same resource
    // overlapping [start_time, end_time). The GIST is the backstop for dentist
    // double-booking; resource conflict is an app-level guard only (RES-02).
    const { data: overlap } = await supabase
      .from('appointments')
      .select('id')
      .eq('resource_id', resource_id)
      .neq('status', 'cancelado')
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1)

    if (overlap && overlap.length > 0) {
      return { success: false, error: 'Recurso já reservado neste horário.' }
    }
  }

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
      resource_id: resource_id ?? null,
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
  if (input.resource_id !== undefined) updateFields.resource_id = input.resource_id ?? null

  const supabase = await createClient()

  // ── WR-04: Reschedule/resource guards (mirror createAppointment) ─────────────
  // The drag-to-reschedule path usually sends only start_time/end_time (no dentist_id),
  // and resource_id is mutable here. We must therefore resolve the effective dentist and
  // resource from the EXISTING row when the payload omits them, then re-run the same
  // availability + resource guards createAppointment runs. The GIST still backstops dentist
  // double-booking; resources have no GIST this phase, so the app check is the only guard.
  const timesChanged = input.start_time !== undefined || input.end_time !== undefined
  const dentistChanged = input.dentist_id !== undefined
  const resourceChanged = input.resource_id !== undefined

  if (timesChanged || dentistChanged || resourceChanged) {
    // Fetch the current row so we can resolve effective values + the [start,end) window.
    const { data: existing } = await supabase
      .from('appointments')
      .select('dentist_id, resource_id, start_time, end_time')
      .eq('id', id)
      .eq('tenant_id', actor.tenant_id)
      .maybeSingle()

    if (!existing) {
      return { success: false, error: 'Agendamento não encontrado' }
    }

    // Effective slot window: new values if provided, else the existing ones.
    const effectiveStart = input.start_time ?? existing.start_time
    const effectiveEnd = input.end_time ?? existing.end_time
    const effectiveDentistId = input.dentist_id ?? existing.dentist_id
    const effectiveResourceId =
      input.resource_id !== undefined ? (input.resource_id ?? null) : existing.resource_id

    // ── PRO-02: Availability pre-flight guard ──────────────────────────────────
    // Re-check whenever the time window or the dentist changes.
    if ((timesChanged || dentistChanged) && effectiveDentistId && effectiveStart && effectiveEnd) {
      const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', effectiveDentistId)
        .eq('clinic_id', actor.tenant_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (professional) {
        const { data: grade } = await supabase
          .from('professional_availability')
          .select('weekday, start_time, end_time')
          .eq('professional_id', professional.id)

        const slotDate = effectiveStart.slice(0, 10)
        const { data: exceptions } = await supabase
          .from('professional_availability_exceptions')
          .select('exception_date, exception_type, start_time, end_time')
          .eq('professional_id', professional.id)
          .eq('exception_date', slotDate)

        const within = isSlotWithinAvailability(
          (grade ?? []) as AvailabilityWindow[],
          (exceptions ?? []) as AvailabilityException[],
          { start: effectiveStart, end: effectiveEnd },
        )
        if (!within) {
          return { success: false, error: 'Horário fora da disponibilidade do profissional.' }
        }
      }
    }

    // ── RES-02: Resource pre-flight guard ──────────────────────────────────────
    // Re-check whenever the resource changes OR the time window moves (a moved slot can
    // collide with another appointment on the same resource).
    if (effectiveResourceId && (resourceChanged || timesChanged) && effectiveStart && effectiveEnd) {
      const { data: resource } = await supabase
        .from('resources')
        .select('status')
        .eq('id', effectiveResourceId)
        .eq('clinic_id', actor.tenant_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (!isResourceAvailable(resource?.status)) {
        return { success: false, error: 'Recurso em manutenção ou indisponível.' }
      }

      // App-level overlap check, excluding THIS appointment (.neq('id', id)) so it
      // doesn't conflict with itself.
      const { data: overlap } = await supabase
        .from('appointments')
        .select('id')
        .eq('resource_id', effectiveResourceId)
        .eq('tenant_id', actor.tenant_id)
        .neq('id', id)
        .neq('status', 'cancelado')
        .lt('start_time', effectiveEnd)
        .gt('end_time', effectiveStart)
        .limit(1)

      if (overlap && overlap.length > 0) {
        return { success: false, error: 'Recurso já reservado neste horário.' }
      }
    }
  }

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
