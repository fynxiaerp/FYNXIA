// src/lib/agents/bi-forecast-agent.ts
// BI-02 — Nightly forecast/alert agent (D-31/D-33/D-34/D-36).
//
// Per-clinic entry point: runBiForecastForClinic({ clinicId, unitId? }) computes
// monthly trend series (receita/margem), evaluates budget deviation per account,
// KPI-off-target vs kpi_targets, and payment-delay snapshots, then writes bi_alerts
// rows for the "Alertas & Previsões" panel (Plan 13).
//
// GOVERNANCE (D-34, Plan 02 governance guard):
//   The agent NEVER mutates budget_targets directly. When a budget deviation is
//   PERSISTENT (≥2 consecutive evaluated months all non-'verde'), it calls
//   withAgentPolicy with the REAL per-clinic clinicId (never null/aggregate,
//   mirrors stock-agent.ts/collection-agent.ts) and — inside the governed
//   callback — inserts an approval_requests row (type='ai_action',
//   agent_key='bi_forecast', payload carries the suggested new value). The actual
//   budget_targets UPDATE happens ONLY in approveBudgetAdjustment
//   (src/actions/approval-actions.ts) after a human approves.
//
// D-32: trend forecasting (revenue_decline) requires >= 3 monthly points;
//   below that computeLinearTrend.insufficientData is true and no forecast
//   alert is emitted for that series (current KPIs remain visible via the
//   panel's independent getBiKpis/listBiAlerts reads — Plan 07/13).
//
// LLM narrative (T-19-13): generateBiNarrative sends ONLY numbers + kpi_key +
//   clinic display name to the LLM (no patient/financial-row PII), mirrors
//   collection-agent.ts's buildCollectionMessage. When AI_GATEWAY_API_KEY is
//   absent, a static neutral pt-BR narrative is used instead (D-02: read at
//   call-time, never module scope).
//
// DEDUP: bi_alerts has no daily unique index (unlike stock_alerts) — insertBiAlert
// does a simple same-day pre-check (SELECT before INSERT) per clinic+kpi_key+
// trigger_type, per the plan's "simple pre-check on today's rows" instruction.
import 'server-only'

import { generateText } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAgentPolicy } from '@/lib/ai/policy'
import { logBusinessEvent } from '@/lib/audit'
import { computeLinearTrend, isDecliningVsTrend, type TrendPoint } from '@/lib/bi/forecast-math'
import { budgetDeviationSemaphore, type DeviationSemaphore } from '@/lib/financeiro/dre-math'

type AdminClient = ReturnType<typeof createAdminClient>

type AlertSeverity = 'info' | 'verde' | 'amarelo' | 'vermelho'
type TriggerType = 'budget_deviation' | 'revenue_decline' | 'kpi_off_target' | 'payment_delay'

// ─── Pure date helpers (no I/O — testable in isolation) ────────────────────────

/**
 * lastNMonthKeys — 'YYYY-MM' keys for the last n months INCLUDING the current
 * month, plus the ISO date of the first day of the earliest month (query lower
 * bound).
 */
function lastNMonthKeys(n: number, now: Date = new Date()): { fromISO: string; monthKeys: string[] } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const monthKeys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1))
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const fromISO = `${monthKeys[0]}-01`
  return { fromISO, monthKeys }
}

/** Simple UTC day bounds for the daily bi_alerts dedup pre-check. */
function todayBoundsUTC(now: Date = new Date()): { startUTC: string; endUTC: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { startUTC: start.toISOString(), endUTC: end.toISOString() }
}

// ─── generateBiNarrative — pt-BR LLM narrative with static fallback ───────────

function buildStaticNarrative(params: {
  kpiKey: string
  triggerType: TriggerType
  actualValue: number | null
}): string {
  switch (params.triggerType) {
    case 'revenue_decline':
      return `O indicador ${params.kpiKey} está abaixo da tendência histórica projetada.`
    case 'budget_deviation':
      return `Desvio orçamentário persistente identificado em ${params.kpiKey}.`
    case 'kpi_off_target':
      return `O indicador ${params.kpiKey} está abaixo da meta definida.`
    case 'payment_delay':
      return `Atraso de pagamentos identificado (${params.actualValue ?? 0} ocorrência(s) em aberto).`
    default:
      return `Alerta gerado para o indicador ${params.kpiKey}.`
  }
}

/**
 * generateBiNarrative — 1-2 sentence pt-BR alert narrative.
 *
 * Privacy (T-19-13): only numbers + kpi_key + clinic display name are sent to
 * the LLM — no patient/financial-row PII. If AI_GATEWAY_API_KEY is absent
 * (dev/test/UAT), returns a neutral static fallback so the agent remains
 * functional without the LLM dependency (mirrors collection-agent.ts).
 */
export async function generateBiNarrative(params: {
  clinicName: string
  kpiKey: string
  triggerType: TriggerType
  actualValue: number | null
  projectedValue: number | null
}): Promise<string> {
  // D-02 / Pitfall 2 — read at call-time (never module scope; protects next build)
  const apiKey = process.env.AI_GATEWAY_API_KEY
  const staticFallback = buildStaticNarrative(params)

  if (!apiKey) {
    return staticFallback
  }

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      system: `Você é um analista de BI de uma clínica odontológica.
Escreva 1-2 frases em português do Brasil, tom profissional e objetivo, explicando
um alerta de indicador de negócio.
REGRAS OBRIGATÓRIAS:
- Use apenas o nome da clínica, o indicador, o tipo de alerta e os valores fornecidos.
- Não inclua URL, link ou qualquer endereço web.
- Não invente informações adicionais além dos dados fornecidos.
- Máximo 2 frases.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Clínica: ${params.clinicName}. Indicador: ${params.kpiKey}. Tipo de alerta: ${params.triggerType}. Valor atual: ${params.actualValue ?? 'não disponível'}. Valor projetado/meta: ${params.projectedValue ?? 'não disponível'}.`,
            },
          ],
        },
      ],
      providerOptions: {
        gateway: {
          zeroDataRetention: true, // T-19-13: LGPD — no data retained by provider
        } satisfies GatewayProviderOptions,
      },
    })
    return text.trim()
  } catch (err) {
    // LLM failure must not block alert creation — fall back to static message
    console.error('[bi-forecast-agent] LLM narrative failed, using fallback:', err)
    return staticFallback
  }
}

// ─── resolveClinicName ──────────────────────────────────────────────────────

async function resolveClinicName(admin: AdminClient, clinicId: string): Promise<string> {
  const { data } = await admin.from('clinics').select('name').eq('id', clinicId).maybeSingle()
  return (data as { name?: string } | null)?.name ?? 'a clínica'
}

// ─── insertBiAlert — daily-dedup pre-check + insert ────────────────────────────

async function insertBiAlert(
  admin: AdminClient,
  params: {
    clinicId: string
    unitId: string | null
    kpiKey: string
    severity: AlertSeverity
    triggerType: TriggerType
    narrative: string
    projectedValue: number | null
    actualValue: number | null
    approvalRequestId?: string | null
  },
): Promise<boolean> {
  const { startUTC, endUTC } = todayBoundsUTC()

  try {
    const { data: existing, error: existingError } = await admin
      .from('bi_alerts')
      .select('id')
      .eq('clinic_id', params.clinicId)
      .eq('kpi_key', params.kpiKey)
      .eq('trigger_type', params.triggerType)
      .gte('created_at', startUTC)
      .lt('created_at', endUTC)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error('[bi-forecast-agent] insertBiAlert: failed to check existing alert:', existingError.message)
    }

    if (existing) {
      return false // already alerted today for this clinic+kpi+trigger — idempotent no-op
    }

    const { error: insertError } = await admin.from('bi_alerts').insert({
      clinic_id: params.clinicId,
      unit_id: params.unitId,
      kpi_key: params.kpiKey,
      severity: params.severity,
      trigger_type: params.triggerType,
      narrative: params.narrative,
      projected_value: params.projectedValue,
      actual_value: params.actualValue,
      approval_request_id: params.approvalRequestId ?? null,
    })

    if (insertError) {
      console.error('[bi-forecast-agent] insertBiAlert: insert failed:', insertError.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[bi-forecast-agent] insertBiAlert: unexpected error:', err)
    return false
  }
}

// ─── loadMonthlySum — monthly financial_transactions aggregation ──────────────
// financial_transactions has NO unit_id column (tenant column is `tenant_id`,
// mirrors dre.ts) — unit filtering resolves cost_center_ids for the unit first.

async function resolveCostCenterIds(admin: AdminClient, unitId: string | null): Promise<string[] | null> {
  if (!unitId) return null
  const { data } = await admin.from('cost_centers').select('id').eq('unit_id', unitId)
  return ((data ?? []) as Array<{ id: string }>).map((c) => c.id)
}

async function loadMonthlySum(
  admin: AdminClient,
  clinicId: string,
  unitId: string | null,
  type: 'receita' | 'despesa',
  months: number,
  costCenterIds: string[] | null,
): Promise<TrendPoint[]> {
  const { fromISO, monthKeys } = lastNMonthKeys(months)
  const todayISO = new Date().toISOString().slice(0, 10)

  if (costCenterIds !== null && costCenterIds.length === 0) {
    return monthKeys.map((m) => ({ month: m, value: 0 }))
  }

  let query = admin
    .from('financial_transactions')
    .select('amount, transaction_date')
    .eq('tenant_id', clinicId)
    .eq('type', type)
    .gte('transaction_date', fromISO)
    .lte('transaction_date', todayISO)

  if (costCenterIds !== null) {
    query = query.in('cost_center_id', costCenterIds)
  }

  const { data, error } = await query
  if (error) {
    console.error(`[bi-forecast-agent] loadMonthlySum(${type}) failed:`, error.message)
    return monthKeys.map((m) => ({ month: m, value: 0 }))
  }

  const sums = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ amount: number; transaction_date: string }>) {
    const key = row.transaction_date.slice(0, 7)
    sums.set(key, (sums.get(key) ?? 0) + row.amount)
  }

  return monthKeys.map((m) => ({ month: m, value: sums.get(m) ?? 0 }))
}

// ─── evaluateRevenueDecline — receita/margem trend vs D-32/D-33 ───────────────

async function evaluateRevenueDecline(
  admin: AdminClient,
  clinicId: string,
  unitId: string | null,
  clinicName: string,
  costCenterIds: string[] | null,
): Promise<number> {
  let created = 0

  const receitaSeries = await loadMonthlySum(admin, clinicId, unitId, 'receita', 12, costCenterIds)
  const despesaSeries = await loadMonthlySum(admin, clinicId, unitId, 'despesa', 12, costCenterIds)

  const margemSeries: TrendPoint[] = receitaSeries.map((r, i) => {
    const despesa = despesaSeries[i]?.value ?? 0
    const margem = r.value === 0 ? 0 : (r.value - despesa) / r.value
    return { month: r.month, value: margem }
  })

  const trackedSeries: Array<{ kpiKey: string; series: TrendPoint[] }> = [
    { kpiKey: 'receita', series: receitaSeries },
    { kpiKey: 'margem', series: margemSeries },
  ]

  for (const { kpiKey, series } of trackedSeries) {
    // D-32: fewer than 3 points → skip, no forecast alert.
    if (series.length < 3) continue

    const trend = computeLinearTrend(series)
    if (trend.insufficientData) continue

    const last = series.at(-1)
    if (!last) continue

    if (!isDecliningVsTrend(last.value, trend.projectedNext)) continue

    const deviationPct =
      trend.projectedNext > 0 ? ((trend.projectedNext - last.value) / trend.projectedNext) * 100 : 0
    const severity: AlertSeverity = deviationPct > 30 ? 'vermelho' : 'amarelo'

    const narrative = await generateBiNarrative({
      clinicName,
      kpiKey,
      triggerType: 'revenue_decline',
      actualValue: last.value,
      projectedValue: trend.projectedNext,
    })

    const inserted = await insertBiAlert(admin, {
      clinicId,
      unitId,
      kpiKey,
      severity,
      triggerType: 'revenue_decline',
      narrative,
      projectedValue: trend.projectedNext,
      actualValue: last.value,
    })

    if (inserted) created++
  }

  return created
}

// ─── evaluateBudgetDeviations — per-account semaphore + D-34 governed suggestion

interface BudgetTargetRow {
  id: string
  account_id: string
  mes: number
  valor: number
  chart_of_accounts: { name: string } | { name: string }[] | null
}

function accountNameFromJoin(join: BudgetTargetRow['chart_of_accounts'], fallback: string): string {
  const acct = Array.isArray(join) ? join[0] : join
  return acct?.name ?? fallback
}

/**
 * createBudgetSuggestion — the D-34 side effect for a persistent budget deviation:
 * inserts an approval_requests row (NEVER writes budget_targets directly — the
 * mutation happens only in approveBudgetAdjustment after a human approves), links
 * it to a bi_alerts row (D-35), and writes the audit log entry.
 *
 * Called from evaluateBudgetDeviations either as withAgentPolicy's originalExecute
 * (decision === 'execute') or directly by the caller (decision === 'suggest' |
 * 'pending_approval') — see CR-01 fix: this suggestion must fire regardless of the
 * configured autonomy level, matching the D-34/D-35 design intent.
 */
async function createBudgetSuggestion(
  admin: AdminClient,
  params: {
    clinicId: string
    unitId: string | null
    accountId: string
    accountName: string
    targetRow: BudgetTargetRow
    currentYear: number
    monthsEvaluated: number
    suggestedValue: number
    severity: DeviationSemaphore
    realizado: number
    meta: number
    narrative: string
  },
): Promise<boolean> {
  const { clinicId, unitId, accountId, accountName, targetRow, currentYear, monthsEvaluated, suggestedValue, severity, realizado, meta, narrative } =
    params

  const { data: approval, error: approvalError } = await admin
    .from('approval_requests')
    .insert({
      clinic_id: clinicId,
      type: 'ai_action',
      agent_key: 'bi_forecast',
      payload: {
        budget_target_id: targetRow.id,
        month: `${currentYear}-${String(targetRow.mes).padStart(2, '0')}`,
        current_value: targetRow.valor,
        suggested_value: suggestedValue,
        reason: `Desvio orçamentário persistente em ${accountName}: realizado médio dos últimos ${monthsEvaluated} meses diverge da meta atual.`,
      },
      required_role: 'admin',
      requested_by: null, // ator de sistema (approval_requests.requested_by nullable — 20260703000200_estoque_alters.sql)
      status: 'pending',
    })
    .select('id')
    .single()

  if (approvalError || !approval) {
    console.error('[bi-forecast-agent] Failed to create approval_request:', approvalError?.message)
    return false
  }

  const inserted = await insertBiAlert(admin, {
    clinicId,
    unitId,
    kpiKey: accountName,
    severity,
    triggerType: 'budget_deviation',
    narrative,
    projectedValue: meta,
    actualValue: realizado,
    approvalRequestId: approval.id, // D-35: concrete action → panel links to ApprovalInbox
  })

  await logBusinessEvent({
    tenantId: clinicId,
    actorId: null,
    action: 'agent.bi.budget_adjustment_suggested',
    details: { account_id: accountId, budget_target_id: targetRow.id, suggested_value: suggestedValue },
  })

  return inserted
}

async function evaluateBudgetDeviations(
  admin: AdminClient,
  clinicId: string,
  unitId: string | null,
  clinicName: string,
  costCenterIds: string[] | null,
): Promise<number> {
  let created = 0

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  let budgetQuery = admin
    .from('budget_targets')
    .select('id, account_id, mes, valor, chart_of_accounts(name)')
    .eq('clinic_id', clinicId)
    .eq('ano', currentYear)

  budgetQuery = unitId ? budgetQuery.eq('unit_id', unitId) : budgetQuery.is('unit_id', null)

  const { data: budgetRows, error: budgetError } = await budgetQuery
  if (budgetError) {
    console.error('[bi-forecast-agent] evaluateBudgetDeviations: failed to load budget_targets:', budgetError.message)
    return 0
  }
  if (!budgetRows || budgetRows.length === 0) return 0

  const byAccount = new Map<string, BudgetTargetRow[]>()
  for (const row of budgetRows as BudgetTargetRow[]) {
    if (row.mes > currentMonth) continue // only months up to now — future targets have no realizado yet
    const list = byAccount.get(row.account_id) ?? []
    list.push(row)
    byAccount.set(row.account_id, list)
  }

  for (const [accountId, rows] of byAccount.entries()) {
    const evaluated = [...rows].sort((a, b) => a.mes - b.mes).slice(-3) // last up to 3 evaluated months
    if (evaluated.length === 0) continue

    const monthly: Array<{ mes: number; meta: number; realizado: number; semaphore: DeviationSemaphore }> = []

    for (const row of evaluated) {
      const from = `${currentYear}-${String(row.mes).padStart(2, '0')}-01`
      const to = new Date(Date.UTC(currentYear, row.mes, 0)).toISOString().slice(0, 10) // last day of month

      let txQuery = admin
        .from('financial_transactions')
        .select('amount')
        .eq('tenant_id', clinicId)
        .eq('account_id', accountId)
        .gte('transaction_date', from)
        .lte('transaction_date', to)

      if (costCenterIds !== null) txQuery = txQuery.in('cost_center_id', costCenterIds)

      const { data: txRows } = await txQuery
      const realizado = ((txRows ?? []) as Array<{ amount: number }>).reduce((sum, t) => sum + t.amount, 0)

      monthly.push({ mes: row.mes, meta: row.valor, realizado, semaphore: budgetDeviationSemaphore(realizado, row.valor) })
    }

    const last = monthly.at(-1)
    if (!last || last.semaphore === 'verde') continue

    const accountName = accountNameFromJoin(evaluated.at(-1)!.chart_of_accounts, accountId)
    const persistent = monthly.length >= 2 && monthly.every((s) => s.semaphore !== 'verde')

    const narrative = await generateBiNarrative({
      clinicName,
      kpiKey: accountName,
      triggerType: 'budget_deviation',
      actualValue: last.realizado,
      projectedValue: last.meta,
    })

    if (!persistent) {
      const inserted = await insertBiAlert(admin, {
        clinicId,
        unitId,
        kpiKey: accountName,
        severity: last.semaphore,
        triggerType: 'budget_deviation',
        narrative,
        projectedValue: last.meta,
        actualValue: last.realizado,
      })
      if (inserted) created++
      continue
    }

    // D-34: PERSISTENT deviation → per-clinic governed suggestion via approval_requests.
    // withAgentPolicy is called with the REAL clinicId (never null/aggregate) —
    // satisfies the Plan 02 governance guard.
    const targetRow = evaluated.at(-1)!
    const suggestedValue =
      Math.round((monthly.reduce((sum, m) => sum + m.realizado, 0) / monthly.length) * 100) / 100

    const createSuggestion = () =>
      createBudgetSuggestion(admin, {
        clinicId,
        unitId,
        accountId,
        accountName,
        targetRow,
        currentYear,
        monthsEvaluated: monthly.length,
        suggestedValue,
        severity: last.semaphore,
        realizado: last.realizado,
        meta: last.meta,
        narrative,
      })

    const govResult = await withAgentPolicy(
      {
        clinicId,
        agentKey: 'bi_forecast',
        actorId: null, // ator de sistema — cron sem sessão de usuário
        action: 'agent.bi.suggest_budget_adjustment',
        actionSensitivity: 'reversible', // sugestão é reversível — rejeitável na aprovação
      },
      // Only invoked when the policy decision resolves to 'execute' (e.g. L2+).
      // NEVER writes directly to budget_targets here — only approval_requests.
      createSuggestion,
    )

    let suggestionCreated = false
    if (typeof govResult === 'boolean') {
      // decision === 'execute' — originalExecute() already ran createSuggestion() above.
      suggestionCreated = govResult
    } else if (govResult._policy === 'suggest' || govResult._policy === 'pending_approval') {
      // D-34/D-35: a persistent deviation ALWAYS routes through approval_requests
      // regardless of the configured autonomy level (as long as the agent isn't
      // disabled/blocked) — withAgentPolicy above only gates the disabled/'block'
      // case and writes the audit trail; the suggestion itself is created here.
      suggestionCreated = await createSuggestion()
    }
    // decision === 'block' (agent disabled or unknown level) → no suggestion created.

    if (suggestionCreated) created++
  }

  return created
}

// ─── evaluateKpiOffTargets — consultas_mes / ticket_medio vs kpi_targets meta ──

async function loadKpiTargetMap(admin: AdminClient, clinicId: string, unitId: string | null): Promise<Map<string, number>> {
  let query = admin.from('kpi_targets').select('kpi_key, meta_valor').eq('clinic_id', clinicId)
  query = unitId ? query.eq('unit_id', unitId) : query.is('unit_id', null)

  const { data } = await query
  const map = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ kpi_key: string; meta_valor: number }>) {
    map.set(row.kpi_key, row.meta_valor)
  }
  return map
}

async function evaluateKpiOffTargets(
  admin: AdminClient,
  clinicId: string,
  unitId: string | null,
  clinicName: string,
  costCenterIds: string[] | null,
): Promise<number> {
  let created = 0

  const { fromISO } = lastNMonthKeys(1)
  const todayISO = new Date().toISOString().slice(0, 10)

  const metaMap = await loadKpiTargetMap(admin, clinicId, unitId)
  if (metaMap.size === 0) return 0 // no metas configured — nothing to compare against

  let apptQuery = admin
    .from('appointments')
    .select('id, status')
    .eq('tenant_id', clinicId)
    .gte('start_time', fromISO)
    .lte('start_time', todayISO)

  if (unitId) apptQuery = apptQuery.eq('unit_id', unitId)

  const { data: apptRows } = await apptQuery
  const concluidos = ((apptRows ?? []) as Array<{ status: string }>).filter((r) => r.status === 'concluido').length

  const consultasMeta = metaMap.get('consultas_mes')
  if (consultasMeta !== undefined && isDecliningVsTrend(concluidos, consultasMeta)) {
    const narrative = await generateBiNarrative({
      clinicName,
      kpiKey: 'consultas_mes',
      triggerType: 'kpi_off_target',
      actualValue: concluidos,
      projectedValue: consultasMeta,
    })
    const inserted = await insertBiAlert(admin, {
      clinicId,
      unitId,
      kpiKey: 'consultas_mes',
      severity: 'amarelo',
      triggerType: 'kpi_off_target',
      narrative,
      projectedValue: consultasMeta,
      actualValue: concluidos,
    })
    if (inserted) created++
  }

  const ticketMeta = metaMap.get('ticket_medio')
  if (ticketMeta !== undefined && concluidos > 0) {
    const receitaMesSeries = await loadMonthlySum(admin, clinicId, unitId, 'receita', 1, costCenterIds)
    const receitaMes = receitaMesSeries.at(-1)?.value ?? 0
    const ticketMedio = receitaMes / concluidos

    if (isDecliningVsTrend(ticketMedio, ticketMeta)) {
      const narrative = await generateBiNarrative({
        clinicName,
        kpiKey: 'ticket_medio',
        triggerType: 'kpi_off_target',
        actualValue: ticketMedio,
        projectedValue: ticketMeta,
      })
      const inserted = await insertBiAlert(admin, {
        clinicId,
        unitId,
        kpiKey: 'ticket_medio',
        severity: 'amarelo',
        triggerType: 'kpi_off_target',
        narrative,
        projectedValue: ticketMeta,
        actualValue: ticketMedio,
      })
      if (inserted) created++
    }
  }

  return created
}

// ─── evaluatePaymentDelay — overdue receivables snapshot ───────────────────────

async function evaluatePaymentDelay(
  admin: AdminClient,
  clinicId: string,
  unitId: string | null,
  clinicName: string,
): Promise<number> {
  const todayISO = new Date().toISOString().slice(0, 10)

  let query = admin
    .from('receivables')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', clinicId)
    .eq('status', 'pendente')
    .lt('due_date', todayISO)

  if (unitId) query = query.eq('unit_id', unitId)

  const { count } = await query
  const overdueCount = count ?? 0
  if (overdueCount === 0) return 0

  const severity: AlertSeverity = overdueCount > 5 ? 'vermelho' : 'amarelo'

  const narrative = await generateBiNarrative({
    clinicName,
    kpiKey: 'atraso_pagamento',
    triggerType: 'payment_delay',
    actualValue: overdueCount,
    projectedValue: null,
  })

  const inserted = await insertBiAlert(admin, {
    clinicId,
    unitId,
    kpiKey: 'atraso_pagamento',
    severity,
    triggerType: 'payment_delay',
    narrative,
    projectedValue: null,
    actualValue: overdueCount,
  })

  return inserted ? 1 : 0
}

// ─── runBiForecastForClinic ─────────────────────────────────────────────────
// BI-02 main entry point — called once per active clinic by the nightly cron
// (src/app/api/cron/bi-previsoes/route.ts, D-36).

export async function runBiForecastForClinic(params: {
  clinicId: string
  unitId?: string | null
}): Promise<{ alertsCreated: number }> {
  const clinicId = params.clinicId
  const unitId = params.unitId ?? null

  const admin: AdminClient = createAdminClient()
  const clinicName = await resolveClinicName(admin, clinicId)
  const costCenterIds = await resolveCostCenterIds(admin, unitId)

  let alertsCreated = 0

  alertsCreated += await evaluateRevenueDecline(admin, clinicId, unitId, clinicName, costCenterIds)
  alertsCreated += await evaluateBudgetDeviations(admin, clinicId, unitId, clinicName, costCenterIds)
  alertsCreated += await evaluateKpiOffTargets(admin, clinicId, unitId, clinicName, costCenterIds)
  alertsCreated += await evaluatePaymentDelay(admin, clinicId, unitId, clinicName)

  return { alertsCreated }
}
