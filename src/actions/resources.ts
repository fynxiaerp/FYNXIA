'use server'
/**
 * Server Actions: resources (RES-01)
 *
 * createResource / updateResource / deleteResource
 *
 * Guards:
 *   - assertNotReadOnly() — second enforcement layer (middleware redirect does NOT block SA POST)
 *   - Role gate: admin + superadmin only
 *   - Tenant scope: clinic_id = actor.tenant_id on every mutation
 *   - Zod validation via resourceSchema
 *   - logBusinessEvent: IDs only (LGPD)
 *
 * Turbopack 'use server' constraint: every export at module level must be async.
 * No re-exports, no non-async exports.
 */
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { resourceSchema, type ResourceInput } from '@/lib/validators/resource'

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

// ─── createResource ────────────────────────────────────────────────────────────
// RES-01: cadastrar recurso físico (sala/cadeira/equipamento).
// T-11-26: assertNotReadOnly blocks read-only roles at action layer.
// T-11-27: clinic_id = actor.tenant_id prevents cross-tenant write.
// T-11-28: resourceSchema enum-validates tipo + status before storage.
export async function createResource(
  input: ResourceInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await assertNotReadOnly()

  const parsed = resourceSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  // Role gate: only admin / superadmin can manage resources
  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para cadastrar recurso' }
  }

  const { nome, tipo, unit_id, patrimonio, numero_serie, status, manutencao_prevista } = parsed.data

  const supabase = await createClient()

  const { data: resource, error: insertError } = await supabase
    .from('resources')
    .insert({
      clinic_id: actor.tenant_id, // T-11-27: tenant scope
      unit_id,
      nome,
      tipo,
      patrimonio: patrimonio ?? null,
      numero_serie: numero_serie ?? null,
      status,
      manutencao_prevista: manutencao_prevista ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'resource.created',
    details: {
      resource_id: resource!.id,
      tipo,
      status,
    },
  })

  return { success: true, id: resource!.id }
}

// ─── updateResource ────────────────────────────────────────────────────────────
// RES-01: editar recurso (incluindo mudar status para 'manutencao' — gate de agenda).
// A mudança de status para 'manutencao' é consumida pela lógica de agenda no Plan 04
// via isResourceAvailable(). Esta action apenas salva o dado.
export async function updateResource(
  id: string,
  input: ResourceInput
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const parsed = resourceSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para editar recurso' }
  }

  const { nome, tipo, unit_id, patrimonio, numero_serie, status, manutencao_prevista } = parsed.data

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('resources')
    .update({
      unit_id,
      nome,
      tipo,
      patrimonio: patrimonio ?? null,
      numero_serie: numero_serie ?? null,
      status,
      manutencao_prevista: manutencao_prevista ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id) // T-11-27: tenant scope guard

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'resource.updated',
    details: {
      resource_id: id,
      status, // log status changes (manutenção trigger for booking block)
    },
  })

  return { success: true }
}

// ─── deleteResource ────────────────────────────────────────────────────────────
// Soft delete: sets deleted_at = now(). LGPD — data is preserved but hidden.
// Appointments referencing this resource_id are NOT affected (booking guard uses status,
// not deleted_at; orphan resource_id on appointments is acceptable post-delete).
export async function deleteResource(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para remover recurso' }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('resources')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id) // T-11-27: tenant scope guard

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'resource.deleted',
    details: {
      resource_id: id,
    },
  })

  return { success: true }
}
