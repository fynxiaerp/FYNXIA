---
phase: 01-auth-tenant-onboarding
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/__tests__/auth/auth.test.ts
  - src/__tests__/auth/invitations.test.ts
  - src/__tests__/migrations/schema.test.ts
  - src/__tests__/proxy/rbac.test.ts
  - src/actions/auth.ts
  - src/actions/invitations.ts
  - src/app/(auth)/forgot-password/page.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/reset-password/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/(dashboard)/clinica/equipe/page.tsx
  - src/app/(dashboard)/clinica/page.tsx
  - src/app/api/invitations/route.ts
  - src/app/auth/confirm/route.ts
  - src/app/invite/[token]/InviteAcceptForm.tsx
  - src/app/invite/[token]/page.tsx
  - src/components/auth/ForgotPasswordForm.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/SignupForm.tsx
  - src/components/invitations/InviteForm.tsx
  - src/emails/InviteEmail.tsx
  - src/emails/PasswordResetEmail.tsx
  - src/lib/audit.ts
  - src/lib/resend.ts
  - src/lib/validators/auth.ts
  - src/lib/validators/clinic.ts
  - src/lib/validators/invitation.ts
  - supabase/migrations/20260604000200_rename_tenants_to_clinics.sql
  - supabase/migrations/20260604000300_clinics_users_phase1.sql
  - supabase/migrations/20260604000400_rls_phase1.sql
  - vitest.config.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the full Phase 1 auth and tenant onboarding implementation: server actions, invitation flow, RLS migrations, validators, forms, and tests. The overall architecture is solid — correct use of `@supabase/ssr`, admin client isolated to server-only paths, RLS enforced at the DB layer with `SECURITY DEFINER` helpers, and role sourced from the DB row rather than client input.

Three critical issues were found: a race condition in the invitation acceptance flow that can allow token replay under concurrent requests, an open redirect vulnerability in the auth confirm route, and a missing audit log trigger on the `invitations` table (all mutation actions go through the application layer only — a DB-level trigger is absent, leaving a gap in the audit trail). Five warnings address logic bugs and missing error handling. Four info items note dead code and minor quality issues.

---

## Critical Issues

### CR-01: Race condition in `acceptInvitation` — concurrent requests can redeem the same token twice

**File:** `src/actions/invitations.ts:232-278`

**Issue:** The check `invitation.status !== 'pending'` (line 232) and the `update({ status: 'accepted' })` (line 277) are two separate queries with no atomic guard. Under concurrent requests — two browser tabs submitting the form simultaneously, or a network retry — both can read `status='pending'` before either writes `status='accepted'`, resulting in duplicate `auth.users` rows and duplicate `public.users` rows for the same email. The `idx_invitations_one_pending` unique index only constrains *pending* rows; it does not prevent two concurrent acceptances.

**Fix:** Replace the separate read-then-update with a single `UPDATE ... WHERE status='pending' AND expires_at >= now() RETURNING *` (atomic conditional update). Only proceed if the update returns a row.

```sql
-- In acceptInvitation, replace the lookup + separate update with:
UPDATE public.invitations
SET status = 'accepted', accepted_at = now()
WHERE token = $1
  AND status = 'pending'
  AND expires_at >= now()
RETURNING id, tenant_id, email, role;
```

In the Server Action, execute this as a single admin client call using `.update(...).eq('token', token).eq('status', 'pending').gte('expires_at', new Date().toISOString()).select(...).single()`. If `data` is null, the token was already consumed.

---

### CR-02: Open redirect in `/auth/confirm` route — `redirect_to` parameter not validated

**File:** `src/app/auth/confirm/route.ts:8`

**Issue:** The `next` variable is set directly from `searchParams.get('redirect_to')` with no validation:

```ts
const next = searchParams.get('redirect_to') ?? '/clinica'
```

On line 14, this value is concatenated into `${origin}${next}` and used as the redirect destination. An attacker can craft a password-reset URL with `redirect_to=//evil.com/phish` or `redirect_to=/login?next=//evil.com` and redirect the user off-site after a successful OTP verification.

**Fix:** Validate that `next` starts with `/` and does not contain `//` (protocol-relative URL):

```ts
const rawNext = searchParams.get('redirect_to') ?? '/clinica'
// Allow only relative paths (must start with / and not be protocol-relative)
const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/clinica'
```

---

### CR-03: `invitations` table has no DB-level audit trigger — only application-layer logging

**File:** `supabase/migrations/20260604000300_clinics_users_phase1.sql:85-90`

**Issue:** The migration attaches `audit_clinics` and `audit_users` triggers but not a trigger on `public.invitations`. Invitation mutations that bypass the application layer (Supabase dashboard edits, direct SQL, future migrations) are not recorded in `audit_logs`. For an LGPD-regulated system where invitations grant access to clinic data, this is a gap in the mandatory audit trail (SEC-02).

**Fix:** Add a trigger on the `invitations` table at the end of migration `20260604000300`:

```sql
CREATE TRIGGER audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
```

---

## Warnings

### WR-01: `signUpClinic` — error from `signInWithPassword` after signup is silently ignored

**File:** `src/actions/auth.ts:70-72`

**Issue:** After successfully creating the auth user and clinic rows, the action calls `supabase.auth.signInWithPassword` and discards the result before calling `redirect('/clinica')`. If the sign-in fails (e.g., rate limit, transient error), the user is redirected to `/clinica` without a session, where the proxy will redirect them back to `/login`, creating a confusing loop. The created account is left in a valid state but the user cannot understand why they are stuck on the login page.

**Fix:**

```ts
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) {
  return { error: 'Conta criada, mas não foi possível autenticar automaticamente. Faça login.' }
}
redirect('/clinica')
```

---

### WR-02: `acceptInvitation` — `signInWithPassword` error silently ignored after user creation

**File:** `src/actions/invitations.ts:294-302`

**Issue:** Same pattern as WR-01. After creating the user and marking the invitation accepted, `signInWithPassword` is called without checking its error. The redirect to `home` then occurs unconditionally. If sign-in fails, the user ends up on `/clinica` or `/paciente` with no session, the proxy redirects to `/login`, and the newly created account appears unusable — yet the invitation is already consumed (status='accepted'), so they cannot re-use the invite link.

**Fix:**

```ts
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: invitation.email,
  password,
})
if (signInError) {
  return { success: false, error: 'Conta criada. Acesse a página de login para entrar.' }
}
redirect(home)
```

---

### WR-03: `revokeInvitation` uses anon client for the `UPDATE` but admin client should enforce the tenant guard

**File:** `src/actions/invitations.ts:334-341`

**Issue:** The `.update({ status: 'revoked' })` call is made via `admin` (service role, bypasses RLS) with a manual `.eq('tenant_id', actor.tenant_id)` guard. The guard depends on `actor.tenant_id` fetched via the **anon** supabase client (line 321-325), which is protected by RLS. However, if `actor` is fetched successfully but the `tenant_id` in the row has been modified in a logic error scenario, the admin client would update an invitation in the wrong tenant. More critically: the fetch of `actor` on line 321 uses the anon client without error-checking the query result (only `!actor` is checked, not `actorError`):

```ts
const { data: actor } = await supabase  // actorError discarded
  .from('users')
  ...
```

**Fix:** Destructure and check `actorError`:

```ts
const { data: actor, error: actorError } = await supabase
  .from('users')
  .select('id, tenant_id, email, role')
  .eq('id', user.id)
  .single()

if (actorError ?? !actor) {
  return { success: false, error: 'Usuário não encontrado' }
}
```

---

### WR-04: `patient_consents` RLS policy missing `WITH CHECK` — inserts not restricted

**File:** `supabase/migrations/20260604000400_rls_phase1.sql:13-16`

**Issue:** The `patient_consents` policy only defines `FOR SELECT`. There is no `INSERT` or `ALL` policy with a `WITH CHECK` clause. Per the project's own CLAUDE.md guidelines: "Always pair `USING` with `WITH CHECK`". As written, if an authenticated user (any role) attempts an INSERT on `patient_consents` directly, RLS will block it only if there's no permissive INSERT policy — which is correct *by default* (deny all when no policy matches). However, this is an implicit deny with no explicit write policy. Any future migration or dashboard change that enables row-level writes may inadvertently grant access. For LGPD consent records this needs an explicit `WITH CHECK` policy.

**Fix:** Add an explicit write policy:

```sql
CREATE POLICY "patient_consents_patient_write" ON public.patient_consents
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
```

---

### WR-05: `logBusinessEvent` errors are silently discarded — audit failure is invisible

**File:** `src/lib/audit.ts:11-16`

**Issue:** `admin.from('audit_logs').insert(...)` is awaited but its return value is not checked. If the audit log insert fails (e.g., partition does not exist for the current month, schema mismatch), the calling action continues and returns `{ success: true }` with no indication that LGPD-required logging failed. This is a compliance risk.

**Fix:**

```ts
export async function logBusinessEvent(params: { ... }): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_logs').insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action: params.action,
    new_values: params.details,
  })
  if (error) {
    // In production, pipe to a monitoring service (Sentry, Datadog, etc.)
    console.error('[audit] logBusinessEvent failed:', error.message, params)
    // Do NOT throw — callers should not fail because of audit errors,
    // but the error must be surfaced to the operator.
  }
}
```

---

## Info

### IN-01: `InviteAcceptForm` — `clinicName` and `role` props declared but never used

**File:** `src/app/invite/[token]/InviteAcceptForm.tsx:9-18`

**Issue:** The `InviteAcceptFormProps` interface declares `clinicName: string` and `role: string`, and the parent page passes both. The component destructures only `token` and `email`. The props are dead code in this component.

**Fix:** Either consume the props in the UI (e.g., show clinic name and role in the form header for confirmation), or remove them from the interface and the parent's JSX.

---

### IN-02: `inviteSchema` in `auth.ts` is unused — superseded by `createInviteSchema` in `invitation.ts`

**File:** `src/lib/validators/auth.ts:26-29`

**Issue:** `inviteSchema` and `InviteInput` are exported but never imported anywhere in the reviewed codebase. The invitation flow uses `createInviteSchema` from `invitation.ts` exclusively.

**Fix:** Remove `inviteSchema` and `InviteInput` from `src/lib/validators/auth.ts` to avoid confusion about which schema to use for invitations.

---

### IN-03: `PasswordResetEmail` component is defined but never referenced in any server action

**File:** `src/emails/PasswordResetEmail.tsx`

**Issue:** The `sendPasswordReset` action in `src/actions/auth.ts` uses Supabase's built-in `resetPasswordForEmail` which sends Supabase's own email template. The custom `PasswordResetEmail` React Email component is never imported or used. This means the branded email template is dead code — users receive the default Supabase email rather than the FYNXIA-branded one.

This is likely intentional for Phase 1 (Supabase handles the reset link), but if the intent was to use Resend for password reset emails (consistent with the invite flow), the wiring is missing.

**Fix:** Either wire `PasswordResetEmail` through Resend (using `generateLink` from the admin client to get the reset URL, then calling `resend.emails.send`), or add a comment explicitly noting this is deferred to a future phase to avoid confusion.

---

### IN-04: `audit_logs` partitions only cover through August 2026 — gap coverage for new months

**File:** `supabase/migrations/20260604000300_clinics_users_phase1.sql:93-97`

**Issue:** Manual partitions `audit_logs_2026_07` and `audit_logs_2026_08` are created. Starting September 2026, inserts to `audit_logs` will fail if no matching partition exists (PostgreSQL declarative partitioning with no default partition raises an error). The comment "Pitfall 7" acknowledges this but the migration does not create a `DEFAULT` partition as a safety net, nor does it include a `pg_cron` job or a future migration for September.

**Fix:** Add a `DEFAULT` partition to catch any rows that fall outside the defined ranges:

```sql
CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;
```

Then create new month partitions via a recurring migration or `pg_cron` job before each month boundary. The `DEFAULT` partition acts as a safety net to prevent data loss if a partition is missed.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
