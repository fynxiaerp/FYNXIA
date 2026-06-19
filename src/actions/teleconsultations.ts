'use server'
/**
 * Teleconsultations Server Actions — Phase 12 (TEL-01/TEL-02)
 *
 * createTeleconsultation: CFO consent + external video link + server-set consent_ip
 *                         and consent_given_at (never trusted from client — T-12-18).
 * startTeleconsultation:  set started_at + status='em_andamento'; requires consent_given.
 * endTeleconsultation:    set ended_at + status='concluida'.
 * createSoapRecord:       structured SOAP note linked to teleconsultation + appointment.
 * listTeleconsultations:  RLS-scoped read, ordered by created_at desc.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks read-only roles at action boundary
 *   2. Role gate — admin/superadmin/dentist for mutations
 *   3. consent_ip extracted from x-forwarded-for/x-real-ip headers server-side (T-12-18)
 *   4. consent_given_at set to server now() — client cannot forge the timestamp
 *   5. consent_ip is NOT logged (LGPD — IP is personal data; IDs only in audit)
 *   6. Tenant scope on every mutation via clinic_id = actor.tenant_id
 *
 * Phase: 12-receitu-rio-teleodontologia
 */

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { teleconsultationSchema, soapSchema } from '@/lib/validators/teleconsultation'
import type { TeleconsultationInput, SoapInput } from '@/lib/validators/teleconsultation'

// ─── getActor helper (mirrors src/actions/documents.ts exactly) ───────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
  full_name?: string | null
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
    .select('id, tenant_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── createTeleconsultation ───────────────────────────────────────────────────

/**
 * Creates a teleconsultation session with CFO consent and external video link.
 *
 * TEL-01: consent_ip and consent_given_at are set server-side from request headers.
 * T-12-18: client cannot supply or override consent_ip or consent_given_at.
 *
 * LGPD: consent_ip is NOT included in the logBusinessEvent details (IP = personal data).
 */
export async function createTeleconsultation(input: TeleconsultationInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para criar teleconsulta' }
  }

  const parseResult = teleconsultationSchema.safeParse(input)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return {
      success: false,
      error: firstError?.message ?? 'Dados inválidos para teleconsulta',
    }
  }
  const validated = parseResult.data

  // T-12-18: capture consent IP server-side from request headers — never from client
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  const consentIp = fwd
    ? (fwd.split(',')[0] ?? fwd).trim()
    : (h.get('x-real-ip') ?? null)

  const supabase = await createClient()

  const { data: session, error: insertError } = await supabase
    .from('teleconsultations')
    .insert({
      clinic_id: actor.tenant_id,
      patient_id: validated.patient_id,
      appointment_id: validated.appointment_id ?? null,
      professional_id: validated.professional_id ?? null,
      external_link: validated.external_link,
      consent_given: validated.consent_given,
      // Server-set: client cannot forge these (T-12-18)
      consent_given_at: validated.consent_given ? new Date().toISOString() : null,
      consent_ip: validated.consent_given ? consentIp : null,
      status: 'agendada',
      notes: validated.notes ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !session) {
    return { success: false, error: 'Erro ao criar teleconsulta' }
  }

  const sessionId = (session as { id: string }).id

  // LGPD: consent_ip omitted from audit log (IP = personal data — log IDs only)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'teleconsultation.created',
    details: {
      teleconsultation_id: sessionId,
      patient_id: validated.patient_id,
      consent_given: validated.consent_given,
    },
  })

  return { success: true, id: sessionId }
}

// ─── startTeleconsultation ────────────────────────────────────────────────────

/**
 * Marks a teleconsultation session as started.
 * Requires consent_given = true (CFO regulatory requirement — TEL-01).
 */
export async function startTeleconsultation(id: string): Promise<{
  success: boolean
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para iniciar teleconsulta' }
  }

  const supabase = await createClient()

  // Verify consent before starting (CFO regulatory requirement)
  const { data: existing } = await supabase
    .from('teleconsultations')
    .select('consent_given, clinic_id')
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)
    .single()

  const typedExisting = existing as { consent_given: boolean; clinic_id: string } | null

  if (!typedExisting) {
    return { success: false, error: 'Teleconsulta não encontrada' }
  }

  if (!typedExisting.consent_given) {
    return { success: false, error: 'Consentimento da sessão é obrigatório para iniciar' }
  }

  const { error: updateError } = await supabase
    .from('teleconsultations')
    .update({
      status: 'em_andamento',
      started_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: 'Erro ao iniciar teleconsulta' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'teleconsultation.started',
    details: { teleconsultation_id: id },
  })

  return { success: true }
}

// ─── endTeleconsultation ──────────────────────────────────────────────────────

/**
 * Marks a teleconsultation session as concluded and records ended_at.
 */
export async function endTeleconsultation(id: string): Promise<{
  success: boolean
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para encerrar teleconsulta' }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('teleconsultations')
    .update({
      status: 'concluida',
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: 'Erro ao encerrar teleconsulta' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'teleconsultation.ended',
    details: { teleconsultation_id: id },
  })

  return { success: true }
}

// ─── createSoapRecord ─────────────────────────────────────────────────────────

/**
 * Creates a structured SOAP clinical note.
 *
 * TEL-02: links to BOTH teleconsultation_id (session) and appointment_id (atendimento).
 * dentist_id is set server-side from the authenticated actor — not from client input.
 */
export async function createSoapRecord(input: SoapInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para registrar SOAP' }
  }

  const parseResult = soapSchema.safeParse(input)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return {
      success: false,
      error: firstError?.message ?? 'Dados inválidos para registro SOAP',
    }
  }
  const validated = parseResult.data

  const supabase = await createClient()

  const { data: soapRow, error: insertError } = await supabase
    .from('soap_records')
    .insert({
      clinic_id: actor.tenant_id,
      patient_id: validated.patient_id,
      appointment_id: validated.appointment_id ?? null,
      teleconsultation_id: validated.teleconsultation_id ?? null,
      dentist_id: actor.id,
      soap_subjective: validated.soap_subjective ?? null,
      soap_objective: validated.soap_objective ?? null,
      soap_assessment: validated.soap_assessment ?? null,
      soap_plan: validated.soap_plan ?? null,
    })
    .select('id')
    .single()

  if (insertError || !soapRow) {
    return { success: false, error: 'Erro ao registrar SOAP' }
  }

  const soapId = (soapRow as { id: string }).id

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'soap_record.created',
    details: {
      soap_record_id: soapId,
      patient_id: validated.patient_id,
      teleconsultation_id: validated.teleconsultation_id ?? null,
      appointment_id: validated.appointment_id ?? null,
    },
  })

  return { success: true, id: soapId }
}

// ─── listTeleconsultations ────────────────────────────────────────────────────

/**
 * Lists teleconsultation sessions for the actor's clinic.
 * RLS enforces tenant isolation; ordered by created_at desc.
 */
export async function listTeleconsultations(patientId?: string): Promise<{
  success: boolean
  data?: {
    id: string
    patient_id: string
    professional_id: string | null
    appointment_id: string | null
    external_link: string
    consent_given: boolean
    status: string
    started_at: string | null
    ended_at: string | null
    created_at: string
  }[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('teleconsultations')
    .select(
      'id, patient_id, professional_id, appointment_id, external_link, consent_given, status, started_at, ended_at, created_at'
    )
    .order('created_at', { ascending: false })

  if (patientId) {
    query = query.eq('patient_id', patientId) as typeof query
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: 'Erro ao listar teleconsultas' }
  }

  return { success: true, data: (data ?? []) as typeof data }
}
