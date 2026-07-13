'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { npsSubmitSchema } from '@/lib/validators/crc'
import { classifyNps, computeNpsScore, type NpsBucket } from '@/lib/crc/roi-math'

/**
 * NPS collection Server Actions (CRC-04)
 *
 * submitNpsPublic (public, no session — TOCTOU-safe atomic single-use submit,
 * D-13) / markDetractorTreated (D-15) / listNpsResponses / getNpsSummary (panel
 * reads, Plan 10 consumers).
 *
 * SECURITY:
 *   1. submitNpsPublic is the ONLY unauthenticated action here — the atomic
 *      conditional UPDATE (token_used_at IS NULL AND score IS NULL) IS the
 *      security boundary (mirrors submitAnamnesisPublic WR-05), not any
 *      page-level read check. Generic error message never distinguishes
 *      invalid/expired/used/already-scored (T-18-20/T-18-21).
 *   2. markDetractorTreated — assertNotReadOnly() + WRITER_ROLES gate; RLS
 *      (nps_responses_treat_update) backstops tenant isolation.
 *   3. listNpsResponses / getNpsSummary — RLS-aware createClient() (tenant_read
 *      policy enforces isolation at the DB level).
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

// ─── submitNpsPublic ─────────────────────────────────────────────────────────
// PUBLIC Server Action (no auth session) — called from the public /nps/[patient-id]/[token]
// page. Uses service-role client (createAdminClient) to bypass RLS (mirrors
// submitAnamnesisPublic, T-2-07/WR-05 discipline).
//
// TOCTOU-safe single-use gate via atomic conditional UPDATE:
//   WHERE token = $token
//     AND patient_id = $patientId
//     AND token_used_at IS NULL
//     AND token_expires_at > now()
//     AND score IS NULL
// If 0 rows -> invalid/expired/used/already-submitted -> SAME generic message
// (T-18-21: never reveal detractor status or distinguish the failure reason).
// The public form's read-then-render check (Plan 10) is NOT the security
// boundary — this atomic UPDATE is.

export async function submitNpsPublic(input: {
  patientId: string
  token: string
  score: number
  comment?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!input.patientId || !input.token) {
    return { success: false, error: 'Dados incompletos' }
  }

  const parsed = npsSubmitSchema.safeParse({ score: input.score, comment: input.comment })
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Atomic conditional UPDATE — single-use gate (T-18-20). Only succeeds if:
  // token matches, patient_id matches, not yet used, not expired, and no score
  // has been recorded yet (score IS NULL guards against a benign double-submit
  // race landing two UPDATEs before token_used_at commits).
  const { data: rows, error: updateError } = await admin
    .from('nps_responses')
    .update({
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
      token_used_at: now,
    })
    .eq('token', input.token)
    .eq('patient_id', input.patientId)
    .is('token_used_at', null)
    .gt('token_expires_at', now)
    .is('score', null)
    .select('id, clinic_id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 0 rows returned -> token invalid, expired, already used, or already scored.
  // T-18-21: same generic message — never distinguishes the reason, never
  // leaks the classification (promotor/neutro/detrator) to the public caller.
  if (!rows || rows.length === 0) {
    return { success: false, error: 'Link inválido ou já utilizado' }
  }

  const row = rows[0]!

  // Audit: score + IDs only, no comment text (T-4-worker-phi-style convention).
  await logBusinessEvent({
    tenantId: row.clinic_id,
    actorId: null,
    action: 'crc.nps.submitted',
    details: {
      nps_response_id: row.id,
      patient_id: input.patientId,
      score: parsed.data.score,
    },
  })

  return { success: true }
}

// ─── markDetractorTreated ────────────────────────────────────────────────────
// D-15: closes the internal loop for a detrator (score 0-6) — recepção/gestor
// marks the rescue as handled. No automated message to the patient.

export async function markDetractorTreated(
  npsResponseId: string,
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

  const { data: rows, error } = await supabase
    .from('nps_responses')
    .update({ detractor_treated_at: new Date().toISOString() })
    .eq('id', npsResponseId)
    .eq('clinic_id', actor.tenant_id)
    .gte('score', 0)
    .lte('score', 6)
    .select('id')

  if (error) {
    return { success: false, error: error.message }
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: 'Registro não encontrado ou não é um detrator' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.nps.detractor_treated',
    details: { nps_response_id: npsResponseId },
  })

  revalidatePath('/clinica/crc/nps')

  return { success: true }
}

// ─── listNpsResponses ────────────────────────────────────────────────────────
// Panel table read (Plan 10 consumer) — answered responses only (score IS NOT
// NULL), classified via classifyNps for the promotor/neutro/detrator column.

export type NpsResponseRow = {
  id: string
  patientName: string
  score: number
  comment: string | null
  bucket: NpsBucket
  detractorTreatedAt: string | null
  createdAt: string
}

export async function listNpsResponses(filters?: {
  from?: string
  to?: string
  unitId?: string
}): Promise<{ success: boolean; data?: NpsResponseRow[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  let query = supabase
    .from('nps_responses')
    .select('id, score, comment, detractor_treated_at, created_at, unit_id, patients(full_name)')
    .eq('clinic_id', actor.tenant_id)
    .not('score', 'is', null)
    .order('created_at', { ascending: false })

  if (filters?.from) query = query.gte('created_at', filters.from)
  if (filters?.to) query = query.lte('created_at', filters.to)
  if (filters?.unitId) query = query.eq('unit_id', filters.unitId)

  const { data: rows, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const data: NpsResponseRow[] = (
    (rows ?? []) as Array<{
      id: string
      score: number
      comment: string | null
      detractor_treated_at: string | null
      created_at: string
      patients: { full_name: string } | { full_name: string }[] | null
    }>
  ).map((row) => {
    const patientRel = row.patients
    const patientName = Array.isArray(patientRel)
      ? patientRel[0]?.full_name ?? ''
      : patientRel?.full_name ?? ''

    return {
      id: row.id,
      patientName,
      score: row.score,
      comment: row.comment,
      bucket: classifyNps(row.score),
      detractorTreatedAt: row.detractor_treated_at,
      createdAt: row.created_at,
    }
  })

  return { success: true, data }
}

// ─── getNpsSummary ────────────────────────────────────────────────────────────
// D-14: NPS = %promotores - %detratores. Powers NpsScoreCard + DetractorAlertBanner
// (Plan 10) — detractorsPending counts unresolved detractors (D-15 alert).

export type NpsSummary = {
  score: number | null
  promotores: number
  neutros: number
  detratores: number
  detractorsPending: number
}

export async function getNpsSummary(filters?: {
  from?: string
  to?: string
  unitId?: string
}): Promise<{ success: boolean; data?: NpsSummary; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  let query = supabase
    .from('nps_responses')
    .select('score, detractor_treated_at, unit_id, created_at')
    .eq('clinic_id', actor.tenant_id)
    .not('score', 'is', null)

  if (filters?.from) query = query.gte('created_at', filters.from)
  if (filters?.to) query = query.lte('created_at', filters.to)
  if (filters?.unitId) query = query.eq('unit_id', filters.unitId)

  const { data: rows, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const typedRows = (rows ?? []) as Array<{ score: number; detractor_treated_at: string | null }>
  const scores = typedRows.map((r) => r.score)

  let promotores = 0
  let neutros = 0
  let detratores = 0
  let detractorsPending = 0

  for (const row of typedRows) {
    const bucket = classifyNps(row.score)
    if (bucket === 'promotor') promotores++
    else if (bucket === 'neutro') neutros++
    else {
      detratores++
      if (!row.detractor_treated_at) detractorsPending++
    }
  }

  return {
    success: true,
    data: {
      score: computeNpsScore(scores),
      promotores,
      neutros,
      detratores,
      detractorsPending,
    },
  }
}
