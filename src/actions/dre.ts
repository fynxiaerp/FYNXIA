'use server'
/**
 * src/actions/dre.ts — DRE (Demonstração de Resultado) read-time aggregation
 * Server Actions (REP-01, Plan 19-04).
 *
 * Thin wrappers over the pure aggregateDre (src/lib/financeiro/dre-math.ts, Plan 01).
 *
 * SECURITY (T-19-01):
 *   financial_transactions RLS grants SELECT to ALL tenant roles (no role filter) —
 *   the DRE_ROLES gate below is enforced HERE at the action layer (mirrors COST_ROLES
 *   pattern from setLabOrderCost, Phase 13). RLS alone is insufficient (Pitfall 2).
 *
 * PITFALL 4 (19-RESEARCH):
 *   financial_transactions has NO unit_id column and its tenant column is `tenant_id`
 *   (not clinic_id). Tenant isolation is enforced by RLS via the authenticated
 *   session (mirrors listTransactions in src/actions/transactions.ts) — no explicit
 *   .eq('clinic_id', ...) is ever applied against financial_transactions.
 *
 * Decisions encoded:
 *   D-01/D-02/D-03: receita/despesa/resultado/margem for a period, consolidated or per-unit.
 *   D-04: getDreByUnit ranks units by resultado for the consolidated ranking table.
 *   D-05: getDreDrilldown exposes the raw financial_transactions rows for one account_id —
 *         the ONLY path in this file that ships row-level data to the client.
 *   D-09: DRE_ROLES = admin/socio/superadmin only.
 *   D-10: DRE is always recalculated read-time from financial_transactions — no snapshot.
 *   D-11: YoY comparison only when >=12 months of transaction history precede the period.
 *   A4:   consolidated ('Todas', no unitId) applies NO cost_center_id filter — includes
 *         NULL-cost-center rows. A specific unit filters IN its cost centers.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { listUnits } from '@/actions/units'
import { aggregateDre, type DreResult, type DreTxRow } from '@/lib/financeiro/dre-math'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

const DRE_ROLES = ['admin', 'socio', 'superadmin'] as const

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

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

// ─── Helper: DRE role gate (T-19-01, D-09) ───────────────────────────────────

async function requireDreActor(): Promise<{ actor: Actor } | { error: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return actorResult
  }
  const { actor } = actorResult
  if (!(DRE_ROLES as readonly string[]).includes(actor.role)) {
    return { error: 'Permissão insuficiente para visualizar o DRE' }
  }
  return { actor }
}

// ─── resolveDreCostCenterFilter — pure unit→cost-center filter decision ─────
// Consolidated ('Todas', no unitId) applies NO cost_center_id filter — includes
// NULL-cost-center rows (D-03/A4). Specific unit filters IN its cost centers.
// unitId with 0 cost centers → empty result, no financial_transactions query needed.

export type DreCostCenterFilterDecision =
  | { mode: 'consolidated' }
  | { mode: 'unit'; costCenterIds: string[] }
  | { mode: 'empty' }

export async function resolveDreCostCenterFilter(
  unitId: string | undefined,
  costCenterIdsForUnit: string[]
): Promise<DreCostCenterFilterDecision> {
  if (!unitId) {
    return { mode: 'consolidated' }
  }
  if (costCenterIdsForUnit.length === 0) {
    return { mode: 'empty' }
  }
  return { mode: 'unit', costCenterIds: costCenterIdsForUnit }
}

// ─── computeYoyAvailability — pure YoY-availability decision (D-11) ──────────
// Available only when the earliest transaction_date is >=12 months before `from`.
// Shifted period = from/to minus exactly 1 year — string year-shift (no Date
// parsing / no timezone drift), mirrors the lexicographic vigência-compare pattern
// already used for partner-share vigência (D-20).

export interface YoyAvailability {
  available: boolean
  shiftedFrom?: string
  shiftedTo?: string
}

function shiftYearString(dateStr: string, deltaYears: number): string {
  const year = Number(dateStr.slice(0, 4))
  const rest = dateStr.slice(4)
  return `${year + deltaYears}${rest}`
}

export async function computeYoyAvailability(
  earliestTransactionDate: string | null,
  from: string,
  to: string
): Promise<YoyAvailability> {
  if (!earliestTransactionDate) {
    return { available: false }
  }

  const oneYearBeforeFrom = shiftYearString(from, -1)
  if (earliestTransactionDate > oneYearBeforeFrom) {
    return { available: false }
  }

  return {
    available: true,
    shiftedFrom: shiftYearString(from, -1),
    shiftedTo: shiftYearString(to, -1),
  }
}

// ─── Shared: resolve unitId → cost_center_ids (replicated from transactions.ts) ─

async function loadCostCenterIdsForUnit(
  supabase: SupabaseClient,
  unitId: string
): Promise<string[]> {
  const { data: ccs } = await supabase.from('cost_centers').select('id').eq('unit_id', unitId)
  return ((ccs ?? []) as { id: string }[]).map((cc) => cc.id)
}

// ─── getDre ───────────────────────────────────────────────────────────────────
// D-01/D-02/D-03: receita/despesa/resultado/margem for a period, consolidated or per-unit.

export interface GetDreParams {
  from: string
  to: string
  unitId?: string
}

type ChartOfAccountsJoin = {
  name: string
  type: 'grupo' | 'receita' | 'despesa'
  parent_id: string | null
}

export async function getDre(
  params: GetDreParams
): Promise<{ success: boolean; dre?: DreResult; error?: string }> {
  const actorResult = await requireDreActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  if (!DATE_RE.test(params.from) || !DATE_RE.test(params.to)) {
    return { success: false, error: 'Período inválido (YYYY-MM-DD)' }
  }

  const supabase = await createClient()

  let costCenterIdsForUnit: string[] = []
  if (params.unitId) {
    costCenterIdsForUnit = await loadCostCenterIdsForUnit(supabase, params.unitId)
  }

  const filterDecision = await resolveDreCostCenterFilter(params.unitId, costCenterIdsForUnit)
  if (filterDecision.mode === 'empty') {
    return { success: true, dre: aggregateDre([]) }
  }

  let query = supabase
    .from('financial_transactions')
    .select(`id, type, amount, account_id, cost_center_id, chart_of_accounts(name, type, parent_id)`)
    .gte('transaction_date', params.from)
    .lte('transaction_date', params.to)

  if (filterDecision.mode === 'unit') {
    query = query.in('cost_center_id', filterDecision.costCenterIds)
  }

  const { data: rows, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const dreRows: DreTxRow[] = ((rows ?? []) as Array<{
    type: 'receita' | 'despesa'
    amount: number
    account_id: string | null
    cost_center_id: string | null
    chart_of_accounts: ChartOfAccountsJoin | ChartOfAccountsJoin[] | null
  }>).map((row) => {
    const acctJoin = row.chart_of_accounts
    const acct = Array.isArray(acctJoin) ? acctJoin[0] : acctJoin
    return {
      amount: row.amount,
      type: row.type,
      account_id: row.account_id,
      account_name: acct?.name ?? null,
      account_type: acct?.type ?? null,
      cost_center_id: row.cost_center_id,
    }
  })

  return { success: true, dre: aggregateDre(dreRows) }
}

// ─── getDreByUnit ─────────────────────────────────────────────────────────────
// D-04: per-unit DRE ranking table for the consolidated ('Todas') view.

export interface DreUnitRanking {
  unitId: string
  unitName: string
  dre: DreResult
}

export async function getDreByUnit(params: {
  from: string
  to: string
}): Promise<{ success: boolean; ranking?: DreUnitRanking[]; error?: string }> {
  const actorResult = await requireDreActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  if (!DATE_RE.test(params.from) || !DATE_RE.test(params.to)) {
    return { success: false, error: 'Período inválido (YYYY-MM-DD)' }
  }

  const unitsResult = await listUnits()
  if (!unitsResult.success || !unitsResult.units) {
    return { success: false, error: unitsResult.error ?? 'Erro ao carregar unidades' }
  }

  const ranking: DreUnitRanking[] = []
  for (const unit of unitsResult.units) {
    const result = await getDre({ from: params.from, to: params.to, unitId: unit.id })
    if (result.success && result.dre) {
      ranking.push({ unitId: unit.id, unitName: unit.name, dre: result.dre })
    }
  }

  ranking.sort((a, b) => b.dre.resultado - a.dre.resultado)

  return { success: true, ranking }
}

// ─── getDreYoY ────────────────────────────────────────────────────────────────
// D-11: same period last year when >=12 months of history exist, else available:false
// so the UI shows "comparação indisponível" without breaking.

export async function getDreYoY(params: {
  from: string
  to: string
  unitId?: string
}): Promise<{
  success: boolean
  available?: boolean
  dre?: DreResult
  resultadoDelta?: number
  error?: string
}> {
  const actorResult = await requireDreActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  if (!DATE_RE.test(params.from) || !DATE_RE.test(params.to)) {
    return { success: false, error: 'Período inválido (YYYY-MM-DD)' }
  }

  const supabase = await createClient()

  const { data: earliestRow } = await supabase
    .from('financial_transactions')
    .select('transaction_date')
    .order('transaction_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const earliest = (earliestRow as { transaction_date: string } | null)?.transaction_date ?? null

  const availability = await computeYoyAvailability(earliest, params.from, params.to)
  if (!availability.available || !availability.shiftedFrom || !availability.shiftedTo) {
    return { success: true, available: false }
  }

  const [priorResult, currentResult] = await Promise.all([
    getDre({ from: availability.shiftedFrom, to: availability.shiftedTo, unitId: params.unitId }),
    getDre({ from: params.from, to: params.to, unitId: params.unitId }),
  ])

  if (!priorResult.success || !priorResult.dre) {
    return { success: false, error: priorResult.error ?? 'Erro ao calcular DRE do período anterior' }
  }
  if (!currentResult.success || !currentResult.dre) {
    return { success: false, error: currentResult.error ?? 'Erro ao calcular DRE atual' }
  }

  return {
    success: true,
    available: true,
    dre: priorResult.dre,
    resultadoDelta: currentResult.dre.resultado - priorResult.dre.resultado,
  }
}

// ─── getDreDrilldown ──────────────────────────────────────────────────────────
// D-05: raw financial_transactions rows for one account_id — the only path in this
// file shipping row-level data to the client, and only on explicit drill-down.

export interface DreDrilldownRow {
  id: string
  amount: number
  type: string
  transaction_date: string
  description: string | null
  cost_center_id: string | null
}

export async function getDreDrilldown(params: {
  from: string
  to: string
  unitId?: string
  accountId: string
}): Promise<{ success: boolean; transactions?: DreDrilldownRow[]; error?: string }> {
  const actorResult = await requireDreActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  if (!DATE_RE.test(params.from) || !DATE_RE.test(params.to)) {
    return { success: false, error: 'Período inválido (YYYY-MM-DD)' }
  }
  if (!params.accountId) {
    return { success: false, error: 'Conta contábil inválida' }
  }

  const supabase = await createClient()

  let costCenterIdsForUnit: string[] = []
  if (params.unitId) {
    costCenterIdsForUnit = await loadCostCenterIdsForUnit(supabase, params.unitId)
  }

  const filterDecision = await resolveDreCostCenterFilter(params.unitId, costCenterIdsForUnit)
  if (filterDecision.mode === 'empty') {
    return { success: true, transactions: [] }
  }

  let query = supabase
    .from('financial_transactions')
    .select('id, amount, type, transaction_date, description, cost_center_id')
    .eq('account_id', params.accountId)
    .gte('transaction_date', params.from)
    .lte('transaction_date', params.to)
    .order('transaction_date', { ascending: false })

  if (filterDecision.mode === 'unit') {
    query = query.in('cost_center_id', filterDecision.costCenterIds)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, transactions: (data ?? []) as DreDrilldownRow[] }
}
