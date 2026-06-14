'use server'
/**
 * OCR Server Actions — OCR-01 / OCR-02
 *
 * confirmOcrExtraction: reviewer confirms (or corrects) extracted fields →
 *   creates patient via existing createPatient path → marks extraction committed.
 *
 * rejectOcrExtraction: reviewer rejects the extraction → marks it rejected.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio at action layer
 *   2. clinic_id always from actor.tenant_id — never trusted from client
 *   3. logBusinessEvent — IDs only, no raw CPF (T-10-21)
 *   4. Human-reviewed editedFields are the SOURCE OF TRUTH (OCR-02)
 *
 * NOTE: Only async functions may be exported from a 'use server' file (Next.js constraint).
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { createPatient } from '@/actions/patients'

// ─── Internal types ───────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Zod v3 — matches patient form fields for the OCR pilot (RG/comprovante)
// full_name required; cpf in 000.000.000-00 format; birth_date → date_of_birth (YYYY-MM-DD)
// address optional but expected from comprovante de residência
const confirmedFieldsSchema = z.object({
  full_name: z.string().min(2, 'Nome completo deve ter pelo menos 2 caracteres'),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato 000.000.000-00'),
  birth_date: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Data de nascimento deve ser uma data ISO (YYYY-MM-DD)'
    ),
  address: z.string().optional(),
})

type ConfirmedFields = z.infer<typeof confirmedFieldsSchema>

// ─── Helper: get authenticated actor ─────────────────────────────────────────

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

// ─── confirmOcrExtraction ────────────────────────────────────────────────────

/**
 * Confirms (and optionally corrects) an OCR extraction result.
 *
 * The reviewer's editedFields are the SOURCE OF TRUTH (OCR-02).
 * The extracted data is validated and then written to the patient cadastro
 * via the existing createPatient Server Action (no duplicate insert logic).
 *
 * On success:
 *   - Creates a new patient record via createPatient()
 *   - Marks the ocr_extractions row as 'committed' with target_id = patientId
 *   - Logs the commit event (IDs only — no raw CPF per T-10-21)
 */
export async function confirmOcrExtraction(
  extractionId: string,
  editedFields: ConfirmedFields
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  // 1. Read-only gate — blocks auditor/dpo/socio (x-read-only header)
  await assertNotReadOnly()

  // 2. Validate input fields (human reviewer is authoritative but input is still validated)
  const parsed = confirmedFieldsSchema.safeParse(editedFields)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Campos inválidos' }
  }
  const fields = parsed.data

  // 3. Get actor (tenant-scoped)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 4. Load the extraction (RLS tenant-scoped via createClient)
  const supabase = await createClient()
  const { data: extraction, error: loadError } = await supabase
    .from('ocr_extractions')
    .select('id, status, deleted_at, clinic_id')
    .eq('id', extractionId)
    .eq('clinic_id', actor.tenant_id) // explicit tenant scope guard
    .single()

  if (loadError || !extraction) {
    return { success: false, error: 'Extração não encontrada' }
  }

  // Guard: only allow confirming non-deleted, non-committed extractions
  if (extraction.deleted_at !== null) {
    return { success: false, error: 'Extração foi excluída' }
  }
  if (extraction.status === 'committed') {
    return { success: false, error: 'Extração já foi confirmada anteriormente' }
  }
  if (extraction.status === 'rejected') {
    return { success: false, error: 'Extração foi rejeitada e não pode ser confirmada' }
  }

  // 5. Commit to patient cadastro — reuse the existing createPatient action
  //    Map OCR fields to PatientInput (birth_date → date_of_birth per patient schema)
  const patientResult = await createPatient({
    full_name: fields.full_name,
    cpf: fields.cpf,
    date_of_birth: fields.birth_date ?? undefined,
    address: fields.address ?? undefined,
  })

  if (!patientResult.success || !patientResult.id) {
    return {
      success: false,
      error: patientResult.error ?? 'Falha ao criar paciente',
    }
  }

  const patientId = patientResult.id

  // 6. Mark extraction as committed with target_id
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('ocr_extractions')
    .update({
      status: 'committed',
      reviewed_by: actor.id,
      reviewed_at: now,
      target_id: patientId,
    })
    .eq('id', extractionId)
    .eq('clinic_id', actor.tenant_id) // tenant scope guard on write

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 7. Audit log — IDs only, no raw CPF (T-10-21 / Pitfall 3)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'ocr.committed',
    details: {
      extractionId,
      target_table: 'patients',
      target_id: patientId,
    },
  })

  return { success: true, patientId }
}

// ─── rejectOcrExtraction ──────────────────────────────────────────────────────

/**
 * Rejects an OCR extraction.
 *
 * Marks the extraction as 'rejected' — no patient record is created.
 * Reason is optional but recommended for audit trail clarity.
 */
export async function rejectOcrExtraction(
  extractionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate
  await assertNotReadOnly()

  // 2. Get actor
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 3. Load extraction — verify it exists, belongs to tenant, and is rejectable
  const supabase = await createClient()
  const { data: extraction, error: loadError } = await supabase
    .from('ocr_extractions')
    .select('id, status, deleted_at, clinic_id')
    .eq('id', extractionId)
    .eq('clinic_id', actor.tenant_id) // explicit tenant scope guard
    .single()

  if (loadError || !extraction) {
    return { success: false, error: 'Extração não encontrada' }
  }

  if (extraction.deleted_at !== null) {
    return { success: false, error: 'Extração foi excluída' }
  }
  if (extraction.status === 'committed') {
    return { success: false, error: 'Extração já confirmada não pode ser rejeitada' }
  }
  if (extraction.status === 'rejected') {
    return { success: false, error: 'Extração já foi rejeitada anteriormente' }
  }

  // 4. Mark as rejected
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('ocr_extractions')
    .update({
      status: 'rejected',
      reviewed_by: actor.id,
      reviewed_at: now,
    })
    .eq('id', extractionId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 5. Audit log — IDs only (T-10-21)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'ocr.rejected',
    details: {
      extractionId,
      reason: reason ?? null,
    },
  })

  return { success: true }
}
