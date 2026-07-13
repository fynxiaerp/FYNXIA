'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { differenceInDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { leadSchema, LEAD_STAGES, isValidStageTransition, type LeadStage } from '@/lib/validators/crc'

/**
 * Lead funnel Server Actions (CRC-01/CRC-02)
 *
 * createLead / listLeadsByStage / moveLeadStage / convertLead / listConversionByOrigin.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — rejects auditor/dpo/socio at action layer (T-18-07)
 *   2. WRITER_ROLES gate — no 'marketing' role exists (Pitfall 7); receptionist +
 *      admin + superadmin may write (mirrors leads_write RLS policy)
 *   3. clinic_id always set from actor.tenant_id (never from client input)
 *   4. isValidStageTransition() rejects illegal jumps (T-18-08); convertLead uses
 *      a CAS guard (`.eq('stage', current)`) so a concurrent convert loses the
 *      race instead of double-converting/double-crediting (T-18-09)
 *   5. RLS (leads_write) backstops tenant isolation (T-18-10)
 */

// ─── Helper: get authenticated actor ────────────────────────────────────────

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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ─── Helper: resolve the actor's default unit ───────────────────────────────
// D-246: leads.unit_id is NOT NULL but has no client-facing selector yet —
// resolve the clinic's default unit (is_default DESC), mirroring listUnits().

async function resolveDefaultUnitId(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('units')
    .select('id')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name')
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value)
}

// ─── createLead ───────────────────────────────────────────────────────────────
// D-01: new leads start at stage 'novo'. D-16: 'Indicação' source + a linked
// referrer patient also creates the referral row (Plan 04's linkReferral).

export async function createLead(rawInput: unknown): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  await assertNotReadOnly()

  const parsed = leadSchema.safeParse(rawInput)
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

  const unitId = await resolveDefaultUnitId(supabase, actor.tenant_id)
  if (!unitId) {
    return { success: false, error: 'Nenhuma unidade configurada para esta clínica' }
  }

  // Fetch source name to detect the 'Indicação' origin (D-16)
  const { data: sourceRow } = await supabase
    .from('lead_sources')
    .select('name')
    .eq('id', data.source_id)
    .maybeSingle()

  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unitId,
      source_id: data.source_id,
      full_name: data.full_name,
      phone: data.phone || null,
      email: data.email || null,
      referred_by_patient_id: data.referred_by_patient_id ?? null,
      notes: data.notes || null,
      stage: 'novo',
    })
    .select('id')
    .single()

  if (insertError || !lead) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar lead' }
  }

  // D-16: origin 'Indicação' + a linked referrer patient → also register the
  // referral (Plan 04's src/actions/referrals.ts). Dynamic import via a
  // non-literal specifier (D-144 convention) so `tsc` never fails to resolve
  // this module before Plan 04 lands; the referral link is a safe no-op
  // otherwise and must never block lead creation.
  if (data.referred_by_patient_id && sourceRow?.name === 'Indicação') {
    try {
      const referralsModulePath = '@/actions/referrals'
      const referralsModule = await import(referralsModulePath)
      if (typeof referralsModule.linkReferral === 'function') {
        await referralsModule.linkReferral({
          referrer_patient_id: data.referred_by_patient_id,
          lead_id: lead.id,
        })
      }
    } catch (err) {
      console.error('[createLead] linkReferral unavailable or failed:', err)
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.lead.created',
    details: { lead_id: lead.id, source_id: data.source_id },
  })

  revalidatePath('/clinica/crc/funil')

  return { success: true, id: lead.id }
}

// ─── listLeadsByStage ─────────────────────────────────────────────────────────
// Kanban columns: leads grouped by the 5 funnel stages, plus `diasNoEstagio`
// (days since stage_changed_at) for the LeadCard "X dias no estágio" badge.

export type LeadCardRow = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  stage: LeadStage
  source_id: string
  source_name: string | null
  stage_changed_at: string
  campaign_id: string | null
  diasNoEstagio: number
}

export async function listLeadsByStage(): Promise<{
  success: boolean
  leadsByStage?: Record<LeadStage, LeadCardRow[]>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('leads')
    .select(
      'id, full_name, phone, email, stage, source_id, stage_changed_at, campaign_id, lead_sources(name)'
    )
    .is('deleted_at', null)
    .order('stage_changed_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const now = new Date()
  const grouped: Record<LeadStage, LeadCardRow[]> = {
    novo: [],
    contatado: [],
    agendado: [],
    convertido: [],
    perdido: [],
  }

  for (const row of (rows ?? []) as Array<{
    id: string
    full_name: string
    phone: string | null
    email: string | null
    stage: string
    source_id: string
    stage_changed_at: string
    campaign_id: string | null
    lead_sources: { name: string } | { name: string }[] | null
  }>) {
    if (!isLeadStage(row.stage)) continue

    const sourceRel = row.lead_sources
    const sourceName = Array.isArray(sourceRel) ? sourceRel[0]?.name ?? null : sourceRel?.name ?? null

    grouped[row.stage].push({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      stage: row.stage,
      source_id: row.source_id,
      source_name: sourceName,
      stage_changed_at: row.stage_changed_at,
      campaign_id: row.campaign_id,
      diasNoEstagio: differenceInDays(now, new Date(row.stage_changed_at)),
    })
  }

  return { success: true, leadsByStage: grouped }
}

// ─── moveLeadStage ──────────────────────────────────────────────────────────
// D-02: Kanban drag-and-drop persistence. 3-arg contract (leadId, newStage,
// lostReason?) — lost_reason is persisted ONLY when newStage === 'perdido'.
// 'convertido' is rejected here — conversion has its own flow (D-04, convertLead).

export async function moveLeadStage(
  leadId: string,
  newStage: string,
  lostReason?: string
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('leads')
    .select('id, stage')
    .eq('id', leadId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !current) {
    return { success: false, error: fetchError?.message ?? 'Lead não encontrado' }
  }

  if (newStage === 'convertido') {
    return { success: false, error: 'Use convertLead para converter um lead' }
  }

  if (!isValidStageTransition(current.stage, newStage)) {
    return { success: false, error: 'Transição de estágio inválida' }
  }

  const updatePayload: {
    stage: string
    stage_changed_at: string
    lost_reason?: string | null
  } = {
    stage: newStage,
    stage_changed_at: new Date().toISOString(),
  }
  // 3-arg contract: persist lost_reason ONLY when newStage === 'perdido'; ignore otherwise.
  if (newStage === 'perdido') {
    updatePayload.lost_reason = lostReason ?? null
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.lead.stage_changed',
    details: {
      lead_id: leadId,
      from: current.stage,
      to: newStage,
      lost_reason: newStage === 'perdido' ? lostReason ?? null : undefined,
    },
  })

  revalidatePath('/clinica/crc/funil')

  return { success: true }
}
