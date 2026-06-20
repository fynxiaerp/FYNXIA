---
phase: 01-auth-tenant-onboarding
fixed_at: 2026-06-20T18:25:00Z
review_path: .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-20T18:25:00Z
**Source review:** .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (3 Critical + 5 Warning + 4 Info; fix_scope = "all")
- Fixed: 12
- Skipped: 0

> Consolidated report for all 12 findings. The 3 Critical and 5 Warning findings were
> resolved and committed in a prior fix run; this iteration re-verified each against the
> current committed source (Tier 1 re-read): every fix is present, carries its finding-ID
> comment marker, and surrounding code is intact. The 4 Info findings (IN-01 through IN-04)
> were applied and committed in this iteration. The commit hashes recorded for CR/WR fixes
> in the prior report could not be located in the current `git log`; those fixes were
> re-verified by reading the live source and are confirmed in place (source-verified).

## Fixed Issues

### CR-01: Race condition in `acceptInvitation` — concurrent requests can redeem the same token twice

**Files modified:** `src/actions/invitations.ts`
**Commit:** prior run (source-verified at `src/actions/invitations.ts:220-235`)
**Applied fix:** The separate `SELECT` + `UPDATE` was replaced with a single atomic conditional claim: `.update({ status: 'accepted', accepted_at }).eq('token', token).eq('status', 'pending').gte('expires_at', now).select('id, tenant_id, email, role').single()`. The action proceeds only if the claim returns a row, so a second concurrent acceptance reads null and returns "Convite inválido ou expirado".

### CR-02: Open redirect in `/auth/confirm` route — `redirect_to` parameter not validated

**Files modified:** `src/app/auth/confirm/route.ts`
**Commit:** prior run (source-verified at `src/app/auth/confirm/route.ts:8-10`)
**Applied fix:** `redirect_to` is read into `rawNext` and validated with `next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/clinica'`, so protocol-relative and absolute URLs fall back to `/clinica`.

### CR-03: `invitations` table has no DB-level audit trigger — only application-layer logging

**Files modified:** `supabase/migrations/20260604000300_clinics_users_phase1.sql`
**Commit:** prior run (source-verified at migration lines 91-94)
**Applied fix:** Added `CREATE TRIGGER audit_invitations AFTER INSERT OR UPDATE OR DELETE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();`, reusing the SECURITY DEFINER audit function so dashboard edits and direct SQL on invitations are captured (LGPD/SEC-02).

### WR-01: `signUpClinic` — error from `signInWithPassword` after signup is silently ignored

**Files modified:** `src/actions/auth.ts`
**Commit:** prior run (source-verified at `src/actions/auth.ts:70-74`)
**Applied fix:** The post-signup `signInWithPassword` now destructures `signInError`; on failure it returns "Conta criada, mas não foi possível autenticar automaticamente. Faça login." instead of redirecting to a sessionless `/clinica`.

### WR-02: `acceptInvitation` — `signInWithPassword` error silently ignored after user creation

**Files modified:** `src/actions/invitations.ts`
**Commit:** prior run (source-verified at `src/actions/invitations.ts:281-288`)
**Applied fix:** The post-acceptance `signInWithPassword` now checks `signInError`; on failure it returns "Conta criada. Acesse a página de login para entrar." Since the invitation is already consumed, the message routes the user to login.

### WR-03: `revokeInvitation` uses anon client for actor fetch without checking query error

**Files modified:** `src/actions/invitations.ts`
**Commit:** prior run (source-verified at `src/actions/invitations.ts:311-318`)
**Applied fix:** The actor fetch destructures `{ data: actor, error: actorError }` and guards with `if (actorError ?? !actor)` returning "Usuário não encontrado" before the role check, so a failed RLS-scoped query short-circuits before the admin-client revoke.

### WR-04: `patient_consents` RLS policy missing `WITH CHECK` — inserts not restricted

**Files modified:** `supabase/migrations/20260604000400_rls_phase1.sql`
**Commit:** prior run (source-verified at migration lines 16-19)
**Applied fix:** Added explicit write policy `CREATE POLICY "patient_consents_patient_write" ON public.patient_consents FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());`, making tenant-scoped write access explicit per the CLAUDE.md "always pair USING with WITH CHECK" rule.

### WR-05: `logBusinessEvent` errors are silently discarded — audit failure is invisible

**Files modified:** `src/lib/audit.ts`
**Commit:** prior run (source-verified at `src/lib/audit.ts:11-23`)
**Applied fix:** The `audit_logs` insert destructures `{ error }`; on failure it logs `console.error('[audit] logBusinessEvent failed:', error.message, params)` with full context, surfacing audit failures to operators without throwing.

### IN-01: `InviteAcceptForm` — `clinicName` and `role` props declared but never used

**Files modified:** `src/app/invite/[token]/InviteAcceptForm.tsx`
**Commit:** 1530fc4
**Applied fix:** Consumed the previously-dead props by destructuring `clinicName` and `role` and rendering a confirmation banner at the top of the form ("Ativando acesso a {clinicName} como {role}"). Added a local `ROLE_LABELS` map for human-readable role labels (matching the parent page's labels). The props are no longer dead code.

### IN-02: `inviteSchema` in `auth.ts` is unused — superseded by `createInviteSchema` in `invitation.ts`

**Files modified:** `src/lib/validators/auth.ts`
**Commit:** 10e63ff
**Applied fix:** Removed the unused `inviteSchema` constant and its `InviteInput` type export. Confirmed via codebase search that neither symbol is imported anywhere; the invitation flow uses `createInviteSchema`/`CreateInviteInput` from `invitation.ts` exclusively.

### IN-03: `PasswordResetEmail` component is defined but never referenced in any server action

**Files modified:** `src/actions/auth.ts`, `src/emails/PasswordResetEmail.tsx`
**Commit:** 4f0492f
**Applied fix:** Chose the explicit-deferral option from the review (the lower-risk path, since `sendPasswordReset` intentionally relies on Supabase's built-in recovery email in Phase 1). Added a comment on `sendPasswordReset` documenting that the branded template is deliberately not wired yet, and a header comment in `PasswordResetEmail.tsx` describing the reactivation path (admin `generateLink` + `resend.emails.send`). No behavioral change — this removes the "dead code by accident" ambiguity the review flagged.

### IN-04: `audit_logs` partitions only cover through August 2026 — gap coverage for new months

**Files modified:** `supabase/migrations/20260604000300_clinics_users_phase1.sql`
**Commit:** dd0e21d
**Applied fix:** Added `CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;` after the explicit month partitions, with a comment noting that month partitions should still be provisioned ahead of each boundary (recurring migration or pg_cron). The DEFAULT partition acts as a safety net so inserts past August 2026 do not fail and audit-log data is never lost.

---

_Fixed: 2026-06-20T18:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
