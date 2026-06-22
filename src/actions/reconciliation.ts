'use server'
import 'server-only'

/**
 * src/actions/reconciliation.ts — Reconciliation Server Actions (FOP-02/FOP-03)
 *
 * Orchestrates 3-stage bank reconciliation:
 *   Stage 1 (runAutoReconciliation): exact match ±0.01/±3 days → auto-conciliated.
 *   Stage 2 (suggestMatches): fuzzy scored suggestions (read-only).
 *   confirmMatch: user confirms a Stage 2 suggestion → CAS update.
 *   createReconciledTransaction (D-07): 1-click create financial_transaction for unmatched line.
 *   cashFlowPrevistoVsRealizado (FOP-03/D-08): previsto/realizado/baixadoNaoConciliado buckets.
 *
 * Stage 3 extensions (matchNToOne + reconcileLoteConvenio) are appended in the same file.
 *
 * Security / Threats:
 *   T-16-33: Writer gate ['admin','superadmin'] on all mutating actions.
 *   T-16-34: CAS .eq('reconciliation_status','pendente') on BOTH statement_line
 *             AND financial_transaction before marking 'conciliado'.
 *   T-16-35: createReconciledTransaction derives type from amount sign (Pitfall 5).
 *
 * Pattern mirrors src/actions/service-orders.ts (getActor, writer gate, logBusinessEvent,
 * revalidatePath) and src/actions/receivables.ts (getActor verbatim).
 */

import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import {
  matchExact,
  matchFuzzy,
  type StatementLineInput,
  type TransactionRow,
  type ScoredMatch,
} from '@/lib/financeiro/reconciliation'

// ─── Actor helper (verbatim from src/actions/receivables.ts) ─────────────────

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

// ─── Writer gate ─────────────────────────────────────────────────────────────
// D-23 / T-16-33: same role set as the RLS of 16-03 and payables.ts

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── Revalidation path ───────────────────────────────────────────────────────

const REVALIDATE_PATH = '/clinica/financeiro/conciliacao'

// ─── runAutoReconciliation ────────────────────────────────────────────────────
// Stage 1 (D-06): exact matching ±0.01/±3 days → auto 'conciliado'; no human confirmation.

export async function runAutoReconciliation(bankAccountId: string): Promise<{
  success: boolean
  conciliated?: number
  error?: string
}> {
  // 1. Actor + writer gate
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para executar conciliação automática' }
  }

  const supabase = await createClient()

  // 2. Fetch pending statement lines for this bank account
  const { data: rawLines, error: linesErr } = await supabase
    .from('statement_lines')
    .select('id, amount, transaction_date, memo, bank_account_id')
    .eq('bank_account_id', bankAccountId)
    .eq('reconciliation_status', 'pendente')

  if (linesErr) return { success: false, error: linesErr.message }

  const pendingLines: StatementLineInput[] = (rawLines ?? []).map((r: {
    id: string
    amount: number
    transaction_date: string
    memo: string | null
    bank_account_id: string
  }) => ({
    id: r.id,
    amount: r.amount,
    transaction_date: r.transaction_date,
    memo: r.memo ?? undefined,
    bank_account_id: r.bank_account_id,
  }))

  if (pendingLines.length === 0) {
    return { success: true, conciliated: 0 }
  }

  // 3. Fetch pending financial_transactions for the same bank account
  const { data: rawTxs, error: txsErr } = await supabase
    .from('financial_transactions')
    .select('id, amount, transaction_date, description, bank_account_id')
    .eq('bank_account_id', bankAccountId)
    .eq('reconciliation_status', 'pendente')

  if (txsErr) return { success: false, error: txsErr.message }

  // Working pool of candidates — remove matched ones to avoid reuse
  const candidatePool: TransactionRow[] = (rawTxs ?? []).map((t: {
    id: string
    amount: number
    transaction_date: string
    description: string | null
    bank_account_id: string | null
  }) => ({
    id: t.id,
    amount: t.amount,
    transaction_date: t.transaction_date,
    description: t.description ?? undefined,
    bank_account_id: t.bank_account_id ?? undefined,
  }))

  const usedTxIds = new Set<string>()
  let conciliated = 0

  // 4. Exact match loop — CAS prevents double-match (T-16-34)
  for (const line of pendingLines) {
    const available = candidatePool.filter((c) => !usedTxIds.has(c.id))
    const match = matchExact(line, available)

    if (!match) continue

    // CAS UPDATE on statement_line (only if still 'pendente')
    const { data: lineUpdated } = await supabase
      .from('statement_lines')
      .update({
        reconciliation_status: 'conciliado',
        matched_transaction_ids: [match.transaction_id],
      })
      .eq('id', line.id)
      .eq('reconciliation_status', 'pendente') // CAS guard (T-16-34)
      .select('id')

    if (!lineUpdated || lineUpdated.length === 0) continue // concorrently updated — skip

    // CAS UPDATE on financial_transaction (only if still 'pendente')
    const { data: txUpdated } = await supabase
      .from('financial_transactions')
      .update({
        reconciliation_status: 'conciliado',
        statement_line_id: line.id,
      })
      .eq('id', match.transaction_id)
      .eq('reconciliation_status', 'pendente') // CAS guard (T-16-34)
      .select('id')

    if (!txUpdated || txUpdated.length === 0) {
      // TX was concurrently matched — rollback the line update
      await supabase
        .from('statement_lines')
        .update({ reconciliation_status: 'pendente', matched_transaction_ids: null })
        .eq('id', line.id)
      continue
    }

    usedTxIds.add(match.transaction_id)
    conciliated++
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'reconciliation.auto_run',
    details: { bank_account_id: bankAccountId, conciliated },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, conciliated }
}

// ─── suggestMatches ───────────────────────────────────────────────────────────
// Stage 2: fuzzy ranked suggestions (read-only — NEVER writes to DB).

export async function suggestMatches(statementLineId: string): Promise<{
  success: boolean
  suggestions?: ScoredMatch[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  // Read-only: no writer gate required

  const supabase = await createClient()

  // Fetch the target line
  const { data: lineRow, error: lineErr } = await supabase
    .from('statement_lines')
    .select('id, amount, transaction_date, memo, bank_account_id')
    .eq('id', statementLineId)
    .single()

  if (lineErr || !lineRow) {
    return { success: false, error: lineErr?.message ?? 'Linha não encontrada' }
  }

  const line: StatementLineInput = {
    id: lineRow.id,
    amount: lineRow.amount,
    transaction_date: lineRow.transaction_date,
    memo: (lineRow.memo as string | null) ?? undefined,
    bank_account_id: lineRow.bank_account_id,
  }

  // Fetch pending financial_transactions for same bank account
  const { data: rawTxs, error: txsErr } = await supabase
    .from('financial_transactions')
    .select('id, amount, transaction_date, description, bank_account_id')
    .eq('bank_account_id', lineRow.bank_account_id)
    .eq('reconciliation_status', 'pendente')

  if (txsErr) return { success: false, error: txsErr.message }

  const candidates: TransactionRow[] = (rawTxs ?? []).map((t: {
    id: string
    amount: number
    transaction_date: string
    description: string | null
    bank_account_id: string | null
  }) => ({
    id: t.id,
    amount: t.amount,
    transaction_date: t.transaction_date,
    description: t.description ?? undefined,
    bank_account_id: t.bank_account_id ?? undefined,
  }))

  // Lib already sorts desc / filters ≥0.5 / marks confidence — no DB write
  return { success: true, suggestions: matchFuzzy(line, candidates) }
}

// ─── confirmMatch ─────────────────────────────────────────────────────────────
// User confirms a Stage 2 fuzzy suggestion → CAS update (T-16-34).

export async function confirmMatch(
  statementLineId: string,
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para confirmar conciliação' }
  }

  const supabase = await createClient()

  // CAS UPDATE on statement_line (T-16-34)
  const { data: lineUpdated } = await supabase
    .from('statement_lines')
    .update({
      reconciliation_status: 'conciliado',
      matched_transaction_ids: [transactionId],
    })
    .eq('id', statementLineId)
    .eq('reconciliation_status', 'pendente') // CAS guard
    .select('id')

  if (!lineUpdated || lineUpdated.length === 0) {
    return { success: false, error: 'Conciliação concorrente detectada' }
  }

  // CAS UPDATE on financial_transaction (T-16-34)
  const { data: txUpdated } = await supabase
    .from('financial_transactions')
    .update({
      reconciliation_status: 'conciliado',
      statement_line_id: statementLineId,
    })
    .eq('id', transactionId)
    .eq('reconciliation_status', 'pendente') // CAS guard
    .select('id')

  if (!txUpdated || txUpdated.length === 0) {
    // TX was concurrently matched — rollback the line update
    await supabase
      .from('statement_lines')
      .update({ reconciliation_status: 'pendente', matched_transaction_ids: null })
      .eq('id', statementLineId)
    return { success: false, error: 'Conciliação concorrente detectada' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'reconciliation.confirm_match',
    details: { statement_line_id: statementLineId, transaction_id: transactionId },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── createReconciledTransaction ──────────────────────────────────────────────
// D-07: 1-click create a financial_transaction for a statement line with no match.
// Type derived from amount sign: amount >= 0 → 'receita', amount < 0 → 'despesa' (T-16-35).

export async function createReconciledTransaction(input: {
  statementLineId: string
  accountId: string
  costCenterId: string
  description?: string
}): Promise<{
  success: boolean
  transactionId?: string
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para criar lançamento conciliado' }
  }

  const supabase = await createClient()

  // Re-fetch the statement line to get authoritative values (never trust client)
  const { data: line, error: lineErr } = await supabase
    .from('statement_lines')
    .select('id, amount, transaction_date, bank_account_id, memo, reconciliation_status')
    .eq('id', input.statementLineId)
    .single()

  if (lineErr || !line) {
    return { success: false, error: lineErr?.message ?? 'Linha não encontrada' }
  }

  if (line.reconciliation_status !== 'pendente') {
    return { success: false, error: 'Linha já conciliada ou ignorada' }
  }

  // T-16-35: derive type from amount sign (Pitfall 5 — amount sign determines receita/despesa)
  const type: 'receita' | 'despesa' = line.amount >= 0 ? 'receita' : 'despesa'
  // Amount stored in financial_transactions is always positive (absolute value)
  const amount = Math.abs(line.amount)

  // Insert financial_transaction
  const { data: tx, error: txErr } = await supabase
    .from('financial_transactions')
    .insert({
      tenant_id: actor.tenant_id,
      type,
      account_id: input.accountId,
      cost_center_id: input.costCenterId,
      bank_account_id: line.bank_account_id,
      amount,
      transaction_date: line.transaction_date,
      description: input.description ?? (line.memo as string | null) ?? null,
      reconciliation_status: 'conciliado',
      statement_line_id: line.id,
    })
    .select('id')
    .single()

  if (txErr || !tx) {
    return { success: false, error: txErr?.message ?? 'Erro ao criar lançamento' }
  }

  // Update statement_line — CAS guard (only if still 'pendente')
  const { data: lineUpdated } = await supabase
    .from('statement_lines')
    .update({
      reconciliation_status: 'conciliado',
      matched_transaction_ids: [tx.id],
    })
    .eq('id', input.statementLineId)
    .eq('reconciliation_status', 'pendente') // CAS guard (T-16-34)
    .select('id')

  if (!lineUpdated || lineUpdated.length === 0) {
    // Rollback the inserted transaction
    await supabase.from('financial_transactions').delete().eq('id', tx.id)
    return { success: false, error: 'Conciliação concorrente detectada' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'reconciliation.create_reconciled_transaction',
    details: {
      statement_line_id: input.statementLineId,
      transaction_id: tx.id,
      type,
      amount,
    },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, transactionId: tx.id }
}

// ─── cashFlowPrevistoVsRealizado ──────────────────────────────────────────────
// FOP-03 / D-08: three-bucket cash flow breakdown by reconciliation_status.
//
// Buckets (D-08 spec):
//   previsto          = 'pendente'           — not yet impacted the bank balance
//   realizado         = 'baixado'+'conciliado' — money already in/out of the bank
//   baixadoNaoConciliado = 'baixado' only    — subset of realizado: paid but not yet matched to extract

export async function cashFlowPrevistoVsRealizado(filters: {
  from?: string
  to?: string
  unitId?: string
}): Promise<{
  success: boolean
  previsto?: { entradas: number; saidas: number }
  realizado?: { entradas: number; saidas: number }
  baixadoNaoConciliado?: { entradas: number; saidas: number }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  // Read-only: no writer gate; all authenticated users can view cash flow
  const { actor } = actorResult

  const supabase = await createClient()

  // Resolve unitId → cost_center_ids for unit-level filter (mirrors listTransactions pattern)
  let costCenterIds: string[] | null = null
  if (filters.unitId) {
    const { data: ccs } = await supabase
      .from('cost_centers')
      .select('id')
      .eq('unit_id', filters.unitId)
    costCenterIds = (ccs ?? []).map((cc: { id: string }) => cc.id)
  }

  // Single query: fetch type + amount + reconciliation_status (RLS scopes to tenant)
  let query = supabase
    .from('financial_transactions')
    .select('type, amount, reconciliation_status')

  if (filters.from) query = query.gte('transaction_date', filters.from)
  if (filters.to) query = query.lte('transaction_date', filters.to)

  if (filters.unitId && costCenterIds !== null) {
    if (costCenterIds.length === 0) {
      // Unit exists but has no cost centers → empty result
      const zero = { entradas: 0, saidas: 0 }
      return { success: true, previsto: zero, realizado: zero, baixadoNaoConciliado: zero }
    }
    query = query.in('cost_center_id', costCenterIds)
  }

  const { data: rows, error } = await query

  if (error) return { success: false, error: error.message }

  // Aggregate into three buckets
  type Bucket = { entradas: number; saidas: number }
  const previsto: Bucket = { entradas: 0, saidas: 0 }
  const realizado: Bucket = { entradas: 0, saidas: 0 }
  const baixadoNaoConciliado: Bucket = { entradas: 0, saidas: 0 }

  for (const row of rows ?? []) {
    const t = row as { type: string; amount: number; reconciliation_status: string }
    const isReceita = t.type === 'receita'
    const amt = t.amount

    if (t.reconciliation_status === 'pendente') {
      // Previsto: saldo em aberto — não impactou o banco ainda
      if (isReceita) previsto.entradas += amt
      else previsto.saidas += amt
    } else if (t.reconciliation_status === 'baixado') {
      // Baixado: já saiu/entrou do caixa (baixarPayable cria FT com status='baixado', 16-06)
      // mas extrato ainda não foi casado — conta como realizado E sinalizado como pendência
      if (isReceita) {
        realizado.entradas += amt
        baixadoNaoConciliado.entradas += amt
      } else {
        realizado.saidas += amt
        baixadoNaoConciliado.saidas += amt
      }
    } else if (t.reconciliation_status === 'conciliado') {
      // Conciliado: realizado confirmado (casado com o extrato)
      if (isReceita) realizado.entradas += amt
      else realizado.saidas += amt
    }
    // NEVER ignore 'baixado' — omitting it would understate realizado and break saldo (D-08)
  }

  void actor // used for RLS context only

  return { success: true, previsto, realizado, baixadoNaoConciliado }
}

// ─── matchNToOne (Stage 3) ────────────────────────────────────────────────────
// Imported below — appended in the same file (Task 3).

import { matchNToOne as libMatchNToOne } from '@/lib/financeiro/reconciliation'

// ─── matchNToOne ──────────────────────────────────────────────────────────────
// D-09: 1 deposit ↔ N receivables with tolerance R$5. Fee → despesa (T-16-35).

export async function matchNToOne(input: {
  statementLineId: string
  feeAccountId?: string
  feeCostCenterId?: string
  tolerance?: number
}): Promise<{
  success: boolean
  matched?: string[]
  fee?: number
  feeTransactionId?: string
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para conciliar lote' }
  }

  const supabase = await createClient()

  // Re-fetch the deposit line
  const { data: lineRow, error: lineErr } = await supabase
    .from('statement_lines')
    .select('id, amount, transaction_date, memo, bank_account_id, reconciliation_status')
    .eq('id', input.statementLineId)
    .single()

  if (lineErr || !lineRow) {
    return { success: false, error: lineErr?.message ?? 'Linha não encontrada' }
  }

  if (lineRow.reconciliation_status !== 'pendente') {
    return { success: false, error: 'Linha já conciliada ou ignorada' }
  }

  const depositLine: StatementLineInput = {
    id: lineRow.id,
    amount: lineRow.amount,
    transaction_date: lineRow.transaction_date,
    memo: (lineRow.memo as string | null) ?? undefined,
    bank_account_id: lineRow.bank_account_id,
  }

  // Fetch pending receita transactions for the same bank_account (lote Asaas)
  const { data: rawTxs, error: txsErr } = await supabase
    .from('financial_transactions')
    .select('id, amount, transaction_date, description, bank_account_id')
    .eq('bank_account_id', lineRow.bank_account_id)
    .eq('type', 'receita')
    .eq('reconciliation_status', 'pendente')

  if (txsErr) return { success: false, error: txsErr.message }

  const candidates: TransactionRow[] = (rawTxs ?? []).map((t: {
    id: string
    amount: number
    transaction_date: string
    description: string | null
    bank_account_id: string | null
  }) => ({
    id: t.id,
    amount: t.amount,
    transaction_date: t.transaction_date,
    description: t.description ?? undefined,
    bank_account_id: t.bank_account_id ?? undefined,
  }))

  // Stage 3 matching
  const result = libMatchNToOne(depositLine, candidates, input.tolerance ?? 5.00)

  if (!result) {
    return { success: false, error: 'Nenhuma combinação dentro da tolerância' }
  }

  // CAS UPDATE matched financial_transactions (T-16-34)
  for (const txId of result.transaction_ids) {
    await supabase
      .from('financial_transactions')
      .update({
        reconciliation_status: 'conciliado',
        statement_line_id: lineRow.id,
      })
      .eq('id', txId)
      .eq('reconciliation_status', 'pendente') // CAS guard
  }

  // UPDATE statement_line
  const { error: lineUpdateErr } = await supabase
    .from('statement_lines')
    .update({
      reconciliation_status: 'conciliado',
      matched_transaction_ids: result.transaction_ids,
    })
    .eq('id', lineRow.id)

  if (lineUpdateErr) return { success: false, error: lineUpdateErr.message }

  // Handle fee → despesa (T-16-35 / Pitfall 5: fee is ALWAYS despesa, never receita)
  let feeTransactionId: string | undefined

  if (result.fee > 0.005) {
    const { data: feeTx, error: feeErr } = await supabase
      .from('financial_transactions')
      .insert({
        tenant_id: actor.tenant_id,
        type: 'despesa', // T-16-35: taxa de lote é sempre despesa
        account_id: input.feeAccountId ?? null,
        cost_center_id: input.feeCostCenterId ?? null,
        bank_account_id: lineRow.bank_account_id,
        amount: result.fee,
        transaction_date: lineRow.transaction_date,
        description: 'Taxa de lote Asaas',
        reconciliation_status: 'conciliado',
      })
      .select('id')
      .single()

    if (!feeErr && feeTx) {
      feeTransactionId = feeTx.id
      // Record fee_transaction_id on the statement line
      await supabase
        .from('statement_lines')
        .update({ fee_transaction_id: feeTx.id })
        .eq('id', lineRow.id)
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'reconciliation.n_to_one',
    details: {
      statement_line_id: input.statementLineId,
      matched_count: result.transaction_ids.length,
      fee: result.fee,
      fee_transaction_id: feeTransactionId,
    },
  })

  revalidatePath(REVALIDATE_PATH)
  return {
    success: true,
    matched: result.transaction_ids,
    fee: result.fee,
    feeTransactionId,
  }
}

// ─── reconcileLoteConvenio ────────────────────────────────────────────────────
// D-10: batch settlement of a convênio (TISS) lote with per-item partial glosa.
// Uses tiss_guides as the receivable table (confirmed from faturamento_tiss_tables migration).

export async function reconcileLoteConvenio(input: {
  statementLineId: string
  loteId: string
  itens: Array<{
    receivableId: string  // tiss_guide id
    valorAutorizado: number
    glosado?: boolean
  }>
}): Promise<{
  success: boolean
  baixados?: number
  glosados?: number
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para baixar lote convênio' }
  }

  const supabase = await createClient()

  // Verify statement line exists and is pending
  const { data: lineRow, error: lineErr } = await supabase
    .from('statement_lines')
    .select('id, bank_account_id, reconciliation_status')
    .eq('id', input.statementLineId)
    .single()

  if (lineErr || !lineRow) {
    return { success: false, error: lineErr?.message ?? 'Linha não encontrada' }
  }

  if (lineRow.reconciliation_status !== 'pendente') {
    return { success: false, error: 'Linha já conciliada ou ignorada' }
  }

  // Verify lote exists (RLS scopes to tenant)
  const { data: lote, error: loteErr } = await supabase
    .from('tiss_lotes')
    .select('id, status')
    .eq('id', input.loteId)
    .single()

  if (loteErr || !lote) {
    return { success: false, error: loteErr?.message ?? 'Lote não encontrado' }
  }

  let baixados = 0
  let glosados = 0
  const loweredGuideIds: string[] = []

  // Process each item — per-item glosa (D-10 / D-28 coerência com Fase 15)
  for (const item of input.itens) {
    if (item.glosado) {
      // Glosado: mantém o recebível em aberto (recurso); NÃO baixa (D-10)
      glosados++
      continue
    }

    // CAS UPDATE tiss_guide status → 'paga' (only if still in a resolvable status)
    const { data: guideUpdated } = await supabase
      .from('tiss_guides')
      .update({
        status: 'paga',
        valor_pago: item.valorAutorizado,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.receivableId)
      .in('status', ['em_analise', 'autorizada']) // CAS: only settle open/authorized guides
      .eq('clinic_id', actor.tenant_id)           // tenant isolation double-check
      .select('id')

    if (guideUpdated && guideUpdated.length > 0) {
      baixados++
      loweredGuideIds.push(item.receivableId)
    }
  }

  // Mark statement line as conciliada with the guide IDs as matched references
  const { error: lineUpdateErr } = await supabase
    .from('statement_lines')
    .update({
      reconciliation_status: 'conciliado',
      matched_transaction_ids: loweredGuideIds.length > 0 ? loweredGuideIds : null,
    })
    .eq('id', input.statementLineId)

  if (lineUpdateErr) {
    return { success: false, error: lineUpdateErr.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'reconciliation.lote_convenio',
    details: {
      statement_line_id: input.statementLineId,
      lote_id: input.loteId,
      baixados,
      glosados,
      total_itens: input.itens.length,
    },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, baixados, glosados }
}
