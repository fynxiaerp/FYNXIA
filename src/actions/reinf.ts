'use server'
import 'server-only'
/**
 * reinf.ts — Eventos EFD-Reinf Server Actions (TRIB-03)
 * Phase 16 / Plan 08
 *
 * gerarReinfEvent        — R-2010/R-4020 via getReinfProvider STUB + idempotency_key
 *                          Cobre RPA autônomo (INSS) + serviços tomados PJ/lab (IRRF/CSLL) (D-21)
 * listReinfEvents        — listagem com filtros (RLS escopa tenant)
 * estornarBaixaConciliada — estorno de baixa/CP-pago/RPA SEMPRE por alçada + audit (D-24)
 *
 * Security:
 *   T-16-42: getReinfProvider server-only; credential_enc nunca retornado
 *   T-16-44: estorno SEMPRE via createApprovalRequest + logBusinessEvent
 *   T-16-45: idempotency_key determinístico + UNIQUE(clinic_id, idempotency_key);
 *            select-before-transmit retorna o existente se já transmitido (D-22)
 *   T-16-46: writer gate ['admin','superadmin']
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { getReinfProvider } from '@/lib/reinf'
import type { ReinfEventInput } from '@/lib/reinf/types'
import { createApprovalRequest } from '@/actions/approval-actions'

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

// ─── gerarReinfEvent ──────────────────────────────────────────────────────────
/**
 * TRIB-03 / D-18/D-21/D-22:
 *   - R-2010: retenção INSS sobre serviços tomados (PJ/lab)
 *   - R-4020: IRRF/CSLL/PIS/COFINS retidos sobre PJ
 *   Cobre RPA autônomo (sourceRpaId) + serviços tomados PJ/lab (sourcePayableId/prestadorCnpj)
 *
 * Idempotency key determinístico: tipo|competencia|sourceRpaId ?? sourcePayableId ?? prestadorCnpj
 * Select-before-transmit: se já existe → retorna o evento existente sem retransmitir (T-16-45)
 */
export async function gerarReinfEvent(input: {
  tipo: 'R2010' | 'R4020'
  competencia: string
  unitId?: string
  sourceRpaId?: string
  sourcePayableId?: string
  prestadorCnpj?: string
  prestadorNome?: string
  valorBruto?: number
  valorRetencaoInss?: number
  beneficiarioCnpj?: string
  valorRetencaoIrrf?: number
}): Promise<{ success: boolean; eventId?: string; protocolo?: string; error?: string }> {
  // 1. Auth + writer gate
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para gerar evento EFD-Reinf' }
  }

  const supabase = await createClient()

  // 2. Montar idempotency_key determinístico (T-16-45)
  //    Cobre RPA de autônomo (sourceRpaId) E serviços tomados PJ/lab (sourcePayableId/prestadorCnpj) — D-21
  const sourceRef = input.sourceRpaId ?? input.sourcePayableId ?? input.prestadorCnpj
  if (!sourceRef) {
    return {
      success: false,
      error: 'sourceRpaId, sourcePayableId ou prestadorCnpj obrigatório para idempotency_key',
    }
  }

  const idempotencyKey = `${input.tipo}|${input.competencia}|${sourceRef}`

  // 3. Idempotência: SELECT reinf_events WHERE clinic_id + idempotency_key (T-16-45)
  //    Se já existe → retornar o evento existente, NÃO retransmitir
  const { data: existing, error: existingError } = await supabase
    .from('reinf_events')
    .select('id, protocolo, status')
    .eq('clinic_id', actor.tenant_id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingError) {
    return { success: false, error: existingError.message }
  }

  if (existing) {
    // Já transmitido anteriormente — retornar o evento existente
    return { success: true, eventId: existing.id, protocolo: existing.protocolo ?? undefined }
  }

  // 4. getReinfProvider (STUB-gated, D-22/T-16-42)
  //    server-only: credential_enc lido via createAdminClient server-side; nunca exposto
  const provider = await getReinfProvider(actor.tenant_id)

  // 5. Montar ReinfEventInput
  const reinfInput: ReinfEventInput = {
    tipo: input.tipo,
    competencia: input.competencia,
    clinic_id: actor.tenant_id,
    prestador_cnpj: input.prestadorCnpj,
    prestador_nome: input.prestadorNome,
    valor_bruto: input.valorBruto,
    valor_retencao_inss: input.valorRetencaoInss,
    beneficiario_cnpj: input.beneficiarioCnpj,
    valor_retencao_irrf: input.valorRetencaoIrrf,
    idempotency_key: idempotencyKey,
  }

  const r = await provider.transmitir(reinfInput)

  // 6. INSERT reinf_events
  const { data: event, error: insertError } = await supabase
    .from('reinf_events')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: input.unitId ?? null,
      tipo: input.tipo,
      competencia: input.competencia,
      provider_ref: r.provider_ref,
      status: r.status,
      protocolo: r.protocolo ?? null,
      payload: reinfInput as unknown as Record<string, unknown>,
      idempotency_key: idempotencyKey,
      error_message: r.error_message ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !event) {
    // Unique constraint violation (concurrent duplicate) — buscar o existente
    if (insertError?.code === '23505') {
      const { data: dup } = await supabase
        .from('reinf_events')
        .select('id, protocolo')
        .eq('clinic_id', actor.tenant_id)
        .eq('idempotency_key', idempotencyKey)
        .single()
      return { success: true, eventId: dup?.id, protocolo: dup?.protocolo ?? undefined }
    }
    return { success: false, error: insertError?.message ?? 'Erro ao salvar evento Reinf' }
  }

  const eventId = event.id

  // Se veio de um RPA → UPDATE rpa_records SET reinf_event_id = eventId
  if (input.sourceRpaId) {
    await supabase
      .from('rpa_records')
      .update({ reinf_event_id: eventId })
      .eq('id', input.sourceRpaId)
      .eq('clinic_id', actor.tenant_id)
  }

  // 7. Audit + revalidate
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'gerar_reinf',
    details: { event_id: eventId, tipo: input.tipo, competencia: input.competencia },
  })

  revalidatePath('/clinica/financeiro/reinf')

  return { success: true, eventId, protocolo: r.protocolo }
}

// ─── listReinfEvents ──────────────────────────────────────────────────────────
/**
 * Listagem de eventos EFD-Reinf com filtros; RLS escopa tenant.
 */
export async function listReinfEvents(filters: {
  competencia?: string
  tipo?: string
  status?: string
}): Promise<{ success: boolean; events?: unknown[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('reinf_events')
    .select(
      'id, tipo, competencia, provider_ref, status, protocolo, error_message, idempotency_key, created_at, unit_id'
    )
    .order('competencia', { ascending: false })

  if (filters.competencia) {
    query = query.eq('competencia', filters.competencia)
  }
  if (filters.tipo) {
    query = query.eq('tipo', filters.tipo)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

  return { success: true, events: data ?? [] }
}

// ─── estornarBaixaConciliada ──────────────────────────────────────────────────
/**
 * D-24: estorno de baixa conciliada / CP pago / RPA emitido.
 *
 * SEMPRE passa por createApprovalRequest (alçada Fase 10) + logBusinessEvent.
 * NÃO reverte o saldo/lançamento diretamente — a aprovação por alçada é quem
 * dispara a reversão (mesmo padrão do estorno fiscal da Fase 15, D-24/T-16-44).
 */
export async function estornarBaixaConciliada(input: {
  financialTransactionId: string
  motivo: string
}): Promise<{ success: boolean; error?: string }> {
  // 1. Auth + writer gate
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para solicitar estorno' }
  }

  const supabase = await createClient()

  // Re-fetch do financial_transaction (deve estar 'conciliado' ou 'baixado')
  const { data: ft, error: fetchError } = await supabase
    .from('financial_transactions')
    .select('id, reconciliation_status, type, amount, description')
    .eq('id', input.financialTransactionId)
    .single()

  if (fetchError || !ft) {
    return { success: false, error: 'Transação financeira não encontrada' }
  }

  if (!['conciliado', 'baixado'].includes(ft.reconciliation_status)) {
    return {
      success: false,
      error: `Transação no status '${ft.reconciliation_status}' não pode ser estornada por esta via`,
    }
  }

  // Rotear SEMPRE por alçada (D-24/T-16-44) — NÃO reverter diretamente
  const approvalResult = await createApprovalRequest({
    type: 'estorno',
    requiredRole: 'admin',
    payload: {
      financial_transaction_id: input.financialTransactionId,
      motivo: input.motivo,
      reconciliation_status: ft.reconciliation_status,
      amount: ft.amount,
      description: ft.description,
    },
    idempotencyKey: `estorno_baixa_${input.financialTransactionId}`,
  })

  if (!approvalResult.success) {
    return { success: false, error: approvalResult.error }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'estorno_baixa_solicitado',
    details: {
      financial_transaction_id: input.financialTransactionId,
      motivo: input.motivo,
      approval_id: approvalResult.id,
    },
  })

  // Return { success: true } — pedido de aprovação criado
  // O ponto de mutação reversora vive no fluxo de aprovação da Fase 10
  return { success: true }
}
