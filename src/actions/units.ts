'use server'
/**
 * Units (filiais) Server Actions
 *
 * SYS-01 / Plan 07-05:
 * - listUnits: list all non-deleted units for the authenticated tenant
 * - createUnit: insert a new unit — admin/superadmin only
 * - updateUnit: update an existing unit — admin/superadmin only
 *   Deactivation (ativo:false) is blocked for the is_default unit.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — rejects auditor/dpo/socio at action layer
 *   2. role gate — only 'admin' | 'superadmin' may mutate
 *   3. clinic_id always set from actor.tenant_id (never from client input — T-07-16)
 *   4. RLS enforces tenant isolation as DB backstop (Plan 02)
 */
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { unitSchema, UnitInput } from '@/lib/validators/unit'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

export type UnitRow = {
  id: string
  name: string
  cnpj: string | null
  slug: string
  phone: string | null
  address: string | null
  ativo: boolean
  is_default: boolean
  clinic_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── listUnits ────────────────────────────────────────────────────────────────

export async function listUnits(): Promise<{
  success: boolean
  units?: UnitRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('units')
    .select('id, name, cnpj, slug, phone, address, ativo, is_default, clinic_id, created_at, updated_at, deleted_at')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, units: data ?? [] }
}

// ─── createUnit ───────────────────────────────────────────────────────────────

export async function createUnit(input: UnitInput): Promise<{
  success: boolean
  unitId?: string
  error?: string
}> {
  // 1. Read-only gate
  await assertNotReadOnly()

  // 2. Validate
  const parsed = unitSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 3. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. Insert — clinic_id from actor.tenant_id (T-07-16: never from input)
  const supabase = await createClient()
  const rawCnpj = data.cnpj ? data.cnpj.replace(/\D/g, '') || null : null

  const { data: inserted, error: insertError } = await supabase
    .from('units')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      cnpj: rawCnpj,
      slug: data.slug,
      phone: data.phone ?? null,
      address: data.address ?? null,
      ativo: data.ativo,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar unidade' }
  }

  // 5. Audit
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'unit.created',
    details: { unit_id: inserted.id, name: data.name, slug: data.slug },
  })

  return { success: true, unitId: inserted.id }
}

// ─── updateUnit ───────────────────────────────────────────────────────────────

export async function updateUnit(
  unitId: string,
  input: UnitInput
): Promise<{
  success: boolean
  error?: string
}> {
  // 1. Read-only gate
  await assertNotReadOnly()

  // 2. Validate
  const parsed = unitSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 3. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. Guard: cannot deactivate the default unit
  if (!data.ativo) {
    const supabase = await createClient()
    const { data: unitRow } = await supabase
      .from('units')
      .select('is_default')
      .eq('id', unitId)
      .eq('clinic_id', actor.tenant_id)
      .single()

    if (unitRow?.is_default) {
      return { success: false, error: 'A unidade padrão não pode ser desativada' }
    }
  }

  // 5. Update — clinic_id scoped via actor.tenant_id (T-07-16)
  const supabase = await createClient()
  const rawCnpj = data.cnpj ? data.cnpj.replace(/\D/g, '') || null : null

  const { error: updateError } = await supabase
    .from('units')
    .update({
      name: data.name,
      cnpj: rawCnpj,
      slug: data.slug,
      phone: data.phone ?? null,
      address: data.address ?? null,
      ativo: data.ativo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unitId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 6. Audit
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'unit.updated',
    details: { unit_id: unitId, name: data.name, ativo: data.ativo },
  })

  return { success: true }
}
