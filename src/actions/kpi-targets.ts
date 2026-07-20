'use server'
/**
 * src/actions/kpi-targets.ts — KPI target CRUD (BI-01, Plan 19-07).
 *
 * kpi_targets meta per kpi_key + unidade (D-30). Feeds getBiKpis (src/actions/bi-kpis.ts)
 * meta×realizado attach.
 *
 * SECURITY (T-19-11):
 *   kpi_targets RLS already restricts WRITE to admin/superadmin (Plan 03 migration:
 *   supabase/migrations/20260719000200_bi_rls.sql), but the role gate is ENFORCED HERE
 *   TOO (defense-in-depth) — mirrors BUDGET_WRITE_ROLES in budget-targets.ts /
 *   SHARE_WRITE_ROLES in partner-shares.ts.
 *
 * UPSERT PATTERN (mirrors upsertBudgetTargetRow in budget-targets.ts):
 *   kpi_targets only has PARTIAL unique indexes (uq_kpi_targets_unit WHERE unit_id IS
 *   NOT NULL / uq_kpi_targets_network WHERE unit_id IS NULL) — PostgREST
 *   .upsert(onConflict:) cannot resolve a partial index as arbiter. Explicit
 *   UPDATE (scoped by unit_id) → INSERT if 0 rows affected.
 */
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { kpiTargetSchema } from '@/lib/financeiro/kpi-target-schema'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

const KPI_READ_ROLES = ['admin', 'socio', 'superadmin'] as const
const KPI_WRITE_ROLES = ['admin', 'superadmin'] as const

// ─── Helper: get authenticated actor (replicated from transactions.ts) ──────

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

// ─── Helper: role gates (T-19-11) ────────────────────────────────────────────

async function requireKpiReadActor(): Promise<{ actor: Actor } | { error: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return actorResult
  }
  const { actor } = actorResult
  if (!(KPI_READ_ROLES as readonly string[]).includes(actor.role)) {
    return { error: 'Permissão insuficiente para acessar o BI' }
  }
  return { actor }
}

async function requireKpiWriteActor(): Promise<{ actor: Actor } | { error: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return actorResult
  }
  const { actor } = actorResult
  if (!(KPI_WRITE_ROLES as readonly string[]).includes(actor.role)) {
    return { error: 'Permissão insuficiente para gerenciar metas de KPI' }
  }
  return { actor }
}

// ─── listKpiTargets ───────────────────────────────────────────────────────────
// D-30: metas por kpi_key para o escopo (unidade específica ou consolidado/rede).

export interface KpiTargetRow {
  id: string
  kpiKey: string
  unitId: string | null
  metaValor: number
}

export async function listKpiTargets(params?: {
  unitId?: string
}): Promise<{ success: boolean; targets?: KpiTargetRow[]; error?: string }> {
  const actorResult = await requireKpiReadActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase.from('kpi_targets').select('id, kpi_key, unit_id, meta_valor')

  query = params?.unitId ? query.eq('unit_id', params.unitId) : query.is('unit_id', null)

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const targets: KpiTargetRow[] = (
    (data ?? []) as Array<{ id: string; kpi_key: string; unit_id: string | null; meta_valor: number }>
  ).map((row) => ({
    id: row.id,
    kpiKey: row.kpi_key,
    unitId: row.unit_id,
    metaValor: row.meta_valor,
  }))

  return { success: true, targets }
}

// ─── saveKpiTarget ────────────────────────────────────────────────────────────
// D-30: gate admin/superadmin (T-19-11). Explicit UPDATE→INSERT upsert against the
// partial unique index (mirrors upsertBudgetTargetRow).

export async function saveKpiTarget(input: {
  kpiKey: string
  unitId?: string | null
  metaValor: number
}): Promise<{ success: boolean; error?: string }> {
  const parsed = kpiTargetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await requireKpiWriteActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()
  const now = new Date().toISOString()
  const unitId = data.unitId ?? null

  let updateQuery = supabase
    .from('kpi_targets')
    .update({ meta_valor: data.metaValor, updated_at: now })
    .eq('clinic_id', actor.tenant_id)
    .eq('kpi_key', data.kpiKey)

  updateQuery = unitId ? updateQuery.eq('unit_id', unitId) : updateQuery.is('unit_id', null)

  const { data: updated, error: updateError } = await updateQuery.select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from('kpi_targets').insert({
      clinic_id: actor.tenant_id,
      unit_id: unitId,
      kpi_key: data.kpiKey,
      meta_valor: data.metaValor,
      created_by: actor.id,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'kpi_target.saved',
    details: { kpi_key: data.kpiKey, unit_id: unitId, meta_valor: data.metaValor },
  })

  return { success: true }
}
