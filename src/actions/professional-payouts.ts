'use server'
import 'server-only'
/**
 * professional-payouts.ts — Repasse Profissional Server Actions (TRIB-01)
 * Phase 16 / Plan 08
 *
 * computePayouts — calcula repasse sobre recebimentos conciliados (regime caixa, D-14)
 * getDemonstrativo — demonstrativo por profissional/competência (D-15)
 * aprovarEgerarCP  — CAS rascunho→aprovado + cria CP origem='repasse' (D-15/D-02d)
 * fecharCompetencia — INSERT idempotente em competencia_fechamentos (D-26)
 * listPayouts      — listagem com filtros
 *
 * Security:
 *   T-16-46: writer gate ['admin','superadmin'] — auditor/socio são readOnly
 *   T-16-47: guard competencia_fechamentos em computePayouts (D-26)
 *   Cadeia de join: recebimento conciliado → profissional via service_order_items.professional_id
 *                  (NUNCA via financial_transactions.professional_id — essa coluna não existe)
 *   Vínculo recebimento→cobrança: financial_transactions.receivable_id → receivables.charge_id → charges
 *                  (financial_transactions.charge_id NÃO existe — D-29 / CR-01)
 *
 * Libs puras (Plan 04 — APENAS importar, NÃO reimplementar):
 *   src/lib/financeiro/payout-math — computePayout, aggregatePayout
 *   src/actions/payables — createPayableFromRepasse
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { computePayout, aggregatePayout } from '@/lib/financeiro/payout-math'
import type { CommissionRule, PayoutItemInput, PayoutDeductions } from '@/lib/financeiro/payout-math'
import { createPayableFromRepasse } from '@/actions/payables'

// ─── Actor helper (verbatim from receivables.ts) ─────────────────────────────

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

// ─── Role gate ────────────────────────────────────────────────────────────────
// D-23: writers = admin + superadmin (T-16-46)
const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── computePayouts ───────────────────────────────────────────────────────────
/**
 * TRIB-01: calcula repasse sobre recebimentos CONCILIADOS do profissional na
 * competência (regime caixa, D-14).
 *
 * Cadeia de join (recebimento conciliado → profissional):
 *   financial_transactions (reconciliation_status='conciliado') →
 *   receivables (via financial_transactions.receivable_id) →
 *   charges (via receivables.charge_id) →
 *   service_orders (charges.service_order_id) →
 *   service_order_items (service_order_id, professional_id=input.professionalId)
 *
 * NUNCA usa financial_transactions.professional_id (esse campo não existe — D-29).
 */
export async function computePayouts(input: {
  professionalId: string
  competencia: string
  unitId: string
}): Promise<{ success: boolean; payoutId?: string; alertas?: string[]; error?: string }> {
  // 1. Auth + writer gate
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para calcular repasse' }
  }

  const supabase = await createClient()

  // 2. Guard de competência fechada (D-26, T-16-47)
  const { data: fechamento } = await supabase
    .from('competencia_fechamentos')
    .select('id')
    .eq('clinic_id', actor.tenant_id)
    .eq('unit_id', input.unitId)
    .eq('competencia', input.competencia)
    .maybeSingle()

  if (fechamento) {
    return { success: false, error: `Competência ${input.competencia} fechada` }
  }

  // 3. Verificar vínculo do profissional (D-16): apenas autônomo/PJ in scope
  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('id, commission_rules, supplier_id, users(id)')
    .eq('id', input.professionalId)
    .single()

  if (profError || !professional) {
    return { success: false, error: 'Profissional não encontrado' }
  }

  // Verificar vínculo via supplier se disponível
  let vinculo: string | null = null
  if (professional.supplier_id) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('vinculo')
      .eq('id', professional.supplier_id)
      .single()
    vinculo = supplier?.vinculo ?? null
  }

  // CLT está fora do escopo de RPA; repasse pode processar qualquer vínculo (D-16 — repasse é separado do RPA)
  // RPA (Task 2) recusa CLT; repasse apenas alerta quando sem regra

  // 4. Coletar recebimentos CONCILIADOS na competência via cadeia de join
  //    financial_transactions → receivables → charges → service_orders → service_order_items
  //    O vínculo profissional→dinheiro vem por service_order_items.professional_id (D-29)
  const [compYear, compMonth] = input.competencia.split('-')
  const compStart = `${compYear}-${compMonth}-01`
  const nextMonthNum = parseInt(compMonth!) === 12
    ? `${parseInt(compYear!) + 1}-01-01`
    : `${compYear}-${String(parseInt(compMonth!) + 1).padStart(2, '0')}-01`

  // Buscar financial_transactions conciliadas na competência
  const { data: transactions, error: txError } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      amount,
      transaction_date,
      statement_line_id,
      receivable_id
    `)
    .eq('tenant_id', actor.tenant_id)
    .eq('reconciliation_status', 'conciliado')
    .eq('type', 'receita')
    .gte('transaction_date', compStart)
    .lt('transaction_date', nextMonthNum)

  if (txError) {
    return { success: false, error: txError.message }
  }

  const txList = transactions ?? []
  if (txList.length === 0) {
    return { success: false, error: 'Nenhum recebimento conciliado na competência' }
  }

  // Coletar receivable_ids das transações conciliadas (CR-01: charge_id não existe em financial_transactions)
  const receivableIds = txList
    .map((t: { receivable_id: string | null }) => t.receivable_id)
    .filter((id): id is string => id !== null)

  if (receivableIds.length === 0) {
    return { success: false, error: 'Recebimentos conciliados sem vínculo a recebíveis' }
  }

  // Resolver charge_ids via receivables (financial_transactions.receivable_id → receivables.charge_id)
  const { data: receivables, error: receivablesError } = await supabase
    .from('receivables')
    .select('id, charge_id')
    .in('id', receivableIds)

  if (receivablesError) {
    return { success: false, error: receivablesError.message }
  }

  const chargeIds = (receivables ?? [])
    .map((r: { charge_id: string | null }) => r.charge_id)
    .filter((id): id is string => id !== null)

  if (chargeIds.length === 0) {
    return { success: false, error: 'Recebimentos conciliados sem vínculo a cobranças' }
  }

  // Buscar service_order_ids via charges
  const { data: charges, error: chargesError } = await supabase
    .from('charges')
    .select('id, service_order_id')
    .in('id', chargeIds)
    .not('service_order_id', 'is', null)

  if (chargesError) {
    return { success: false, error: chargesError.message }
  }

  const osIds = (charges ?? [])
    .map((c: { service_order_id: string | null }) => c.service_order_id)
    .filter((id): id is string => id !== null)

  if (osIds.length === 0) {
    return { success: false, error: 'Nenhuma OS vinculada aos recebimentos conciliados' }
  }

  // Buscar service_order_items do profissional (cadeia D-29)
  const { data: soItems, error: soItemsError } = await supabase
    .from('service_order_items')
    .select('id, service_order_id, service_id, valor_total, description')
    .in('service_order_id', osIds)
    .eq('professional_id', input.professionalId)

  if (soItemsError) {
    return { success: false, error: soItemsError.message }
  }

  const items = soItems ?? []
  if (items.length === 0) {
    return { success: false, error: 'Nenhum item de OS vinculado a este profissional na competência' }
  }

  // Mapear valor recebido por item (rateio proporcional se a OS tem múltiplos itens)
  // Para simplificação, usamos valor_total do item como valor_recebido
  const payoutItems: PayoutItemInput[] = items.map((item: {
    id: string
    service_order_id: string
    service_id: string | null
    valor_total: number
    description: string
  }) => ({
    service_id: item.service_id ?? '*',
    valor_recebido: item.valor_total,
    descricao: item.description,
    service_order_id: item.service_order_id,
  }))

  // 5. Carregar commission_rules do profissional
  const commissionRules: CommissionRule[] = Array.isArray(professional.commission_rules)
    ? (professional.commission_rules as CommissionRule[])
    : []

  const deducoes: PayoutDeductions = {}

  // 6. computePayout (NUNCA recalcular inline)
  const result = computePayout(payoutItems, commissionRules, deducoes)
  const alertas = result.items
    .filter((r) => r.alerta === 'sem_regra')
    .map((r) => `Sem regra de comissão para serviço ${r.service_id}`)

  const header = aggregatePayout(result.items)

  // Calcular percentual médio ponderado
  const percentualMedio = header.valor_repasse > 0 && header.valor_base > 0
    ? header.valor_repasse / header.valor_base
    : 0

  // 7. Upsert professional_payouts (UNIQUE clinic_id,professional_id,competencia)
  const { data: payout, error: upsertError } = await supabase
    .from('professional_payouts')
    .upsert(
      {
        clinic_id: actor.tenant_id,
        unit_id: input.unitId,
        professional_id: input.professionalId,
        competencia: input.competencia,
        valor_bruto: header.valor_bruto,
        deducoes,
        valor_base: header.valor_base,
        percentual: percentualMedio,
        valor_repasse: header.valor_repasse,
        status: 'rascunho',
        created_by: actor.id,
      },
      { onConflict: 'clinic_id,professional_id,competencia' }
    )
    .select('id')
    .single()

  if (upsertError || !payout) {
    return { success: false, error: upsertError?.message ?? 'Erro ao salvar repasse' }
  }

  const payoutId = payout.id

  // Inserir payout_items
  if (result.items.length > 0) {
    // Remover itens antigos (re-cálculo)
    await supabase
      .from('payout_items')
      .delete()
      .eq('payout_id', payoutId)

    const itemRows = result.items.map((r, i) => ({
      clinic_id: actor.tenant_id,
      payout_id: payoutId,
      service_order_id: (payoutItems[i] as { service_id: string; valor_recebido: number; descricao?: string; service_order_id?: string }).service_order_id ?? null,
      statement_line_id: null,
      descricao: (payoutItems[i] as { service_id: string; valor_recebido: number; descricao?: string }).descricao ?? r.service_id,
      valor_recebido: r.valor_recebido,
      valor_base_item: r.valor_base,
      percentual_item: r.percentual,
      valor_repasse_item: r.valor_repasse,
    }))

    await supabase.from('payout_items').insert(itemRows)
  }

  // 8. Audit + revalidate
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'compute_payout',
    details: { payout_id: payoutId, competencia: input.competencia, alertas },
  })

  revalidatePath('/clinica/financeiro/repasses')

  return { success: true, payoutId, alertas }
}

// ─── getDemonstrativo ─────────────────────────────────────────────────────────
/**
 * D-15: demonstrativo por profissional/competência — payout header + itens.
 */
export async function getDemonstrativo(payoutId: string): Promise<{
  success: boolean
  payout?: unknown
  items?: unknown[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  const { data: payout, error: payoutError } = await supabase
    .from('professional_payouts')
    .select(`
      id, competencia, valor_bruto, deducoes, valor_base, percentual, valor_repasse,
      status, payable_id, created_at,
      professionals ( id, users ( id ) )
    `)
    .eq('id', payoutId)
    .single()

  if (payoutError || !payout) {
    return { success: false, error: 'Repasse não encontrado' }
  }

  const { data: items, error: itemsError } = await supabase
    .from('payout_items')
    .select('id, descricao, valor_recebido, valor_base_item, percentual_item, valor_repasse_item, service_order_id, statement_line_id')
    .eq('payout_id', payoutId)
    .order('created_at', { ascending: true })

  if (itemsError) {
    return { success: false, error: itemsError.message }
  }

  return { success: true, payout, items: items ?? [] }
}

// ─── aprovarEgerarCP ──────────────────────────────────────────────────────────
/**
 * D-15/D-02d: CAS rascunho→aprovado + createPayableFromRepasse (idempotente).
 */
export async function aprovarEgerarCP(
  payoutId: string,
  dueDate: string,
  supplierId: string,
): Promise<{ success: boolean; payableId?: string; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para aprovar repasse' }
  }

  const supabase = await createClient()

  // Buscar o repasse
  const { data: payout, error: fetchError } = await supabase
    .from('professional_payouts')
    .select('id, valor_repasse, competencia, status')
    .eq('id', payoutId)
    .single()

  if (fetchError || !payout) {
    return { success: false, error: 'Repasse não encontrado' }
  }

  // CAS UPDATE status 'rascunho'→'aprovado' (T-16-47)
  const { data: updated, error: casError } = await supabase
    .from('professional_payouts')
    .update({ status: 'aprovado' })
    .eq('id', payoutId)
    .eq('status', 'rascunho')
    .select('id')

  if (casError) {
    return { success: false, error: casError.message }
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'Repasse já aprovado/pago' }
  }

  // Criar CP origem='repasse' (idempotente por payout_id)
  const r = await createPayableFromRepasse(
    payoutId,
    supplierId,
    payout.valor_repasse,
    payout.competencia,
    dueDate,
  )

  if (!r.success) {
    return { success: false, error: r.error }
  }

  // Linkar payable_id no repasse
  await supabase
    .from('professional_payouts')
    .update({ payable_id: r.payableId })
    .eq('id', payoutId)

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'aprovar_repasse',
    details: { payout_id: payoutId, payable_id: r.payableId },
  })

  revalidatePath('/clinica/financeiro/repasses')

  return { success: true, payableId: r.payableId }
}

// ─── fecharCompetencia ────────────────────────────────────────────────────────
/**
 * D-26: INSERT idempotente em competencia_fechamentos (ON CONFLICT DO NOTHING).
 * Após fechamento, computePayouts recusa competência fechada; a UI usa next_competencia.
 */
export async function fecharCompetencia(input: {
  unitId: string
  competencia: string
}): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para fechar competência' }
  }

  const supabase = await createClient()

  // INSERT idempotente (ON CONFLICT DO NOTHING)
  const { error } = await supabase
    .from('competencia_fechamentos')
    .upsert(
      {
        clinic_id: actor.tenant_id,
        unit_id: input.unitId,
        competencia: input.competencia,
        fechado_por: actor.id,
      },
      { onConflict: 'clinic_id,unit_id,competencia', ignoreDuplicates: true }
    )

  if (error) {
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'fechar_competencia',
    details: { unit_id: input.unitId, competencia: input.competencia },
  })

  revalidatePath('/clinica/financeiro/repasses')

  return { success: true }
}

// ─── listPayouts ──────────────────────────────────────────────────────────────
/**
 * Listagem de repasses com filtros; RLS escopa tenant.
 */
export async function listPayouts(filters: {
  competencia?: string
  professionalId?: string
  status?: string
  unitId?: string
}): Promise<{ success: boolean; payouts?: unknown[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('professional_payouts')
    .select(`
      id, competencia, valor_bruto, valor_base, percentual, valor_repasse,
      status, payable_id, created_at, unit_id,
      professionals ( id, users ( id ) )
    `)
    .order('competencia', { ascending: false })

  if (filters.competencia) {
    query = query.eq('competencia', filters.competencia)
  }
  if (filters.professionalId) {
    query = query.eq('professional_id', filters.professionalId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.unitId) {
    query = query.eq('unit_id', filters.unitId)
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

  return { success: true, payouts: data ?? [] }
}
