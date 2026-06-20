'use server'
// src/actions/cost-centers.ts
// FCAD-01: Server Actions for cost_centers cadastro management.
// T-14-10: Admin write gate — role IN ('admin','superadmin') on every mutation.
// No hard delete in UI per UI-SPEC — deactivate via updateCostCenter({ ativo: false }).

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'

// ─── Helper: get authenticated actor ─────────────────────────────────────────

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

const WRITE_ROLES = ['admin', 'superadmin'] as const

// ─── CostCenterRow ────────────────────────────────────────────────────────────

export interface CostCenterRow {
  id: string
  name: string
  unit_id: string | null
  unit_name: string | null
  is_default: boolean
  ativo: boolean
}

// ─── listCostCenters ──────────────────────────────────────────────────────────
// SELECT cost_centers joining units(name) for display.
// Array-or-object guard on join result (mirrors listTransactions pattern).

export async function listCostCenters(): Promise<{
  success: boolean
  centers?: CostCenterRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cost_centers')
    .select('id, name, unit_id, is_default, ativo, units(name)')
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  const centers: CostCenterRow[] = (data ?? []).map((row: {
    id: string
    name: string
    unit_id: string | null
    is_default: boolean
    ativo: boolean
    units: { name: string } | { name: string }[] | null
  }) => {
    const unitJoin = row.units
    const unitName = unitJoin
      ? (Array.isArray(unitJoin) ? unitJoin[0]?.name : unitJoin.name) ?? null
      : null
    return {
      id: row.id,
      name: row.name,
      unit_id: row.unit_id,
      unit_name: unitName,
      is_default: row.is_default,
      ativo: row.ativo,
    }
  })

  return { success: true, centers }
}

// ─── createCostCenter ─────────────────────────────────────────────────────────
// T-14-10: admin/superadmin gate
// The seeded default CC already exists per unit — new CCs created here have is_default = false.

const createCostCenterSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  unitId: z.string().uuid('Unidade inválida'),
  ativo: z.boolean().optional(),
})

export async function createCostCenter(input: {
  name: string
  unitId: string
  ativo?: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = createCostCenterSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar centros de custo' }
  }

  const supabase = await createClient()
  const { data: inserted, error: insertError } = await supabase
    .from('cost_centers')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: data.unitId,
      name: data.name,
      is_default: false, // admin creates non-default CCs; the seeded default remains
      ativo: data.ativo ?? true,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar centro de custo' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'cost_center.created',
    details: { id: inserted.id, name: data.name, unit_id: data.unitId },
  })

  return { success: true, id: inserted.id }
}

// ─── updateCostCenter ─────────────────────────────────────────────────────────
// No hard delete per UI-SPEC — deactivate via ativo: false.

const updateCostCenterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  ativo: z.boolean().optional(),
})

export async function updateCostCenter(input: {
  id: string
  name?: string
  ativo?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const parsed = updateCostCenterSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar centros de custo' }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) patch.name = data.name
  if (data.ativo !== undefined) patch.ativo = data.ativo

  const supabase = await createClient()
  const { error } = await supabase
    .from('cost_centers')
    .update(patch)
    .eq('id', data.id)

  if (error) {
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'cost_center.updated',
    details: { id: data.id, patch },
  })

  return { success: true }
}
