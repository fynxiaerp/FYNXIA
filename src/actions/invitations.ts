'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { logBusinessEvent } from '@/lib/audit'
import {
  createInviteSchema,
  type CreateInviteInput,
} from '@/lib/validators/invitation'
import { InviteEmail } from '@/emails/InviteEmail'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// ─── createInvitation ────────────────────────────────────────────────────────
// Creates a staff/patient invitation via email (mode='email') or directly
// creates the user with a temporary password (mode='direct').
// Only admins and superadmins may call this action (RLS: invitations_admin_write).
export async function createInvitation(
  input: CreateInviteInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = createInviteSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const { email, role, mode, tempPassword } = parsed.data

  // Get current authenticated user + their tenant from public.users
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError ?? !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, full_name, email, role')
    .eq('id', user.id)
    .single()

  if (actorError ?? !actor) {
    return { success: false, error: 'Usuário não encontrado' }
  }

  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    return {
      success: false,
      error: 'Apenas administradores podem convidar membros',
    }
  }

  const tenantId = actor.tenant_id
  const admin = createAdminClient()

  // Fetch the clinic name for the email
  const { data: clinic } = await admin
    .from('clinics')
    .select('name')
    .eq('id', tenantId)
    .single()

  const clinicName = clinic?.name ?? 'FYNXIA'

  // ── Mode: email invite ────────────────────────────────────────────────────
  if (mode === 'email') {
    // Re-invite: revoke any existing pending invite for this tenant+email (D-05)
    await admin
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .eq('status', 'pending')

    // Insert new pending invitation row (DB default: expires_at = now()+24h)
    const { data: invitation, error: insertError } = await admin
      .from('invitations')
      .insert({
        tenant_id: tenantId,
        invited_by: actor.id,
        email,
        role,
        status: 'pending',
      })
      .select('token')
      .single()

    if (insertError ?? !invitation) {
      return {
        success: false,
        error: insertError?.message ?? 'Falha ao criar convite',
      }
    }

    const inviteUrl = `${SITE_URL}/invite/${invitation.token}`

    // Send FYNXIA-branded email via Resend (no Supabase native email — D-16)
    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Convite para ${clinicName} — FYNXIA`,
      react: InviteEmail({
        inviterName: actor.full_name || actor.email,
        clinicName,
        inviteUrl,
        role,
        expiresInHours: 24,
      }),
    })

    if (emailError) {
      // Roll back the invitation row if email send fails
      await admin
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('token', invitation.token)
      const detail = (emailError as { message?: string }).message ?? JSON.stringify(emailError)
      return { success: false, error: `Resend: ${detail}` }
    }

    // SEC-02: audit log
    await logBusinessEvent({
      tenantId,
      actorId: actor.id,
      action: 'INVITE_SENT',
      details: { email, role, invitedBy: actor.email, mode: 'email' },
    })

    return { success: true }
  }

  // ── Mode: direct creation ─────────────────────────────────────────────────
  if (mode === 'direct') {
    // Validate tempPassword (should be caught by schema refine, but double-check)
    if (!tempPassword || tempPassword.length < 8) {
      return {
        success: false,
        error: 'Senha temporária obrigatória (mín. 8) para criação direta',
      }
    }

    // Create Supabase Auth user — email_confirm:true, no email sent
    const { data: authUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })

    if (createUserError ?? !authUser.user) {
      return {
        success: false,
        error: createUserError?.message ?? 'Falha ao criar usuário',
      }
    }

    // Insert public.users row
    const { error: userRowError } = await admin.from('users').insert({
      id: authUser.user.id,
      tenant_id: tenantId,
      email,
      full_name: '',
      role,
    })

    if (userRowError) {
      // Compensating rollback
      await admin.auth.admin.deleteUser(authUser.user.id)
      return { success: false, error: userRowError.message }
    }

    // Insert invitations row as accepted (for audit trail consistency)
    await admin.from('invitations').insert({
      tenant_id: tenantId,
      invited_by: actor.id,
      email,
      role,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })

    // SEC-02: audit log
    await logBusinessEvent({
      tenantId,
      actorId: actor.id,
      action: 'USER_CREATED_DIRECT',
      details: { email, role, createdBy: actor.email, mode: 'direct' },
    })

    return { success: true }
  }

  return { success: false, error: 'Modo inválido' }
}

// ─── acceptInvitation ────────────────────────────────────────────────────────
// Public Server Action: redeems an invite token, creates the auth user + public.users row,
// marks the invitation as accepted, and signs the new user in.
// T-01-16: verifies status='pending' AND expires_at >= now() (single-use, non-expired).
// T-01-17: role taken from the DB invitation row, never from client input.
export async function acceptInvitation(
  token: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !password || password.length < 8) {
    return {
      success: false,
      error: 'Token e senha (mín. 8 caracteres) são obrigatórios',
    }
  }

  const admin = createAdminClient()

  // Atomic conditional update: claim the invitation in a single query to prevent
  // race conditions (CR-01). If two concurrent requests both pass the status check
  // before either writes, only the first UPDATE returning a row proceeds.
  const { data: invitation, error: claimError } = await admin
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .select('id, tenant_id, email, role')
    .single()

  if (claimError ?? !invitation) {
    // Token not found, already consumed, revoked, or expired
    return { success: false, error: 'Convite inválido ou expirado' }
  }

  // Create Supabase Auth user — email_confirm:true, no email sent
  const { data: authUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
    })

  if (createUserError ?? !authUser.user) {
    return {
      success: false,
      error: createUserError?.message ?? 'Falha ao criar usuário',
    }
  }

  // Insert public.users row — role from the invitation row (T-01-17, never client input)
  const { error: userRowError } = await admin.from('users').insert({
    id: authUser.user.id,
    tenant_id: invitation.tenant_id,
    email: invitation.email,
    full_name: '',
    role: invitation.role,
  })

  if (userRowError) {
    // Compensating rollback
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: userRowError.message }
  }

  // SEC-02: audit log
  await logBusinessEvent({
    tenantId: invitation.tenant_id,
    actorId: authUser.user.id,
    action: 'INVITE_ACCEPTED',
    details: {
      email: invitation.email,
      role: invitation.role,
      invitationId: invitation.id,
    },
  })

  // Sign in the new user to establish a session
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password,
  })
  if (signInError) {
    // WR-02: invitation is already consumed; surface the error so the user can log in manually
    return { success: false, error: 'Conta criada. Acesse a página de login para entrar.' }
  }

  // Redirect to role-appropriate home
  const home = invitation.role === 'patient' ? '/paciente' : '/clinica'
  redirect(home)
}

// ─── revokeInvitation ────────────────────────────────────────────────────────
// Revokes a pending invitation by ID (admin only; RLS enforces write access).
export async function revokeInvitation(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // Verify authenticated user is admin/superadmin
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError ?? !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, email, role')
    .eq('id', user.id)
    .single()

  if (actorError ?? !actor) {
    return { success: false, error: 'Usuário não encontrado' }
  }

  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    return {
      success: false,
      error: 'Apenas administradores podem revogar convites',
    }
  }

  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('tenant_id', actor.tenant_id) // Tenant scope guard
    .eq('status', 'pending')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // SEC-02: audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'INVITE_REVOKED',
    details: { invitationId: id, revokedBy: actor.email },
  })

  return { success: true }
}
