'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import {
  professionalSchema,
  availabilityWindowSchema,
  availabilityExceptionSchema,
  type ProfessionalInput,
  type AvailabilityWindowInput,
  type AvailabilityExceptionInput,
} from '@/lib/validators/professional'

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

// ─── createProfessional ───────────────────────────────────────────────────────
// PRO-01: criar profissional com grade de disponibilidade e exceções.
// T-11-22: assertNotReadOnly bloqueia papéis somente-leitura.
// T-11-23: clinic_id = actor.tenant_id em todas as inserções.
export async function createProfessional(
  input: ProfessionalInput & {
    availability?: AvailabilityWindowInput[]
    exceptions?: AvailabilityExceptionInput[]
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  // Role gate: only admin/superadmin can manage professionals
  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente: apenas administradores podem cadastrar profissionais.' }
  }

  // T-11-24: validate professional fields + commission_rules shape
  const parsed = professionalSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  // T-11-25: validate availability windows
  const availabilityRows = input.availability ?? []
  for (const window of availabilityRows) {
    const winParsed = availabilityWindowSchema.safeParse(window)
    if (!winParsed.success) {
      const firstError = winParsed.error.errors[0]
      return { success: false, error: `Grade de disponibilidade: ${firstError?.message ?? 'Dados inválidos'}` }
    }
  }

  const exceptionRows = input.exceptions ?? []
  for (const exc of exceptionRows) {
    const excParsed = availabilityExceptionSchema.safeParse(exc)
    if (!excParsed.success) {
      const firstError = excParsed.error.errors[0]
      return { success: false, error: `Exceções: ${firstError?.message ?? 'Dados inválidos'}` }
    }
  }

  const supabase = await createClient()

  // Insert professionals row — clinic_id is always actor.tenant_id (T-11-23)
  const { data: professional, error: insertError } = await supabase
    .from('professionals')
    .insert({
      clinic_id: actor.tenant_id,
      full_name: parsed.data.full_name,
      cro: parsed.data.cro,
      cro_uf: parsed.data.cro_uf,
      especialidades: parsed.data.especialidades,
      vinculo: parsed.data.vinculo,
      unit_id: parsed.data.unit_id ?? null,
      user_id: parsed.data.user_id ?? null,
      commission_rules: parsed.data.commission_rules,
      ativo: parsed.data.ativo ?? true,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  const professionalId = professional!.id

  // Insert availability windows (grade semanal)
  if (availabilityRows.length > 0) {
    const { error: availError } = await supabase
      .from('professional_availability')
      .insert(
        availabilityRows.map((w) => ({
          professional_id: professionalId,
          clinic_id: actor.tenant_id,
          weekday: w.weekday,
          start_time: w.start_time,
          end_time: w.end_time,
        }))
      )
    if (availError) {
      return { success: false, error: availError.message }
    }
  }

  // Insert availability exceptions
  if (exceptionRows.length > 0) {
    const { error: excError } = await supabase
      .from('professional_availability_exceptions')
      .insert(
        exceptionRows.map((e) => ({
          professional_id: professionalId,
          clinic_id: actor.tenant_id,
          exception_date: e.exception_date,
          exception_type: e.exception_type,
          start_time: e.start_time ?? null,
          end_time: e.end_time ?? null,
          reason: e.reason ?? null,
        }))
      )
    if (excError) {
      return { success: false, error: excError.message }
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'professional.created',
    details: {
      professional_id: professionalId,
    },
  })

  return { success: true, id: professionalId }
}

// ─── updateProfessional ───────────────────────────────────────────────────────
// PRO-01: atualizar profissional — substitui grade de disponibilidade completa.
// T-11-22: assertNotReadOnly; T-11-23: .eq('clinic_id', actor.tenant_id).
export async function updateProfessional(
  id: string,
  input: ProfessionalInput & {
    availability?: AvailabilityWindowInput[]
    exceptions?: AvailabilityExceptionInput[]
  }
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente: apenas administradores podem editar profissionais.' }
  }

  const parsed = professionalSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const availabilityRows = input.availability ?? []
  for (const window of availabilityRows) {
    const winParsed = availabilityWindowSchema.safeParse(window)
    if (!winParsed.success) {
      const firstError = winParsed.error.errors[0]
      return { success: false, error: `Grade de disponibilidade: ${firstError?.message ?? 'Dados inválidos'}` }
    }
  }

  const exceptionRows = input.exceptions ?? []
  for (const exc of exceptionRows) {
    const excParsed = availabilityExceptionSchema.safeParse(exc)
    if (!excParsed.success) {
      const firstError = excParsed.error.errors[0]
      return { success: false, error: `Exceções: ${firstError?.message ?? 'Dados inválidos'}` }
    }
  }

  const supabase = await createClient()

  // Update professional row — tenant-scoped (T-11-23)
  const { error: updateError } = await supabase
    .from('professionals')
    .update({
      full_name: parsed.data.full_name,
      cro: parsed.data.cro,
      cro_uf: parsed.data.cro_uf,
      especialidades: parsed.data.especialidades,
      vinculo: parsed.data.vinculo,
      unit_id: parsed.data.unit_id ?? null,
      user_id: parsed.data.user_id ?? null,
      commission_rules: parsed.data.commission_rules,
      ativo: parsed.data.ativo ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Replace availability grade: delete existing, reinsert
  await supabase
    .from('professional_availability')
    .delete()
    .eq('professional_id', id)
    .eq('clinic_id', actor.tenant_id)

  if (availabilityRows.length > 0) {
    const { error: availError } = await supabase
      .from('professional_availability')
      .insert(
        availabilityRows.map((w) => ({
          professional_id: id,
          clinic_id: actor.tenant_id,
          weekday: w.weekday,
          start_time: w.start_time,
          end_time: w.end_time,
        }))
      )
    if (availError) {
      return { success: false, error: availError.message }
    }
  }

  // Replace exceptions: delete existing, reinsert
  await supabase
    .from('professional_availability_exceptions')
    .delete()
    .eq('professional_id', id)
    .eq('clinic_id', actor.tenant_id)

  if (exceptionRows.length > 0) {
    const { error: excError } = await supabase
      .from('professional_availability_exceptions')
      .insert(
        exceptionRows.map((e) => ({
          professional_id: id,
          clinic_id: actor.tenant_id,
          exception_date: e.exception_date,
          exception_type: e.exception_type,
          start_time: e.start_time ?? null,
          end_time: e.end_time ?? null,
          reason: e.reason ?? null,
        }))
      )
    if (excError) {
      return { success: false, error: excError.message }
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'professional.updated',
    details: {
      professional_id: id,
    },
  })

  return { success: true }
}

// ─── deleteProfessional ───────────────────────────────────────────────────────
// Soft delete (LGPD: preserva histórico, deleted_at = now()).
// T-11-22: assertNotReadOnly; T-11-23: tenant-scoped.
export async function deleteProfessional(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente: apenas administradores podem remover profissionais.' }
  }

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('professionals')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'professional.deleted',
    details: {
      professional_id: id,
    },
  })

  return { success: true }
}
