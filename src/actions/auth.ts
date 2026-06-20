'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  signupSchema,
  loginSchema,
  resetPasswordSchema,
} from '@/lib/validators/auth'
import { redirect } from 'next/navigation'

// ─── signUpClinic ────────────────────────────────────────────────────────────
// Creates Supabase Auth user + public.clinics row + public.users row atomically.
// On partial failure, performs compensating rollback (T-01-01).
// D-03: email_confirm:true skips confirmation email — redirect straight to /clinica.
export async function signUpClinic(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.format() }
  }

  const { email, password, clinicName, document, phone } = parsed.data
  const admin = createAdminClient()

  // Step 1: Create Supabase Auth user (service role, email_confirm:true avoids email gate)
  const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // D-03: no email confirmation gate
  })
  if (signUpError ?? !authUser.user) {
    return { error: signUpError?.message ?? 'Falha ao criar usuário' }
  }

  // Step 2: Create clinic row (bypass RLS — user has no tenant_id yet)
  const slug = clinicName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .insert({ name: clinicName, slug, cnpj: document, phone })
    .select('id')
    .single()

  if (clinicError ?? !clinic) {
    // Compensating rollback: delete auth user (T-01-01)
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { error: clinicError?.message ?? 'Falha ao criar clínica' }
  }

  // Step 3: Create public.users row linking auth.users → clinic
  const { error: userError } = await admin.from('users').insert({
    id: authUser.user.id,
    tenant_id: clinic.id,
    email,
    full_name: '', // filled in settings
    role: 'admin',
  })

  if (userError) {
    // Compensating rollback: delete auth user + clinic row (T-01-01)
    await admin.auth.admin.deleteUser(authUser.user.id)
    await admin.from('clinics').delete().eq('id', clinic.id)
    return { error: userError.message }
  }

  // Step 4: Sign in the newly created user (establishes session cookies)
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    // WR-01: surface sign-in failure so the user is not silently redirected without a session
    return { error: 'Conta criada, mas não foi possível autenticar automaticamente. Faça login.' }
  }

  redirect('/clinica')
}

// ─── signIn ─────────────────────────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.format() }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  redirect('/clinica')
}

// ─── signOut ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── sendPasswordReset ───────────────────────────────────────────────────────
// IN-03: Phase 1 deliberately uses Supabase's built-in recovery email here.
// The branded `src/emails/PasswordResetEmail.tsx` template is intentionally NOT
// wired yet — migrating to Resend (via admin `generateLink` + `resend.emails.send`)
// is deferred to a later phase. See that file's header for the reactivation path.
export async function sendPasswordReset(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/confirm?type=recovery&redirect_to=/reset-password`,
  })
  if (error) {
    return { error: error.message }
  }
  return { success: true }
}

// ─── updatePassword ──────────────────────────────────────────────────────────
export async function updatePassword(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.format() }
  }

  const { password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: error.message }
  }

  redirect('/clinica')
}
