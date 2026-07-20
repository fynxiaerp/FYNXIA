'use server'
/**
 * src/actions/budget-targets.ts — Orçamento Server Actions (REP-02, Plan 19-05).
 *
 * CRUD de metas orçamentárias (budget_targets, Plan 03) + comparativo orçado×realizado
 * com semáforo de desvio. Realizado é calculado em tempo real a partir de
 * financial_transactions — mesma fonte/padrão da DRE (D-10, mirrors src/actions/dre.ts).
 *
 * SECURITY (T-19-08):
 *   budget_targets RLS já restringe WRITE a admin/socio/superadmin (Plan 03 migration),
 *   mas o gate de papel é ENFORÇADO AQUI TAMBÉM (defesa em profundidade) — RLS sozinha
 *   não é suficiente (mesmo padrão do DRE_ROLES em dre.ts / COST_ROLES em lab-orders.ts).
 *
 * TAMPERING (T-19-01):
 *   isMonthLocked (D-18) usa o mês corrente em fuso America/Sao_Paulo (UTC-3 fixo, sem
 *   DST desde 2019 — mirrors saoPauloDayBoundsUTC em src/lib/agents/stock-agent.ts).
 *   saveBudgetTargets NUNCA rejeita o save inteiro por causa de um mês travado — apenas
 *   PULA (skip) as células de meses passados, salvando o restante (D-18 exact wording).
 *
 * UPSERT PATTERN (Pitfall — mirrors saveAiAgentConfig em ai-agent-config.ts):
 *   budget_targets só tem ÍNDICES ÚNICOS PARCIAIS (uq_budget_targets_unit WHERE
 *   unit_id IS NOT NULL / uq_budget_targets_network WHERE unit_id IS NULL) — PostgREST
 *   .upsert(onConflict:) não consegue resolver um índice parcial como arbiter. Usamos o
 *   padrão explícito UPDATE (com .is/.eq no unit_id) → INSERT condicional se 0 linhas.
 *
 * Decisions encoded:
 *   D-12/D-13: meta por conta contábil + unidade, 12 valores mensais editáveis em bloco.
 *   D-14: write gate = admin/socio/superadmin.
 *   D-15: semáforo de desvio via budgetDeviationSemaphore (src/lib/financeiro/dre-math.ts).
 *   D-17: copyBudgetFromPreviousYear clona valores de ano-1 → ano (pulando meses travados).
 *   D-18: mês passado (fuso SP) é travado para edição; mês atual e futuros permanecem editáveis.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { budgetTargetSchema } from '@/lib/financeiro/budget-schema'
import { budgetDeviationSemaphore, type DeviationSemaphore } from '@/lib/financeiro/dre-math'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

const BUDGET_WRITE_ROLES = ['admin', 'socio', 'superadmin'] as const

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

// ─── Helper: Orçamento role gate (T-19-08, D-14) ─────────────────────────────

async function requireBudgetActor(): Promise<{ actor: Actor } | { error: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return actorResult
  }
  const { actor } = actorResult
  if (!(BUDGET_WRITE_ROLES as readonly string[]).includes(actor.role)) {
    return { error: 'Permissão insuficiente para acessar o orçamento' }
  }
  return { actor }
}

// ─── currentMonthSP / isMonthLocked — pure, injectable-`now` (D-18) ─────────
// Brasil não observa horário de verão desde 2019 — America/Sao_Paulo é UTC-3 fixo
// (mirrors saoPauloDayBoundsUTC em src/lib/agents/stock-agent.ts).
// Exported async — every top-level export of a 'use server' file must be an async
// function (D-141/D-142/D-143 precedent); mirrors resolveDreCostCenterFilter/
// computeYoyAvailability em src/actions/dre.ts.

const SP_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3 fixo (sem DST)

export async function currentMonthSP(now: Date = new Date()): Promise<{ ano: number; mes: number }> {
  const spWallClock = new Date(now.getTime() - SP_OFFSET_MS)
  return { ano: spWallClock.getUTCFullYear(), mes: spWallClock.getUTCMonth() + 1 }
}

/**
 * isMonthLocked — true quando (ano, mes) é estritamente ANTERIOR ao mês corrente em
 * fuso SP. Mês atual e meses futuros → false (editáveis).
 */
export async function isMonthLocked(ano: number, mes: number, now: Date = new Date()): Promise<boolean> {
  const current = await currentMonthSP(now)
  if (ano < current.ano) return true
  if (ano > current.ano) return false
  return mes < current.mes
}

// ─── computeBudgetCell — pure per-cell shaping (D-15/D-18), injectable `now` ─
// Combines the month-lock decision with the deviation semaphore — the exact shape
// the Orçamento grid (Plan 11) renders per account/month cell.

export interface BudgetVsRealizadoCell {
  mes: number
  meta: number
  realizado: number
  semaphore: DeviationSemaphore
  locked: boolean
}

export async function computeBudgetCell(
  meta: number,
  realizado: number,
  ano: number,
  mes: number,
  now: Date = new Date()
): Promise<BudgetVsRealizadoCell> {
  return {
    mes,
    meta,
    realizado,
    semaphore: budgetDeviationSemaphore(realizado, meta),
    locked: await isMonthLocked(ano, mes, now),
  }
}

// ─── Shared: explicit UPDATE→INSERT upsert against the partial unique index ──
// (mirrors saveAiAgentConfig em src/actions/ai-agent-config.ts)

async function upsertBudgetTargetRow(
  supabase: SupabaseClient,
  params: {
    clinicId: string
    accountId: string
    unitId: string | null
    ano: number
    mes: number
    valor: number
    actorId: string
  }
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString()

  let updateQuery = supabase
    .from('budget_targets')
    .update({ valor: params.valor, updated_at: now })
    .eq('clinic_id', params.clinicId)
    .eq('account_id', params.accountId)
    .eq('ano', params.ano)
    .eq('mes', params.mes)

  updateQuery = params.unitId
    ? updateQuery.eq('unit_id', params.unitId)
    : updateQuery.is('unit_id', null)

  const { data: updated, error: updateError } = await updateQuery.select('id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from('budget_targets').insert({
      clinic_id: params.clinicId,
      unit_id: params.unitId,
      account_id: params.accountId,
      ano: params.ano,
      mes: params.mes,
      valor: params.valor,
      created_by: params.actorId,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  return { success: true }
}

// ─── listBudgetTargets ────────────────────────────────────────────────────────
// D-12/D-13: metas do ano agrupadas por conta contábil, com os 12 valores mensais.

export interface BudgetTargetMonthRow {
  mes: number
  valor: number
  locked: boolean
}

export interface BudgetTargetAccountRow {
  accountId: string
  accountName: string
  meses: BudgetTargetMonthRow[]
}

export async function listBudgetTargets(params: {
  ano: number
  unitId?: string
}): Promise<{ success: boolean; targets?: BudgetTargetAccountRow[]; error?: string }> {
  const actorResult = await requireBudgetActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('budget_targets')
    .select('account_id, mes, valor, chart_of_accounts(name)')
    .eq('ano', params.ano)

  query = params.unitId ? query.eq('unit_id', params.unitId) : query.is('unit_id', null)

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  type AccountJoin = { name: string }
  const grouped = new Map<string, BudgetTargetAccountRow>()

  for (const row of (data ?? []) as Array<{
    account_id: string
    mes: number
    valor: number
    chart_of_accounts: AccountJoin | AccountJoin[] | null
  }>) {
    const acctJoin = row.chart_of_accounts
    const acctName = (Array.isArray(acctJoin) ? acctJoin[0]?.name : acctJoin?.name) ?? ''

    if (!grouped.has(row.account_id)) {
      grouped.set(row.account_id, { accountId: row.account_id, accountName: acctName, meses: [] })
    }

    grouped.get(row.account_id)!.meses.push({
      mes: row.mes,
      valor: row.valor,
      locked: await isMonthLocked(params.ano, row.mes),
    })
  }

  return { success: true, targets: Array.from(grouped.values()) }
}

// ─── saveBudgetTargets ────────────────────────────────────────────────────────
// D-13: 12 valores mensais em bloco. D-18: meses travados são PULADOS (skip), nunca
// rejeitam o save inteiro. D-14: gate admin/socio/superadmin.

export async function saveBudgetTargets(input: {
  accountId: string
  unitId?: string | null
  ano: number
  meses: { mes: number; valor: number }[]
}): Promise<{ success: boolean; saved?: number; skipped?: number; error?: string }> {
  // 1. Validate
  const parsed = budgetTargetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate (T-19-08, D-14)
  const actorResult = await requireBudgetActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  let saved = 0
  let skipped = 0

  for (const m of data.meses) {
    // T-19-01/D-18: skip locked past months — never reject the whole save.
    if (await isMonthLocked(data.ano, m.mes)) {
      skipped++
      continue
    }

    const result = await upsertBudgetTargetRow(supabase, {
      clinicId: actor.tenant_id,
      accountId: data.accountId,
      unitId: data.unitId ?? null,
      ano: data.ano,
      mes: m.mes,
      valor: m.valor,
      actorId: actor.id,
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }
    saved++
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'budget_target.saved',
    details: { account_id: data.accountId, unit_id: data.unitId ?? null, ano: data.ano, saved, skipped },
  })

  return { success: true, saved, skipped }
}

// ─── copyBudgetFromPreviousYear ───────────────────────────────────────────────
// D-17: clona todos os budget_targets de ano-1 (mesmo escopo de unidade) para ano,
// pulando meses travados no ano de destino (na prática, ano de destino costuma ser
// futuro/atual inteiro — o skip só entra em jogo em cenários de retroatividade).

export async function copyBudgetFromPreviousYear(params: {
  ano: number
  unitId?: string
}): Promise<{ success: boolean; copied?: number; skipped?: number; error?: string }> {
  if (!Number.isInteger(params.ano) || params.ano < 2020 || params.ano > 2100) {
    return { success: false, error: 'Ano inválido' }
  }

  const actorResult = await requireBudgetActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  let sourceQuery = supabase
    .from('budget_targets')
    .select('account_id, mes, valor')
    .eq('ano', params.ano - 1)

  sourceQuery = params.unitId ? sourceQuery.eq('unit_id', params.unitId) : sourceQuery.is('unit_id', null)

  const { data: sourceRows, error: sourceError } = await sourceQuery

  if (sourceError) {
    return { success: false, error: sourceError.message }
  }

  let copied = 0
  let skipped = 0

  for (const row of (sourceRows ?? []) as Array<{ account_id: string; mes: number; valor: number }>) {
    if (await isMonthLocked(params.ano, row.mes)) {
      skipped++
      continue
    }

    const result = await upsertBudgetTargetRow(supabase, {
      clinicId: actor.tenant_id,
      accountId: row.account_id,
      unitId: params.unitId ?? null,
      ano: params.ano,
      mes: row.mes,
      valor: row.valor,
      actorId: actor.id,
    })

    if (result.success) {
      copied++
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'budget_target.copied_from_previous_year',
    details: { ano: params.ano, unit_id: params.unitId ?? null, copied, skipped },
  })

  return { success: true, copied, skipped }
}

// ─── getBudgetVsRealizado ─────────────────────────────────────────────────────
// D-15/D-16: orçado×realizado por conta/mês com semáforo. Realizado calculado em
// tempo real a partir de financial_transactions — mesma resolução unidade→centro de
// custo da DRE (mirrors src/actions/dre.ts / listTransactions em transactions.ts).

export interface BudgetVsRealizadoRow {
  accountId: string
  accountName: string
  meses: BudgetVsRealizadoCell[]
}

export async function getBudgetVsRealizado(params: {
  ano: number
  unitId?: string
}): Promise<{ success: boolean; rows?: BudgetVsRealizadoRow[]; error?: string }> {
  const actorResult = await requireBudgetActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  // 1. Metas do ano (mesmo escopo de unidade — D-12)
  let budgetQuery = supabase
    .from('budget_targets')
    .select('account_id, mes, valor, chart_of_accounts(name)')
    .eq('ano', params.ano)

  budgetQuery = params.unitId ? budgetQuery.eq('unit_id', params.unitId) : budgetQuery.is('unit_id', null)

  const { data: budgetRows, error: budgetError } = await budgetQuery
  if (budgetError) {
    return { success: false, error: budgetError.message }
  }

  type AccountJoin = { name: string }
  const grouped = new Map<string, { accountName: string; metas: Map<number, number> }>()

  for (const row of (budgetRows ?? []) as Array<{
    account_id: string
    mes: number
    valor: number
    chart_of_accounts: AccountJoin | AccountJoin[] | null
  }>) {
    const acctJoin = row.chart_of_accounts
    const acctName = (Array.isArray(acctJoin) ? acctJoin[0]?.name : acctJoin?.name) ?? ''

    if (!grouped.has(row.account_id)) {
      grouped.set(row.account_id, { accountName: acctName, metas: new Map() })
    }
    grouped.get(row.account_id)!.metas.set(row.mes, row.valor)
  }

  // 2. Resolve unidade → centro(s) de custo (mirrors loadCostCenterIdsForUnit em dre.ts)
  let costCenterIds: string[] | null = null
  if (params.unitId) {
    const { data: ccs } = await supabase.from('cost_centers').select('id').eq('unit_id', params.unitId)
    costCenterIds = ((ccs ?? []) as { id: string }[]).map((cc) => cc.id)
  }

  // 3. Realizado do ano inteiro a partir de financial_transactions (D-10)
  const from = `${params.ano}-01-01`
  const to = `${params.ano}-12-31`

  let txRows: Array<{ account_id: string | null; amount: number; transaction_date: string }> = []

  if (costCenterIds === null || costCenterIds.length > 0) {
    let txQuery = supabase
      .from('financial_transactions')
      .select('account_id, amount, transaction_date')
      .gte('transaction_date', from)
      .lte('transaction_date', to)

    if (costCenterIds !== null) {
      txQuery = txQuery.in('cost_center_id', costCenterIds)
    }

    const { data, error } = await txQuery
    if (error) {
      return { success: false, error: error.message }
    }
    txRows = (data ?? []) as typeof txRows
  }
  // costCenterIds !== null && costCenterIds.length === 0 → unidade sem centros de custo,
  // realizado permanece 0 para todas as contas/meses (mirrors DRE mode:'empty').

  const realizadoMap = new Map<string, number>()
  for (const tx of txRows) {
    if (!tx.account_id) continue
    const mes = Number(tx.transaction_date.slice(5, 7))
    const key = `${tx.account_id}_${mes}`
    realizadoMap.set(key, (realizadoMap.get(key) ?? 0) + tx.amount)
  }

  // 4. Shape account rows × 12 meses, cada um com meta/realizado/semaphore/locked (D-15)
  const rows: BudgetVsRealizadoRow[] = []
  for (const [accountId, info] of grouped.entries()) {
    const meses: BudgetVsRealizadoCell[] = []
    for (let mes = 1; mes <= 12; mes++) {
      const meta = info.metas.get(mes) ?? 0
      const realizado = realizadoMap.get(`${accountId}_${mes}`) ?? 0
      meses.push(await computeBudgetCell(meta, realizado, params.ano, mes))
    }
    rows.push({ accountId, accountName: info.accountName, meses })
  }

  return { success: true, rows }
}
