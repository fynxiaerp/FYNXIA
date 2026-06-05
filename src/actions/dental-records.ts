'use server'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import {
  dentalRecordSchema,
  type DentalRecordInput,
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

// ─── updateDentalRecord ───────────────────────────────────────────────────────
// CLINIC-06 + D-14: insere snapshot de status de dente em dental_records.
// D-15: apenas admin e dentista podem editar o odontograma.
// Pitfall 4: role gate BEFORE insert — defense in depth alongside RLS.
// T-2-12: dentist_id = actor.id — nunca do input do cliente.
// RLS: dental_records_clinical_write FOR INSERT WITH CHECK get_my_role() IN ('admin','dentist')
export async function updateDentalRecord(
  input: DentalRecordInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validate input with Zod v3
  const parsed = dentalRecordSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // D-15 + Pitfall 4: role gate — receptionist/patient blocked at application layer
  // (RLS dental_records_clinical_write enforces this at DB level too — defense in depth)
  if (actor.role !== 'admin' && actor.role !== 'dentist') {
    return {
      success: false,
      error:
        'Permissão insuficiente. Apenas administradores e dentistas podem editar o odontograma.',
    }
  }

  const { patient_id, appointment_id, tooth_number, status, notes } = parsed.data

  const supabase = await createClient()

  // WR-02: confirm the patient exists in the actor's tenant before insert.
  // The FK only checks existence (not tenant), so without this a mismatched or
  // non-existent patient_id would surface as a raw 23503 instead of a friendly
  // error, and could orphan a clinical record.
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patient_id)
    .eq('tenant_id', actor.tenant_id)
    .single()

  if (!patient) {
    return { success: false, error: 'Paciente não encontrado' }
  }

  // D-14: INSERT snapshot (dental_records policy is INSERT-only — no UPDATE/DELETE)
  const { data: record, error: insertError } = await supabase
    .from('dental_records')
    .insert({
      tenant_id: actor.tenant_id,
      patient_id,
      appointment_id: appointment_id ?? null,
      // T-2-12: dentist_id always from actor — never from client input
      dentist_id: actor.id,
      tooth_number,
      status,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  // T-2-08: audit log receives only IDs — never tooth data
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'dental_record.updated',
    details: { patient_id, tooth_number },
  })

  return { success: true, id: record!.id }
}
