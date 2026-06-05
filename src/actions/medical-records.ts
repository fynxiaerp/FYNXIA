'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import {
  medicalRecordSchema,
  type MedicalRecordInput,
} from '@/lib/validators/medical-record'

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

// ─── createMedicalRecord ──────────────────────────────────────────────────────
// CLINIC-05 + D-09: dentista registra prontuário com campos estruturados.
// T-2-12: dentist_id derivado do actor autenticado — NUNCA do input do cliente.
// RLS: medical_records_clinical_write WITH CHECK get_my_role() IN ('admin','dentist','superadmin')
export async function createMedicalRecord(
  input: MedicalRecordInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validate input with Zod v3
  const parsed = medicalRecordSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // Role gate: only clinical staff can create prontuário entries
  const allowedRoles = ['admin', 'dentist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return {
      success: false,
      error: 'Permissão insuficiente para registrar prontuário',
    }
  }

  const { patient_id, appointment_id, diagnosis, treatment_plan, prescription } =
    parsed.data

  const supabase = await createClient()

  const { data: record, error: insertError } = await supabase
    .from('medical_records')
    .insert({
      tenant_id: actor.tenant_id,
      patient_id,
      appointment_id: appointment_id ?? null,
      // T-2-12: dentist_id ALWAYS from actor.id — never from client input
      dentist_id: actor.id,
      diagnosis: diagnosis ?? null,
      treatment_plan: treatment_plan ?? null,
      prescription: prescription ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  // T-2-08: audit log receives only IDs — never clinical data
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'medical_record.created',
    details: { medical_record_id: record!.id, patient_id },
  })

  return { success: true, id: record!.id }
}

// ─── listMedicalRecords ───────────────────────────────────────────────────────
// CLINIC-07 + D-10: histórico de todos os dentistas da clínica em ordem cronológica.
// CRITICAL: does NOT filter by dentist_id — multi-dentist history required.
// RLS already isolates by tenant_id via get_my_tenant_id().
export async function listMedicalRecords(patientId: string): Promise<{
  success: boolean
  records?: Array<{
    id: string
    created_at: string
    diagnosis: string | null
    treatment_plan: string | null
    prescription: string | null
    dentist_id: string
    dentist: { full_name: string } | null
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data: records, error } = await supabase
    .from('medical_records')
    .select(
      '*, dentist:users!dentist_id(full_name)'
    )
    .eq('patient_id', patientId)
    // D-10: ORDER BY created_at DESC — all dentists, chronological
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    records: (records ?? []) as Array<{
      id: string
      created_at: string
      diagnosis: string | null
      treatment_plan: string | null
      prescription: string | null
      dentist_id: string
      dentist: { full_name: string } | null
    }>,
  }
}
