// Public POST endpoint for patient self-registration from /agendar (D-10)
// No authentication required — resolves clinic by slug, creates pending invitation.
// T-01-18: rate-limiting deferred to Phase 3; low risk (no auth account created here).
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { patientSelfRegisterSchema } from '@/lib/validators/invitation'
import { logBusinessEvent } from '@/lib/audit'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'JSON inválido no corpo da requisição' },
      { status: 400 }
    )
  }

  const parsed = patientSelfRegisterSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return NextResponse.json(
      { error: firstError?.message ?? 'Dados inválidos' },
      { status: 400 }
    )
  }

  const { clinicSlug, email, fullName } = parsed.data
  const admin = createAdminClient()

  // Resolve clinic by slug
  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, name')
    .eq('slug', clinicSlug)
    .is('deleted_at', null)
    .single()

  if (clinicError ?? !clinic) {
    return NextResponse.json(
      { error: 'Clínica não encontrada' },
      { status: 404 }
    )
  }

  // Revoke any existing pending invite for the same clinic+email
  await admin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('tenant_id', clinic.id)
    .eq('email', email)
    .eq('status', 'pending')

  // Create pending invitation (role=patient, invited_by = system actor via clinic owner)
  // We use the clinic id as a stand-in for invited_by; in Phase 2 this will be linked to
  // the recepcionista who confirms the request.
  // For now, we need a valid user id. Find the clinic admin.
  const { data: clinicAdmin } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', clinic.id)
    .eq('role', 'admin')
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (!clinicAdmin) {
    return NextResponse.json(
      { error: 'Clínica sem administrador — não é possível processar o pedido' },
      { status: 422 }
    )
  }

  const { data: invitation, error: insertError } = await admin
    .from('invitations')
    .insert({
      tenant_id: clinic.id,
      invited_by: clinicAdmin.id,
      email,
      role: 'patient',
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError ?? !invitation) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Falha ao registrar pedido' },
      { status: 500 }
    )
  }

  // SEC-02: audit log for self-register request
  await logBusinessEvent({
    tenantId: clinic.id,
    actorId: clinicAdmin.id,
    action: 'PATIENT_SELF_REGISTER_REQUEST',
    details: {
      email,
      fullName,
      clinicSlug,
      clinicName: clinic.name,
      source: 'public_api',
    },
  })

  return NextResponse.json(
    { requestId: invitation.id, message: 'Pedido de cadastro recebido com sucesso' },
    { status: 201 }
  )
}
