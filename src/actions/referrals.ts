'use server'
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { referralSchema } from '@/lib/validators/crc'

/**
 * Referral program Server Actions (CRC-05)
 *
 * linkReferral / listReferrals / listRewardsBalance / creditReferralReward.
 *
 * SECURITY:
 *   1. assertNotReadOnly() on writes — rejects auditor/dpo/socio at action layer.
 *   2. WRITER_ROLES gate on linkReferral — no 'marketing' role exists
 *      (18-RESEARCH Pitfall 7); receptionist/admin/superadmin may write
 *      (mirrors referrals_write RLS policy).
 *   3. clinic_id always set from actor.tenant_id (never from client input).
 *   4. linkReferral is idempotent — UNIQUE(lead_id) on referrals makes a
 *      second call for the same lead a safe no-op (23505 treated as success).
 *   5. creditReferralReward (T-18-11/12/13): runs on service role
 *      (createAdminClient — referral_rewards has NO authenticated write
 *      policy, 18-CONTEXT/RLS Plan 02), CAS-guarded on `credited_at IS NULL`
 *      so a concurrent conversion cannot double-credit, re-verifies
 *      leads.stage === 'convertido' before crediting, and the reward amount
 *      is always the server-side REFERRAL_REWARD_DEFAULT constant — never
 *      client input.
 */

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Verbatim copy from src/actions/leads.ts (getActor pattern)

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

// No 'marketing' role exists in the 11-value role enum (18-RESEARCH Pitfall 7) —
// receptionist/admin/superadmin write, mirrors every other Phase 18 WRITER_ROLES.
const WRITER_ROLES = ['receptionist', 'admin', 'superadmin'] as const

// ─── linkReferral ─────────────────────────────────────────────────────────────
// D-16: registers who referred whom, tied 1:1 to a lead. Idempotent — UNIQUE
// (lead_id) means a duplicate call (e.g. createLead's dynamic import racing a
// manual LeadFormDialog call) is a safe no-op, not an error.

export async function linkReferral(input: {
  referrer_patient_id: string
  lead_id: string
}): Promise<{ success: boolean; alreadyLinked?: boolean; error?: string }> {
  await assertNotReadOnly()

  const parsed = referralSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { error: insertError } = await supabase.from('referrals').insert({
    clinic_id: actor.tenant_id,
    referrer_patient_id: data.referrer_patient_id,
    lead_id: data.lead_id,
  })

  if (insertError) {
    // 23505 = unique_violation on lead_id — already linked, treat as success (idempotent).
    if (insertError.code === '23505') {
      return { success: true, alreadyLinked: true }
    }
    return { success: false, error: insertError.message }
  }

  // Mirror the referrer onto leads.referred_by_patient_id if not already set
  // (createLead already sets this on insert; LeadFormDialog's linkReferral call
  // for an existing lead needs this fallback so both call sites stay consistent).
  await supabase
    .from('leads')
    .update({ referred_by_patient_id: data.referrer_patient_id })
    .eq('id', data.lead_id)
    .eq('clinic_id', actor.tenant_id)
    .is('referred_by_patient_id', null)

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.referral.linked',
    details: { referrer_patient_id: data.referrer_patient_id, lead_id: data.lead_id },
  })

  return { success: true }
}

// ─── listReferrals ────────────────────────────────────────────────────────────
// D-19: internal referrals list — referrer name, lead name/stage, reward amount,
// credited_at. RLS-scoped (referrals_tenant_read). Feeds ReferralsTable (Plan 11).

export type ReferralRow = {
  id: string
  referrerPatientId: string
  referrerName: string | null
  leadId: string
  leadName: string | null
  leadStage: string | null
  rewardAmount: number | null
  creditedAt: string | null
  createdAt: string
}

export async function listReferrals(): Promise<{
  success: boolean
  data?: ReferralRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('referrals')
    .select(
      'id, referrer_patient_id, lead_id, reward_amount, credited_at, created_at, patients!referrals_referrer_patient_id_fkey(full_name), leads(full_name, stage)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const data = (
    (rows ?? []) as Array<{
      id: string
      referrer_patient_id: string
      lead_id: string
      reward_amount: number | null
      credited_at: string | null
      created_at: string
      patients: { full_name: string } | { full_name: string }[] | null
      leads: { full_name: string; stage: string } | { full_name: string; stage: string }[] | null
    }>
  ).map((row) => {
    const referrer = Array.isArray(row.patients) ? row.patients[0] : row.patients
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
    return {
      id: row.id,
      referrerPatientId: row.referrer_patient_id,
      referrerName: referrer?.full_name ?? null,
      leadId: row.lead_id,
      leadName: lead?.full_name ?? null,
      leadStage: lead?.stage ?? null,
      rewardAmount: row.reward_amount,
      creditedAt: row.credited_at,
      createdAt: row.created_at,
    }
  })

  return { success: true, data }
}

// ─── listRewardsBalance ───────────────────────────────────────────────────────
// D-19: per-referrer patient rewards balance — saldoTotal (SUM type='credito'),
// indicacoesConvertidas (COUNT), saldoUtilizado (SUM type='uso', always 0 in v1 —
// no 'uso' rows are ever created by this phase), saldoDisponivel = total - utilizado.
// Feeds PatientRewardsBalanceTable (Plan 11).

export type RewardsBalanceRow = {
  patientId: string
  patientName: string | null
  indicacoesConvertidas: number
  saldoTotal: number
  saldoUtilizado: number
  saldoDisponivel: number
}

export async function listRewardsBalance(): Promise<{
  success: boolean
  data?: RewardsBalanceRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('referral_rewards')
    .select('patient_id, amount, type, patients(full_name)')

  if (error) {
    return { success: false, error: error.message }
  }

  const byPatient = new Map<
    string,
    { patientName: string | null; credito: number; uso: number; count: number }
  >()

  for (const row of (rows ?? []) as Array<{
    patient_id: string
    amount: number
    type: string
    patients: { full_name: string } | { full_name: string }[] | null
  }>) {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients
    const entry = byPatient.get(row.patient_id) ?? {
      patientName: patient?.full_name ?? null,
      credito: 0,
      uso: 0,
      count: 0,
    }
    if (row.type === 'credito') {
      entry.credito += row.amount
      entry.count += 1
    } else if (row.type === 'uso') {
      entry.uso += row.amount
    }
    byPatient.set(row.patient_id, entry)
  }

  const data: RewardsBalanceRow[] = Array.from(byPatient.entries()).map(
    ([patientId, entry]) => ({
      patientId,
      patientName: entry.patientName,
      indicacoesConvertidas: entry.count,
      saldoTotal: entry.credito,
      saldoUtilizado: entry.uso,
      saldoDisponivel: Number((entry.credito - entry.uso).toFixed(2)),
    })
  )

  return { success: true, data }
}
