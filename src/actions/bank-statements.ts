'use server'
import 'server-only'

/**
 * src/actions/bank-statements.ts — Bank Statement Server Actions (FOP-02)
 *
 * importOFX: parse OFX buffer → insert bank_statements + statement_lines.
 *   Idempotent via ON CONFLICT (bank_account_id, fitid) / (bank_account_id, fitid_fallback).
 *   FITID hash fallback (D-11): SHA-256 of "${bankAccountId}|${date}|${amount}|${memo}".
 *
 * listStatementLines: tenant-scoped list of statement lines with optional filters.
 *
 * Security / Threats:
 *   T-16-31: bank_account ownership enforced by RLS; clinic_id always from actor.tenant_id.
 *   T-16-32: upsert with ignoreDuplicates=true — reimport never duplicates lines.
 *   T-16-33: writer gate ['admin','superadmin'] in every mutating action.
 */

import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { parseOfxBuffer } from '@/lib/financeiro/ofx-parser'
import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'

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

// ─── Writer gate ──────────────────────────────────────────────────────────────
// D-23 / T-16-33: same role set as the RLS of 16-03

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── importOFX ───────────────────────────────────────────────────────────────
// FOP-02: parse + persist bank statement lines, idempotent by FITID (D-11).

export async function importOFX(input: {
  bankAccountId: string
  filename: string
  buffer: Buffer
}): Promise<{
  success: boolean
  statementId?: string
  imported?: number
  skipped?: number
  warnings?: string[]
  error?: string
}> {
  // 1. Actor + writer gate (T-16-33)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para importar extrato' }
  }

  const supabase = await createClient()

  // 2. Re-validate bank_account ownership via RLS (T-16-31)
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', input.bankAccountId)
    .single()

  if (!account) {
    return { success: false, error: 'Conta bancária não encontrada' }
  }

  // 3. Parse OFX buffer via pure lib (NEVER reimplement parsing here)
  const { lines, warnings } = await parseOfxBuffer(input.buffer)

  if (lines.length === 0) {
    return { success: false, error: 'Nenhuma transação no OFX', warnings }
  }

  // 4. Compute statement period (min/max of line dates)
  const dates = lines.map((l) => l.date.getTime())
  const periodoInicio = new Date(Math.min(...dates)).toISOString().slice(0, 10)
  const periodoFim = new Date(Math.max(...dates)).toISOString().slice(0, 10)

  // 5. Insert bank_statement header
  const { data: stmt, error: stmtError } = await supabase
    .from('bank_statements')
    .insert({
      clinic_id: actor.tenant_id,      // always from actor — never from input (T-16-31)
      bank_account_id: input.bankAccountId,
      fonte: 'ofx',
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      filename: input.filename,
      imported_by: actor.id,
    })
    .select('id')
    .single()

  if (stmtError || !stmt) {
    return { success: false, error: stmtError?.message ?? 'Erro ao criar registro do extrato' }
  }

  const statementId = stmt.id

  // 6. Build line rows — FITID or hash fallback (D-11)
  type LineRow = {
    clinic_id: string
    bank_account_id: string
    bank_statement_id: string
    transaction_date: string
    amount: number
    memo: string
    check_number: string | null
    reconciliation_status: string
    fitid: string | null
    fitid_fallback: string | null
  }

  const rowsWithFitid: LineRow[] = []
  const rowsWithFallback: LineRow[] = []

  for (const line of lines) {
    const date = line.date.toISOString().slice(0, 10)
    const base: Omit<LineRow, 'fitid' | 'fitid_fallback'> = {
      clinic_id: actor.tenant_id,
      bank_account_id: input.bankAccountId,
      bank_statement_id: statementId,
      transaction_date: date,
      amount: line.amount,
      memo: line.memo,
      check_number: line.check_number ?? null,
      reconciliation_status: 'pendente',
    }

    if (line.fitid && line.fitid.trim().length > 0) {
      rowsWithFitid.push({ ...base, fitid: line.fitid.trim(), fitid_fallback: null })
    } else {
      // Hash fallback: SHA-256 of "${bankAccountId}|${date}|${amount}|${memo}" (D-11)
      const hash = createHash('sha256')
        .update(`${input.bankAccountId}|${date}|${line.amount}|${line.memo}`)
        .digest('hex')
      rowsWithFallback.push({ ...base, fitid: null, fitid_fallback: hash })
    }
  }

  // 7. Upsert with idempotency (T-16-32)
  let importedCount = 0

  if (rowsWithFitid.length > 0) {
    const { data: inserted, error: upsertErr } = await supabase
      .from('statement_lines')
      .upsert(rowsWithFitid, { onConflict: 'bank_account_id,fitid', ignoreDuplicates: true })
      .select('id')

    if (upsertErr) {
      return { success: false, error: upsertErr.message }
    }
    importedCount += (inserted ?? []).length
  }

  if (rowsWithFallback.length > 0) {
    const { data: inserted, error: upsertErr } = await supabase
      .from('statement_lines')
      .upsert(rowsWithFallback, { onConflict: 'bank_account_id,fitid_fallback', ignoreDuplicates: true })
      .select('id')

    if (upsertErr) {
      return { success: false, error: upsertErr.message }
    }
    importedCount += (inserted ?? []).length
  }

  const totalLines = lines.length
  const skippedCount = totalLines - importedCount

  // 8. Audit + revalidate
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'import_ofx',
    details: {
      statement_id: statementId,
      bank_account_id: input.bankAccountId,
      filename: input.filename,
      imported: importedCount,
      skipped: skippedCount,
      total: totalLines,
    },
  })

  revalidatePath('/clinica/financeiro/conciliacao')

  return {
    success: true,
    statementId,
    imported: importedCount,
    skipped: skippedCount,
    warnings,
  }
}

// ─── listStatementLines ───────────────────────────────────────────────────────
// Returns tenant-scoped statement lines with optional filters (FOP-02 UI listing).

export async function listStatementLines(filters: {
  bankAccountId?: string
  status?: string
  from?: string
  to?: string
}): Promise<{
  success: boolean
  lines?: unknown[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  // RLS on statement_lines scopes to the actor's tenant automatically
  const supabase = await createClient()

  let query = supabase
    .from('statement_lines')
    .select(
      'id, bank_account_id, bank_statement_id, transaction_date, amount, memo, check_number, reconciliation_status, matched_transaction_ids, fee_transaction_id, fitid, fitid_fallback'
    )
    .order('transaction_date', { ascending: false })

  if (filters.bankAccountId) {
    query = query.eq('bank_account_id', filters.bankAccountId)
  }
  if (filters.status) {
    query = query.eq('reconciliation_status', filters.status)
  }
  if (filters.from) {
    query = query.gte('transaction_date', filters.from)
  }
  if (filters.to) {
    query = query.lte('transaction_date', filters.to)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, lines: data ?? [] }
}
