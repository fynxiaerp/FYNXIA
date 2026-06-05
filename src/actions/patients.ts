'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { encrypt, decrypt } from '@/lib/crypto'
import { patientSchema, type PatientInput } from '@/lib/validators/patient'
import { buildAnonymizedPatch } from '@/lib/patient-anonymize'

// buildAnonymizedPatch (D-08 LGPD anonymization) lives in '@/lib/patient-anonymize'
// because a 'use server' module may only export async functions.

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

// ─── createPatient ────────────────────────────────────────────────────────────
// CLINIC-03: cadastro completo de paciente.
// D-07: criptografa medical_history/allergies/medications com AES-256-GCM ANTES do INSERT.
// T-2-02: tenant_id derivado do actor autenticado — NUNCA do input do cliente.
// T-2-08: logBusinessEvent recebe apenas patient_id — NUNCA CPF ou dados de saúde.
export async function createPatient(
  input: PatientInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validate input with Zod v3 schema
  const parsed = patientSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  // Role gate: only staff can register patients
  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para cadastrar paciente' }
  }

  const {
    full_name,
    cpf,
    date_of_birth,
    phone,
    email,
    address,
    medical_history,
    allergies,
    medications,
  } = parsed.data

  const supabase = await createClient()

  const { data: patient, error: insertError } = await supabase
    .from('patients')
    .insert({
      tenant_id: actor.tenant_id,
      registered_by: actor.id,
      full_name,
      cpf,
      date_of_birth: date_of_birth ?? null,
      phone: phone ?? null,
      email: email ?? null,
      address: address ?? null,
      // D-07: encrypt ONLY when field has a non-empty value (Pitfall 2 — never encrypt null/empty)
      medical_history: medical_history ? encrypt(medical_history) : null,
      allergies: allergies ? encrypt(allergies) : null,
      medications: medications ? encrypt(medications) : null,
    })
    .select('id')
    .single()

  if (insertError) {
    // 23505 = unique_violation (CPF já cadastrado no tenant — idx_patients_cpf_tenant)
    if (insertError.code === '23505') {
      return {
        success: false,
        error: 'CPF já cadastrado nesta clínica',
      }
    }
    return { success: false, error: insertError.message }
  }

  // T-2-08: audit log receives ONLY patient_id — never CPF or health data
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'patient.created',
    details: { patient_id: patient!.id },
  })

  return { success: true, id: patient!.id }
}

// ─── updatePatient ────────────────────────────────────────────────────────────
// CLINIC-04: edição de ficha de paciente existente.
// Re-criptografa campos de saúde alterados.
// Tenant scoped — RLS + explicit tenant_id filter.
export async function updatePatient(
  id: string,
  input: PatientInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = patientSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para editar paciente' }
  }

  const {
    full_name,
    cpf,
    date_of_birth,
    phone,
    email,
    address,
    medical_history,
    allergies,
    medications,
  } = parsed.data

  const supabase = await createClient()

  // WR-06: build the update payload so omitted/empty health fields are treated
  // as "no change" rather than silently nulling existing encrypted clinical
  // data. Only re-encrypt and overwrite a health field when a non-empty value
  // is provided (D-07 + Pitfall 2 still apply — never encrypt null/empty).
  const updatePayload: Record<string, unknown> = {
    full_name,
    cpf,
    date_of_birth: date_of_birth ?? null,
    phone: phone ?? null,
    email: email ?? null,
    address: address ?? null,
    updated_at: new Date().toISOString(),
  }
  if (medical_history) updatePayload.medical_history = encrypt(medical_history)
  if (allergies) updatePayload.allergies = encrypt(allergies)
  if (medications) updatePayload.medications = encrypt(medications)

  const { error: updateError } = await supabase
    .from('patients')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard (T-2-02)

  if (updateError) {
    if (updateError.code === '23505') {
      return { success: false, error: 'CPF já cadastrado nesta clínica' }
    }
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'patient.updated',
    details: { patient_id: id },
  })

  return { success: true }
}

// ─── anonymizePatient ─────────────────────────────────────────────────────────
// SEC-04 + D-08: LGPD-compliant patient deletion.
// ONLY admin/superadmin may execute. Applies buildAnonymizedPatch().
// Does NOT delete medical_records, dental_records, or anamneses (Lei 13.787/2018).
export async function anonymizePatient(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  // Role gate: only admin/superadmin can anonymize
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    return {
      success: false,
      error: 'Apenas administradores podem excluir pacientes',
    }
  }

  const patch = buildAnonymizedPatch()
  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard (T-2-02)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Audit with only patient_id — never PII (T-2-08)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'patient.anonymized',
    details: { patient_id: id },
  })

  return { success: true }
}

// ─── getPatientDecrypted ──────────────────────────────────────────────────────
// Reads patient scoped by tenant (RLS applies via createClient).
// Decrypts health fields with guard: decrypt ONLY when value is present (Pitfall 2).
export async function getPatientDecrypted(id: string): Promise<{
  success: boolean
  patient?: {
    id: string
    tenant_id: string
    full_name: string
    cpf: string
    date_of_birth: string | null
    phone: string | null
    email: string | null
    address: string | null
    medical_history: string
    allergies: string
    medications: string
    is_anonymized: boolean
    deleted_at: string | null
    created_at: string
    updated_at: string
    registered_by: string | null
  }
  error?: string
}> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const supabase = await createClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard (T-2-02)
    .single()

  if (error || !patient) {
    return { success: false, error: error?.message ?? 'Paciente não encontrado' }
  }

  // Pitfall 2 guard: decrypt ONLY if value is present (non-null, non-empty string)
  return {
    success: true,
    patient: {
      ...patient,
      medical_history: patient.medical_history ? decrypt(patient.medical_history) : '',
      allergies: patient.allergies ? decrypt(patient.allergies) : '',
      medications: patient.medications ? decrypt(patient.medications) : '',
    },
  }
}
