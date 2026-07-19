'use server'
/**
 * src/actions/bi-kpis.ts — getBiKpis: multi-dimension KPI aggregation (BI-01, Plan 19-07).
 *
 * Feeds the BI dashboard (Plan 13): 4 dimensions — Operacional, Profissionais, CRC,
 * Estoque/TISS (D-29/D-38) — each numeric KPI attached to its kpi_targets meta (D-30)
 * with atingimento = atual/meta.
 *
 * SECURITY (T-19-01, D-39):
 *   Gated to admin/socio/superadmin, mirrors DRE_ROLES in dre.ts / KPI_READ_ROLES in
 *   kpi-targets.ts — enforced here in addition to RLS (defense-in-depth, financial +
 *   operational data is sensitive).
 *
 * DATA SOURCES (verified against migrations — 19-RESEARCH):
 *   - operacional: appointments (unit_id NOT NULL column) + financial_transactions
 *     (unit scoping via cost_centers, mirrors listTransactions in transactions.ts).
 *     No capacity/working-hours table exists yet — ocupacao is a pragmatic proxy:
 *     booked appointments ÷ (distinct active dentists in period × business days ×
 *     OCCUPANCY_SLOTS_PER_DAY assumed 8). Documented business assumption (no
 *     capacity source exists to derive a stricter number from).
 *   - profissionais: service_order_items (professional_id, valor_total) joined to
 *     service_orders (status='faturada', unit_id, faturada_at) + professionals (nome).
 *   - crc: reuses Phase 18 aggregation actions (getNpsSummary/getRoiByCampaign/
 *     getRoiByOrigin) rather than recomputing from scratch (RESEARCH interfaces note).
 *   - estoque_tiss: stock_alerts (tipo='minimo', resolvido=false), tiss_guide_items
 *     (valor_glosado ÷ valor_total), payable_installments + receivables
 *     (due_date < today AND status='pendente' = atraso).
 *
 * Every numeric KPI ships with a label — Copywriting Contract, never a bare number.
 * Missing/empty sources return 0/null gracefully (no throw) — Task 2 acceptance.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getNpsSummary } from '@/actions/nps'
import { getRoiByCampaign, getRoiByOrigin } from '@/actions/roi'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

export const BI_KPI_READ_ROLES = ['admin', 'socio', 'superadmin'] as const

export interface KpiValue {
  key: string
  label: string
  valor: number | null
  meta: number | null
  atingimento: number | null
}

export interface ProfessionalKpiRow {
  professionalId: string
  nome: string
  faturamento: number
  procedimentos: number
}

export interface BiKpis {
  operacional: {
    ocupacao: KpiValue
    ticket_medio: KpiValue
    consultas_mes: KpiValue
  }
  profissionais: ProfessionalKpiRow[]
  crc: {
    nps: KpiValue
    cpl: KpiValue
    cac: KpiValue
    conversao_leads: KpiValue
  }
  estoque_tiss: {
    alertas_minimo: KpiValue
    glosa_taxa: KpiValue
    atraso_pagamento: KpiValue
  }
}

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

// ─── Helper: kpi_targets meta lookup (D-30) ──────────────────────────────────
// Mirrors budget_targets/kpi_targets read scoping used in budget-targets.ts /
// kpi-targets.ts: unit-specific row when unitId given, else the consolidado/rede row.

async function loadKpiTargetsMap(
  supabase: SupabaseClient,
  clinicId: string,
  unitId?: string
): Promise<Map<string, number>> {
  let query = supabase.from('kpi_targets').select('kpi_key, meta_valor').eq('clinic_id', clinicId)
  query = unitId ? query.eq('unit_id', unitId) : query.is('unit_id', null)

  const { data } = await query

  const map = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ kpi_key: string; meta_valor: number }>) {
    map.set(row.kpi_key, row.meta_valor)
  }
  return map
}

function attachMeta(key: string, label: string, valor: number | null, metaMap: Map<string, number>): KpiValue {
  const meta = metaMap.get(key) ?? null
  const atingimento = meta !== null && meta !== 0 && valor !== null ? valor / meta : null
  return { key, label, valor, meta, atingimento }
}

// ─── Helper: business days (Mon-Fri) between two YYYY-MM-DD dates, inclusive ──
// Pure UTC calendar-date arithmetic (mirrors priorCloseDate in partner-shares.ts) —
// avoids timezone drift on 'YYYY-MM-DD' strings.

function countBusinessDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const start = Date.UTC(fy ?? 1970, (fm ?? 1) - 1, fd ?? 1)
  const end = Date.UTC(ty ?? 1970, (tm ?? 1) - 1, td ?? 1)
  if (end < start) return 0

  let count = 0
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    const day = new Date(t).getUTCDay() // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) count++
  }
  return count
}

const OCCUPANCY_SLOTS_PER_DAY = 8 // assumed 1h slots over an 8h workday — no capacity table exists yet

// ─── computeOperacional (D-29) ────────────────────────────────────────────────

async function computeOperacional(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string,
  unitId: string | undefined,
  metaMap: Map<string, number>
): Promise<BiKpis['operacional']> {
  let apptQuery = supabase
    .from('appointments')
    .select('id, dentist_id, status')
    .eq('tenant_id', clinicId)
    .gte('start_time', from)
    .lte('start_time', to)

  if (unitId) apptQuery = apptQuery.eq('unit_id', unitId)

  const { data: apptRows } = await apptQuery

  const rows = (apptRows ?? []) as Array<{ id: string; dentist_id: string; status: string }>

  const bookedStatuses = new Set(['confirmado', 'em_atendimento', 'concluido'])
  const booked = rows.filter((r) => bookedStatuses.has(r.status)).length
  const concluidos = rows.filter((r) => r.status === 'concluido').length

  const activeDentists = new Set(
    rows.filter((r) => r.status !== 'cancelado').map((r) => r.dentist_id)
  ).size

  const businessDays = countBusinessDays(from, to)
  const capacity = activeDentists * businessDays * OCCUPANCY_SLOTS_PER_DAY
  const ocupacaoValor = capacity > 0 ? (booked / capacity) * 100 : null

  // Receita do período (D-08/Pitfall 3 pattern: unit filter via cost_centers, "todas"
  // includes NULL cost_center_id — mirrors listTransactions/getBudgetVsRealizado).
  let costCenterIds: string[] | null = null
  if (unitId) {
    const { data: ccs } = await supabase.from('cost_centers').select('id').eq('unit_id', unitId)
    costCenterIds = ((ccs ?? []) as { id: string }[]).map((cc) => cc.id)
  }

  let receita = 0
  if (costCenterIds === null || costCenterIds.length > 0) {
    let txQuery = supabase
      .from('financial_transactions')
      .select('amount')
      .eq('tenant_id', clinicId)
      .eq('type', 'receita')
      .gte('transaction_date', from)
      .lte('transaction_date', to)

    if (costCenterIds !== null) txQuery = txQuery.in('cost_center_id', costCenterIds)

    const { data: txRows } = await txQuery
    receita = ((txRows ?? []) as Array<{ amount: number }>).reduce((sum, t) => sum + t.amount, 0)
  }

  const ticketMedioValor = concluidos > 0 ? receita / concluidos : null

  return {
    ocupacao: attachMeta('ocupacao', 'Ocupação da agenda', ocupacaoValor, metaMap),
    ticket_medio: attachMeta('ticket_medio', 'Ticket médio', ticketMedioValor, metaMap),
    consultas_mes: attachMeta('consultas_mes', 'Consultas no período', concluidos, metaMap),
  }
}

// ─── computeProfissionais (D-29) ──────────────────────────────────────────────
// Faturamento/procedimentos por dentista — service_order_items.professional_id
// joined through service_orders (status='faturada', unit/período scope).

async function computeProfissionais(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string,
  unitId: string | undefined
): Promise<ProfessionalKpiRow[]> {
  let osQuery = supabase
    .from('service_orders')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('status', 'faturada')
    .gte('faturada_at', from)
    .lte('faturada_at', to)

  if (unitId) osQuery = osQuery.eq('unit_id', unitId)

  const { data: osRows } = await osQuery
  const osIds = ((osRows ?? []) as Array<{ id: string }>).map((r) => r.id)

  if (osIds.length === 0) return []

  const { data: itemRows } = await supabase
    .from('service_order_items')
    .select('professional_id, valor_total')
    .in('service_order_id', osIds)
    .not('professional_id', 'is', null)

  const items = (itemRows ?? []) as Array<{ professional_id: string | null; valor_total: number }>

  const byProfessional = new Map<string, { faturamento: number; procedimentos: number }>()
  for (const item of items) {
    if (!item.professional_id) continue
    const entry = byProfessional.get(item.professional_id) ?? { faturamento: 0, procedimentos: 0 }
    entry.faturamento += item.valor_total
    entry.procedimentos += 1
    byProfessional.set(item.professional_id, entry)
  }

  if (byProfessional.size === 0) return []

  const { data: professionalRows } = await supabase
    .from('professionals')
    .select('id, full_name')
    .in('id', Array.from(byProfessional.keys()))

  const nameMap = new Map<string, string>()
  for (const p of (professionalRows ?? []) as Array<{ id: string; full_name: string }>) {
    nameMap.set(p.id, p.full_name)
  }

  return Array.from(byProfessional.entries()).map(([professionalId, entry]) => ({
    professionalId,
    nome: nameMap.get(professionalId) ?? '—',
    faturamento: entry.faturamento,
    procedimentos: entry.procedimentos,
  }))
}

// ─── computeCrc (D-29) ────────────────────────────────────────────────────────
// Reuses Phase 18 aggregation actions rather than recomputing from scratch:
// nps_responses (via getNpsSummary), campaigns/payables (via getRoiByCampaign),
// leads (via getRoiByOrigin).

async function computeCrc(
  from: string,
  to: string,
  unitId: string | undefined,
  metaMap: Map<string, number>
): Promise<BiKpis['crc']> {
  const [npsResult, roiResult, originResult] = await Promise.all([
    getNpsSummary({ from, to, unitId }),
    getRoiByCampaign({ from, to }),
    getRoiByOrigin({ from, to }),
  ])

  const npsValor = npsResult.success ? npsResult.data?.score ?? null : null
  const cplValor = roiResult.success ? roiResult.summary?.cpl ?? null : null
  const cacValor = roiResult.success ? roiResult.summary?.cac ?? null : null

  let conversaoValor: number | null = null
  if (originResult.success) {
    const rows = originResult.data ?? []
    const totalLeads = rows.reduce((sum, r) => sum + r.leads, 0)
    const totalConvertidos = rows.reduce((sum, r) => sum + r.convertidos, 0)
    conversaoValor = totalLeads > 0 ? (totalConvertidos / totalLeads) * 100 : null
  }

  return {
    nps: attachMeta('nps', 'NPS', npsValor, metaMap),
    cpl: attachMeta('cpl', 'Custo por Lead (CPL)', cplValor, metaMap),
    cac: attachMeta('cac', 'Custo de Aquisição de Cliente (CAC)', cacValor, metaMap),
    conversao_leads: attachMeta('conversao_leads', 'Conversão de leads', conversaoValor, metaMap),
  }
}

// ─── computeEstoqueTiss (D-29) ────────────────────────────────────────────────
// alertas_minimo: stock_alerts ativos tipo='minimo'. glosa_taxa: valor_glosado ÷
// valor_total dos itens de guia TISS no período. atraso_pagamento: payable_installments
// + receivables vencidas e pendentes (due_date < hoje, status='pendente').

async function computeEstoqueTiss(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string,
  unitId: string | undefined,
  metaMap: Map<string, number>
): Promise<BiKpis['estoque_tiss']> {
  // 1. alertas_minimo
  let alertsQuery = supabase
    .from('stock_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('tipo', 'minimo')
    .eq('resolvido', false)

  if (unitId) alertsQuery = alertsQuery.eq('unit_id', unitId)

  const { count: alertasMinimoCount } = await alertsQuery

  // 2. glosa_taxa — resolve guide_ids via service_orders when a unit filter is given
  // (tiss_guide_items has no unit_id column — two-hop resolution, mirrors the
  // unit→cost_center_ids pattern used elsewhere in this phase).
  let guideIds: string[] | null = null
  if (unitId) {
    const { data: osRows } = await supabase.from('service_orders').select('id').eq('unit_id', unitId)
    const osIds = ((osRows ?? []) as Array<{ id: string }>).map((r) => r.id)
    if (osIds.length === 0) {
      guideIds = []
    } else {
      const { data: guideRows } = await supabase
        .from('tiss_guides')
        .select('id')
        .in('service_order_id', osIds)
      guideIds = ((guideRows ?? []) as Array<{ id: string }>).map((r) => r.id)
    }
  }

  let glosaTaxaValor: number | null = null
  if (guideIds === null || guideIds.length > 0) {
    let itemsQuery = supabase
      .from('tiss_guide_items')
      .select('valor_total, valor_glosado')
      .eq('clinic_id', clinicId)
      .gte('created_at', from)
      .lte('created_at', to)

    if (guideIds !== null) itemsQuery = itemsQuery.in('guide_id', guideIds)

    const { data: itemRows } = await itemsQuery
    const items = (itemRows ?? []) as Array<{ valor_total: number; valor_glosado: number }>
    const totalValor = items.reduce((sum, i) => sum + i.valor_total, 0)
    const totalGlosado = items.reduce((sum, i) => sum + i.valor_glosado, 0)
    glosaTaxaValor = totalValor > 0 ? (totalGlosado / totalValor) * 100 : null
  }

  // 3. atraso_pagamento — payable_installments (unit via payables join) + receivables
  //    (unit_id NOT NULL column, direct filter)
  const today = new Date().toISOString().slice(0, 10)

  let payableIds: string[] | null = null
  if (unitId) {
    const { data: payableRows } = await supabase.from('payables').select('id').eq('unit_id', unitId)
    payableIds = ((payableRows ?? []) as Array<{ id: string }>).map((r) => r.id)
  }

  let atrasoPayables = 0
  if (payableIds === null || payableIds.length > 0) {
    let instQuery = supabase
      .from('payable_installments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'pendente')
      .lt('due_date', today)

    if (payableIds !== null) instQuery = instQuery.in('payable_id', payableIds)

    const { count } = await instQuery
    atrasoPayables = count ?? 0
  }

  let receivablesQuery = supabase
    .from('receivables')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', clinicId)
    .eq('status', 'pendente')
    .lt('due_date', today)

  if (unitId) receivablesQuery = receivablesQuery.eq('unit_id', unitId)

  const { count: atrasoReceivables } = await receivablesQuery

  const atrasoPagamentoValor = atrasoPayables + (atrasoReceivables ?? 0)

  return {
    alertas_minimo: attachMeta('alertas_minimo', 'Alertas de estoque mínimo', alertasMinimoCount ?? 0, metaMap),
    glosa_taxa: attachMeta('glosa_taxa', 'Taxa de glosa TISS', glosaTaxaValor, metaMap),
    atraso_pagamento: attachMeta('atraso_pagamento', 'Contas em atraso', atrasoPagamentoValor, metaMap),
  }
}

// ─── getBiKpis ─────────────────────────────────────────────────────────────────
// D-29/D-38: KPIs por dimensão (Operacional/Profissionais/CRC/Estoque-TISS) com
// meta×realizado. D-39: gate admin/socio/superadmin.

export async function getBiKpis(params: {
  from: string
  to: string
  unitId?: string
}): Promise<{ success: boolean; data?: BiKpis; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(BI_KPI_READ_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para acessar o BI' }
  }

  const supabase = await createClient()

  const metaMap = await loadKpiTargetsMap(supabase, actor.tenant_id, params.unitId)

  const [operacional, profissionais, crc, estoque_tiss] = await Promise.all([
    computeOperacional(supabase, actor.tenant_id, params.from, params.to, params.unitId, metaMap),
    computeProfissionais(supabase, actor.tenant_id, params.from, params.to, params.unitId),
    computeCrc(params.from, params.to, params.unitId, metaMap),
    computeEstoqueTiss(supabase, actor.tenant_id, params.from, params.to, params.unitId, metaMap),
  ])

  return {
    success: true,
    data: { operacional, profissionais, crc, estoque_tiss },
  }
}
