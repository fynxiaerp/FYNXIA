'use server'
/**
 * src/actions/partner-shares.ts — Societário Server Actions (REP-03, Plan 19-06).
 *
 * Partner-share vigência CRUD (with the blocking sum-to-100% validation and history
 * preservation) + sócio listing + R$ distribution over the consolidated period result.
 * Distribution is purely informative (D-26) — no financial_transactions writes here.
 *
 * SECURITY (T-19-10, A1):
 *   partner_shares RLS already restricts WRITE to admin/superadmin (Plan 03 migration:
 *   supabase/migrations/20260719000200_bi_rls.sql), but the role gate is ENFORCED HERE
 *   TOO (defense-in-depth) — mirrors BUDGET_WRITE_ROLES in budget-targets.ts /
 *   DRE_ROLES in dre.ts / COST_ROLES in lab-orders.ts.
 *
 * INTEGRITY (T-19-09, D-22):
 *   createPartnerShareVigencia rejects a proposed share set whose active percentuais
 *   do not sum to exactly 100% (tolerance 0.0001) — validated BEFORE any write.
 *
 * HISTORY (D-20):
 *   Saving a new vigência first closes all currently-open vigências (vigencia_fim
 *   IS NULL) by setting vigencia_fim = the day before the new vigencia_inicio
 *   (priorCloseDate), then inserts the new rows — never mutates/deletes prior history.
 *
 * DISTRIBUTION (D-21/D-23/D-27):
 *   getPartnerDistribution computes the CONSOLIDATED resultado (all units, no
 *   cost_center filter — includes NULL-cost_center rows) INLINE from
 *   financial_transactions, then applies distributeResult (Plan 01 pure math) using
 *   the period-start date to resolve which vigência is active. Negative resultado
 *   distributes as negative per-sócio values — never zeroed/clamped.
 *
 * INFORMATION DISCLOSURE (T-19-02):
 *   listPartnerShares/getPartnerDistribution rely on partner_shares RLS
 *   (partner_shares_self_or_admin_read) to scope rows — admin/superadmin see all,
 *   socio sees only their own row. No client-trusted filtering is layered on top.
 */
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { partnerShareSetSchema } from '@/lib/financeiro/partner-share-schema'
import {
  validateSharesSumTo100,
  distributeResult,
  type ShareRow,
} from '@/lib/financeiro/partner-share-math'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

const SHARE_WRITE_ROLES = ['admin', 'superadmin'] as const

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

// ─── Helper: Societário write role gate (T-19-10, A1) ────────────────────────

async function requireShareWriteActor(): Promise<{ actor: Actor } | { error: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return actorResult
  }
  const { actor } = actorResult
  if (!(SHARE_WRITE_ROLES as readonly string[]).includes(actor.role)) {
    return { error: 'Permissão insuficiente para gerenciar o quadro societário' }
  }
  return { actor }
}

// ─── priorCloseDate — pure D-20 day-before derivation ────────────────────────
// Exported async — every top-level export of a 'use server' file must be an async
// function (D-141/D-142/D-143 precedent, mirrors isMonthLocked/computeBudgetCell
// em src/actions/budget-targets.ts). Uses Date.UTC to avoid timezone drift —
// 'YYYY-MM-DD' strings are parsed/reformatted as UTC calendar dates only.

export async function priorCloseDate(newInicio: string): Promise<string> {
  const parts = newInicio.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 1)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ─── assertSharesValid — pure D-22 sum-to-100% validation ────────────────────
// Wraps validateSharesSumTo100 (Plan 01 pure math) against a proposed vigência set
// (all rows active on `data`, no vigencia_fim yet).

export async function assertSharesValid(
  shares: Array<{ userId: string; percentual: number }>,
  data: string
): Promise<{ valid: boolean; sum: number }> {
  const rows: ShareRow[] = shares.map((s) => ({
    user_id: s.userId,
    percentual: s.percentual,
    vigencia_inicio: data,
    vigencia_fim: null,
  }))
  return validateSharesSumTo100(rows, data)
}

// ─── listSocios (D-25) ─────────────────────────────────────────────────────────
// A sócio is a users row with role='socio' in the caller's tenant.

export interface SocioRow {
  id: string
  name: string
  email: string
}

export async function listSocios(): Promise<{
  success: boolean
  socios?: SocioRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('tenant_id', actor.tenant_id)
    .eq('role', 'socio')
    .order('full_name')

  if (error) {
    return { success: false, error: error.message }
  }

  const socios: SocioRow[] = ((data ?? []) as Array<{ id: string; full_name: string; email: string }>).map(
    (row) => ({ id: row.id, name: row.full_name, email: row.email })
  )

  return { success: true, socios }
}

// ─── listPartnerShares ─────────────────────────────────────────────────────────
// All partner_shares rows visible to the caller (RLS: admin/superadmin see all,
// socio sees own row only — T-19-02).

export interface PartnerShareRow {
  id: string
  userId: string
  percentual: number
  vigenciaInicio: string
  vigenciaFim: string | null
}

export async function listPartnerShares(): Promise<{
  success: boolean
  shares?: PartnerShareRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('partner_shares')
    .select('id, user_id, percentual, vigencia_inicio, vigencia_fim')
    .order('vigencia_inicio', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const shares: PartnerShareRow[] = (
    (data ?? []) as Array<{
      id: string
      user_id: string
      percentual: number
      vigencia_inicio: string
      vigencia_fim: string | null
    }>
  ).map((row) => ({
    id: row.id,
    userId: row.user_id,
    percentual: row.percentual,
    vigenciaInicio: row.vigencia_inicio,
    vigenciaFim: row.vigencia_fim,
  }))

  return { success: true, shares }
}

// ─── createPartnerShareVigencia ────────────────────────────────────────────────
// D-20/D-22/T-19-09/T-19-10: validate shape → role gate → sum-to-100% gate →
// close prior open vigências → insert new vigência rows.

export async function createPartnerShareVigencia(input: {
  vigenciaInicio: string
  shares: Array<{ userId: string; percentual: number }>
}): Promise<{ success: boolean; error?: string }> {
  // 1. Validate shape
  const parsed = partnerShareSetSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate (T-19-10, A1)
  const actorResult = await requireShareWriteActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 3. Sum-to-100% gate (D-22, T-19-09) — BEFORE any INSERT
  const validation = await assertSharesValid(data.shares, data.vigenciaInicio)
  if (!validation.valid) {
    return {
      success: false,
      error: 'A soma dos percentuais deve ser exatamente 100%. Ajuste os valores antes de salvar.',
    }
  }

  const supabase = await createClient()

  // 4. Close prior open vigências (D-20) — preserves history, no gaps/overlaps
  const closeDate = await priorCloseDate(data.vigenciaInicio)

  const { error: closeError } = await supabase
    .from('partner_shares')
    .update({ vigencia_fim: closeDate, updated_at: new Date().toISOString() })
    .eq('clinic_id', actor.tenant_id)
    .is('vigencia_fim', null)

  if (closeError) {
    return { success: false, error: closeError.message }
  }

  // 5. Insert new vigência rows (vigencia_fim=NULL — this set becomes vigente)
  const { error: insertError } = await supabase.from('partner_shares').insert(
    data.shares.map((s) => ({
      clinic_id: actor.tenant_id,
      user_id: s.userId,
      percentual: s.percentual,
      vigencia_inicio: data.vigenciaInicio,
      vigencia_fim: null,
      created_by: actor.id,
    }))
  )

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'partner_share.vigencia_created',
    details: { vigencia_inicio: data.vigenciaInicio, socios: data.shares.length },
  })

  return { success: true }
}

// ─── closePartnerShareVigencia ("Encerrar vigência", destructive) ────────────
// T-19-10, A1: role gate. Sets vigencia_fim = today for the open rows of the
// given vigência (does not delete rows — history preserved).

export async function closePartnerShareVigencia(params: {
  vigenciaInicio: string
}): Promise<{ success: boolean; error?: string }> {
  const actorResult = await requireShareWriteActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('partner_shares')
    .update({ vigencia_fim: today, updated_at: new Date().toISOString() })
    .eq('clinic_id', actor.tenant_id)
    .eq('vigencia_inicio', params.vigenciaInicio)
    .is('vigencia_fim', null)

  if (error) {
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'partner_share.vigencia_closed',
    details: { vigencia_inicio: params.vigenciaInicio },
  })

  return { success: true }
}

// ─── getPartnerDistribution (D-21/D-23/D-27) ──────────────────────────────────
// Computes the CONSOLIDATED resultado (all units, no cost_center filter — D-21)
// INLINE from financial_transactions, then distributes it across the active
// partner_shares (RLS-scoped — admin sees all sócios, socio sees only its own row).
// Purely informative — NEVER writes financial_transactions (D-26).

export interface PartnerDistributionRow {
  userId: string
  name: string
  percentual: number
  valor: number
}

export async function getPartnerDistribution(params: {
  from: string
  to: string
}): Promise<{
  success: boolean
  resultado?: number
  distribution?: PartnerDistributionRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  // 1. partner_shares — RLS scopes rows (admin all, socio own — T-19-02)
  const { data: shareRows, error: sharesError } = await supabase
    .from('partner_shares')
    .select('user_id, percentual, vigencia_inicio, vigencia_fim')

  if (sharesError) {
    return { success: false, error: sharesError.message }
  }

  const shares: ShareRow[] = (
    (shareRows ?? []) as Array<{
      user_id: string
      percentual: number
      vigencia_inicio: string
      vigencia_fim: string | null
    }>
  ).map((row) => ({
    user_id: row.user_id,
    percentual: row.percentual,
    vigencia_inicio: row.vigencia_inicio,
    vigencia_fim: row.vigencia_fim,
  }))

  // 2. Consolidated resultado INLINE (D-21) — NO cost_center filter, all units
  // incl. NULL-cost_center rows. Do NOT import getDre (keeps this plan decoupled
  // from Plan 04 / wave 2).
  const { data: txRows, error: txError } = await supabase
    .from('financial_transactions')
    .select('type, amount')
    .gte('transaction_date', params.from)
    .lte('transaction_date', params.to)

  if (txError) {
    return { success: false, error: txError.message }
  }

  const resultado = ((txRows ?? []) as Array<{ type: string; amount: number }>).reduce((total, tx) => {
    if (tx.type === 'receita') return total + tx.amount
    if (tx.type === 'despesa') return total - tx.amount
    return total
  }, 0)

  // 3. Distribute (Plan 01 pure math) — period-start date resolves the active
  // vigência (D-20). Sign preserved (D-27) — negative resultado → negative valor.
  const distributed = distributeResult(shares, params.from, resultado)

  // 4. Attach sócio display names (D-25). admin/superadmin get the full list; a
  // socio session naturally receives only its own row because RLS already
  // filtered partner_shares — no extra client-trusted filtering added here.
  const sociosResult = await listSocios()
  const nameMap = new Map<string, string>()
  if (sociosResult.success) {
    for (const s of sociosResult.socios ?? []) {
      nameMap.set(s.id, s.name)
    }
  }

  const distribution: PartnerDistributionRow[] = distributed.map((d) => ({
    userId: d.user_id,
    name: nameMap.get(d.user_id) ?? '—',
    percentual: d.percentual,
    valor: d.valor,
  }))

  return { success: true, resultado, distribution }
}
