/**
 * GET /api/patients/[id]/prontuario.pdf
 *
 * Generates and streams a PDF prontuário for the patient.
 *
 * SECURITY (T-2-11): createClient() uses RLS — if patient.tenant_id does not
 * match get_my_tenant_id(), the query returns empty and we return 404.
 * NEVER uses service role for this endpoint.
 *
 * PITFALL 2: Decrypt guard — health fields decrypted with guard (value ? decrypt(value) : '')
 * PITFALL 6: Font.register in ProntuarioPDF with Roboto (Latin Extended) for ã/ç/ê/õ
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md)
export const runtime = 'nodejs'

// M-3: explicit timeout for large prontuário generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { listMedicalRecords } from '@/actions/medical-records'
import { ProntuarioPDF } from '@/components/pdf/ProntuarioPDF'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response('Não autenticado', { status: 401 })
    }

    // Get actor for tenant isolation check and clinic name
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    // Fetch patient — RLS restricts to actor's tenant automatically (T-2-11)
    // If patient belongs to another tenant, RLS returns null → 404
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, full_name, cpf, date_of_birth, phone, email, medical_history, allergies, medications, tenant_id, is_anonymized')
      .eq('id', id)
      .single()

    if (patientError || !patient) {
      // T-2-11: do not distinguish "not found" from "wrong tenant" — both return 404
      return new Response('Paciente não encontrado', { status: 404 })
    }

    // Fetch clinic name for PDF header
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', actor.tenant_id)
      .single()

    const clinicName = clinic?.name ?? 'Clínica'

    // Decrypt health fields with guard — Pitfall 2: decrypt only when value is present
    const decryptedPatient = {
      full_name: patient.full_name,
      cpf: patient.cpf,
      date_of_birth: patient.date_of_birth,
      phone: patient.phone,
      email: patient.email,
      // Decrypt server-side only — never passed to client components (T-2-08)
      medical_history: patient.medical_history ? decrypt(patient.medical_history) : '',
      allergies: patient.allergies ? decrypt(patient.allergies) : '',
      medications: patient.medications ? decrypt(patient.medications) : '',
    }

    // Fetch medical records (all dentists, chronological)
    const recordsResult = await listMedicalRecords(id)
    const records = recordsResult.success ? (recordsResult.records ?? []) : []

    // Generate PDF buffer — ProntuarioPDF has Font.register for Latin Extended (Pitfall 6)
    // Cast required: createElement returns FunctionComponentElement but renderToBuffer
    // expects ReactElement<DocumentProps> — ProntuarioPDF wraps <Document> so this is safe.
    const pdfElement = createElement(ProntuarioPDF, {
      patient: decryptedPatient,
      records,
      clinicName,
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)

    // Convert Node.js Buffer to Uint8Array for Response BodyInit compatibility
    const uint8Array = new Uint8Array(buffer)

    const safeFileName = `prontuario-${id}.pdf`

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        // No-cache: PDF contains PHI — must not be cached by CDN or browser
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[prontuario.pdf] PDF generation error:', error)
    // UI-SPEC: "Erro ao gerar PDF" — generic message (never expose internal error details)
    return new Response(
      JSON.stringify({ error: 'Não foi possível gerar o prontuário. Tente novamente em alguns instantes.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
