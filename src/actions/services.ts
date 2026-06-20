'use server'
import 'server-only'
/**
 * Services & Insurer Prices Server Actions — Phase 15 / Plan 05
 *
 * Implements the billing catalog:
 *   listServices       — list all services for the clinic (active + inactive)
 *   createService      — insert service scoped to tenant
 *   updateService      — update service fields
 *   deactivateService  — soft-deactivate (ativo = false)
 *   listInsurerPrices  — list insurer_prices for a given operadora
 *   upsertInsurerPrice — create or update an insurer price row
 *
 * Security:
 *   - getActor() auth check on every action
 *   - Write operations gated to admin/superadmin (T-15-03)
 *   - RLS enforces clinic-scoping at DB layer
 *   - Zod v3 validation; no .default() (D-133)
 *
 * LGPD: no patient PII in this module (catalog data only)
 */

import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { serviceSchema, insurerPriceSchema } from '@/lib/validators/service'
import { revalidatePath } from 'next/cache'

// ─── Actor helper ────────────────────────────────────────────────────────────

type Actor = { id: string; tenant_id: string; role: string }

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Não autenticado' }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) return { error: 'Usuário não encontrado' }
  return { actor }
}

const WRITE_ROLES = ['admin', 'superadmin'] as const

// ─── listServices ─────────────────────────────────────────────────────────────
// Returns all services for the clinic (ativo and inactive — cadastro needs both).

export async function listServices(): Promise<{
  success: boolean
  services?: Array<{
    id: string
    name: string
    code: string | null
    tuss_code: string | null
    description: string | null
    valor_particular: number
    account_id: string | null
    aliquota_iss_override: number | null
    item_lista_servico_override: string | null
    ativo: boolean
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .select('id, name, code, tuss_code, description, valor_particular, account_id, aliquota_iss_override, item_lista_servico_override, ativo')
    .order('name')

  if (error) return { success: false, error: error.message }
  return { success: true, services: data ?? [] }
}

// ─── createService ────────────────────────────────────────────────────────────

export async function createService(input: {
  name: string
  code?: string | null
  tussCode?: string | null
  description?: string | null
  valorParticular: number
  accountId?: string | null
  aliquotaIssOverride?: number | null
  itemListaServicoOverride?: string | null
  ativo: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente para criar serviço' }
  }

  const supabase = await createClient()
  const { data: service, error: insertError } = await supabase
    .from('services')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      code: data.code ?? null,
      tuss_code: data.tussCode ?? null,
      description: data.description ?? null,
      valor_particular: data.valorParticular,
      account_id: data.accountId ?? null,
      aliquota_iss_override: data.aliquotaIssOverride ?? null,
      item_lista_servico_override: data.itemListaServicoOverride ?? null,
      ativo: data.ativo,
    })
    .select('id')
    .single()

  if (insertError || !service) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar serviço' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'service.created',
    details: { service_id: service.id, name: data.name },
  })

  revalidatePath('/clinica/financeiro/faturamento')
  return { success: true, id: service.id }
}

// ─── updateService ────────────────────────────────────────────────────────────

export async function updateService(id: string, input: {
  name?: string
  code?: string | null
  tussCode?: string | null
  description?: string | null
  valorParticular?: number
  accountId?: string | null
  aliquotaIssOverride?: number | null
  itemListaServicoOverride?: string | null
  ativo?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente para editar serviço' }
  }

  const supabase = await createClient()
  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updateFields.name = input.name
  if (input.code !== undefined) updateFields.code = input.code
  if (input.tussCode !== undefined) updateFields.tuss_code = input.tussCode
  if (input.description !== undefined) updateFields.description = input.description
  if (input.valorParticular !== undefined) updateFields.valor_particular = input.valorParticular
  if (input.accountId !== undefined) updateFields.account_id = input.accountId
  if (input.aliquotaIssOverride !== undefined) updateFields.aliquota_iss_override = input.aliquotaIssOverride
  if (input.itemListaServicoOverride !== undefined) updateFields.item_lista_servico_override = input.itemListaServicoOverride
  if (input.ativo !== undefined) updateFields.ativo = input.ativo

  const { error } = await supabase
    .from('services')
    .update(updateFields)
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clinica/financeiro/faturamento')
  return { success: true }
}

// ─── deactivateService ────────────────────────────────────────────────────────

export async function deactivateService(id: string): Promise<{ success: boolean; error?: string }> {
  return updateService(id, { ativo: false })
}

// ─── listInsurerPrices ────────────────────────────────────────────────────────
// Returns all insurer_prices rows for a given operadora.

export async function listInsurerPrices(insurerId: string): Promise<{
  success: boolean
  prices?: Array<{
    id: string
    insurer_id: string
    service_id: string
    valor: number
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insurer_prices')
    .select('id, insurer_id, service_id, valor')
    .eq('insurer_id', insurerId)
    .order('service_id')

  if (error) return { success: false, error: error.message }
  return { success: true, prices: data ?? [] }
}

// ─── upsertInsurerPrice ───────────────────────────────────────────────────────
// Create or update an insurer price row (CONV-01 / D-06 operadora price table).

export async function upsertInsurerPrice(input: {
  insurerId: string
  serviceId: string
  valor: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = insurerPriceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente para gerenciar preços de convênio' }
  }

  const supabase = await createClient()
  const { data: price, error: upsertError } = await supabase
    .from('insurer_prices')
    .upsert(
      {
        insurer_id: data.insurerId,
        service_id: data.serviceId,
        valor: data.valor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'insurer_id,service_id' },
    )
    .select('id')
    .single()

  if (upsertError || !price) {
    return { success: false, error: upsertError?.message ?? 'Erro ao salvar preço de convênio' }
  }

  revalidatePath('/clinica/financeiro/faturamento')
  return { success: true, id: price.id }
}
