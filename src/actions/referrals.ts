'use server'
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { referralSchema, REFERRAL_REWARD_DEFAULT } from '@/lib/validators/crc'

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
// D-19: per-referrer patient rewards balance — saldoTotal (SUM of type=credito
// rows), indicacoesConvertidas (COUNT), saldoUtilizado (SUM of any non-credito
// ledger type, always 0 in v1 — no redemption rows are ever created by this
// phase), saldoDisponivel = total - utilizado. Feeds PatientRewardsBalanceTable
// (Plan 11).

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
    } else {
      // Forward-compat: any non-credito ledger type (redemption, Fase 20)
      // reduces the available balance. v1 never creates such rows.
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

// ─── creditReferralReward ───────────────────────────────────────────────────
// D-18 (T-18-11/12/13): called from convertLead (Plan 03) after a lead's
// stage CAS transition to 'convertido' succeeds. Runs on service role —
// referral_rewards has NO authenticated write policy (RLS Plan 02); the
// clinic_id used for the ledger insert is resolved from the referral row
// itself (never trusted from an ambient/session value, since this can be
// invoked in contexts without a session).
//
// Once-only guarantee: `UPDATE referrals SET credited_at = now() WHERE id = X
// AND credited_at IS NULL` — 0 affected rows means either already credited or
// a concurrent conversion won the race first; either way this call is a safe
// no-op and never double-inserts a referral_rewards row (T-18-11).
//
// Never crediting a non-converted lead: leads.stage is re-read here (not
// trusted from the caller) and must be exactly 'convertido' (T-18-12).
//
// Reward amount is always the server-side REFERRAL_REWARD_DEFAULT constant —
// never accepted as an argument (T-18-13). v1 creates ONLY credit-type ledger
// rows; no redemption rows are ever created by this phase (Open Question 2 in
// 18-RESEARCH.md).

export async function creditReferralReward(
  leadId: string
): Promise<{ success: boolean; credited: boolean; error?: string }> {
  const admin = createAdminClient()

  // 1. Find the referral tied to this lead (may be none — lead wasn't referred).
  const { data: referral, error: referralError } = await admin
    .from('referrals')
    .select('id, clinic_id, referrer_patient_id, credited_at')
    .eq('lead_id', leadId)
    .maybeSingle()

  if (referralError) {
    return { success: false, credited: false, error: referralError.message }
  }
  if (!referral) {
    return { success: true, credited: false }
  }
  if (referral.credited_at) {
    // Already credited — idempotent no-op, no re-check needed.
    return { success: true, credited: false }
  }

  // 2. Re-verify the lead actually reached 'convertido' (T-18-12) — never
  //    trust the caller's stage transition; re-read it here.
  const { data: lead, error: leadError } = await admin
    .from('leads')
    .select('id, stage')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError) {
    return { success: false, credited: false, error: leadError.message }
  }
  if (!lead || lead.stage !== 'convertido') {
    return { success: true, credited: false }
  }

  // 3. CAS: only the caller that flips credited_at from NULL wins the race.
  const { data: claimedRows, error: casError } = await admin
    .from('referrals')
    .update({ credited_at: new Date().toISOString(), reward_amount: REFERRAL_REWARD_DEFAULT })
    .eq('id', referral.id)
    .is('credited_at', null)
    .select('id')

  if (casError) {
    return { success: false, credited: false, error: casError.message }
  }
  if (!claimedRows || claimedRows.length === 0) {
    // Lost the race — another process already credited this referral.
    return { success: true, credited: false }
  }

  // 4. Only the CAS winner inserts the ledger row (type='credito' only, v1).
  const { error: ledgerError } = await admin.from('referral_rewards').insert({
    clinic_id: referral.clinic_id,
    patient_id: referral.referrer_patient_id,
    referral_id: referral.id,
    amount: REFERRAL_REWARD_DEFAULT,
    type: 'credito',
  })

  if (ledgerError) {
    return { success: false, credited: false, error: ledgerError.message }
  }

  await logBusinessEvent({
    tenantId: referral.clinic_id,
    actorId: null,
    action: 'crc.referral.credited',
    details: {
      referralId: referral.id,
      patientId: referral.referrer_patient_id,
      amount: REFERRAL_REWARD_DEFAULT,
      leadId,
    },
  })

  return { success: true, credited: true }
}
