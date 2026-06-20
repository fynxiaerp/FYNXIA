---
phase: 01-auth-tenant-onboarding
fixed_at: 2026-06-20T18:02:43Z
review_path: .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-20T18:02:43Z
**Source review:** .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; Info findings excluded by scope)
- Fixed: 8
- Skipped: 0

> All 8 in-scope findings were already resolved and committed by a prior fix run. This
> iteration re-verified each fix against the current committed source (Tier 1 re-read):
> every fix is present, carries its finding-ID comment marker, and the surrounding code is
> intact. The working tree is clean for all touched source files, so no new edits or commits
> were required. Commit hashes below reference the existing atomic fix commits.

## Fixed Issues

### CR-01: Race condition in `acceptInvitation` — concurrent requests can redeem the same token twice

**Files modified:** `src/actions/invitations.ts`
**Commit:** d3e1d92
**Applied fix:** Replaced the separate `SELECT` + `UPDATE` pattern with a single atomic conditional update via `.update({ status: 'accepted', accepted_at }).eq('token', token).eq('status', 'pending').gte('expires_at', now).select('id, tenant_id, email, role').single()`. The action only proceeds if the claim returns a row, so a second concurrent acceptance reads a null row and returns "Convite inválido ou expirado". Verified at `src/actions/invitations.ts:220-235`.

### CR-02: Open redirect in `/auth/confirm` route — `redirect_to` parameter not validated

**Files modified:** `src/app/auth/confirm/route.ts`
**Commit:** f5cfef0
**Applied fix:** `redirect_to` is read into `rawNext` and validated: `next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/clinica'`. Protocol-relative and absolute URLs fall back to `/clinica`, blocking off-site redirects after OTP verification. Verified at `src/app/auth/confirm/route.ts:8-10`.

### CR-03: `invitations` table has no DB-level audit trigger — only application-layer logging

**Files modified:** `supabase/migrations/20260604000300_clinics_users_phase1.sql`
**Commit:** 61e12cc
**Applied fix:** Added `CREATE TRIGGER audit_invitations AFTER INSERT OR UPDATE OR DELETE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();` after the `audit_users` trigger, reusing the existing SECURITY DEFINER function so dashboard edits and direct SQL on invitations are captured in `audit_logs` (LGPD/SEC-02). Verified at migration lines 91-94.

### WR-01: `signUpClinic` — error from `signInWithPassword` after signup is silently ignored

**Files modified:** `src/actions/auth.ts`
**Commit:** 4901c83
**Applied fix:** The post-signup `signInWithPassword` now destructures `signInError`; on failure it returns "Conta criada, mas não foi possível autenticar automaticamente. Faça login." instead of redirecting to a sessionless `/clinica`. Verified at `src/actions/auth.ts:70-74`.

### WR-02: `acceptInvitation` — `signInWithPassword` error silently ignored after user creation

**Files modified:** `src/actions/invitations.ts`
**Commit:** 6aa633b
**Applied fix:** The post-acceptance `signInWithPassword` now checks `signInError`; on failure it returns "Conta criada. Acesse a página de login para entrar." rather than redirecting without a session. Since the invitation is already consumed, the message routes the user to login. Verified at `src/actions/invitations.ts:281-288`.

### WR-03: `revokeInvitation` uses anon client for actor fetch without checking query error

**Files modified:** `src/actions/invitations.ts`
**Commit:** cc68de4
**Applied fix:** The actor fetch destructures `{ data: actor, error: actorError }` and guards with `if (actorError ?? !actor)` returning "Usuário não encontrado" before the role check, so a failed RLS-scoped query short-circuits before the admin-client revoke. Verified at `src/actions/invitations.ts:311-318`.

### WR-04: `patient_consents` RLS policy missing `WITH CHECK` — inserts not restricted

**Files modified:** `supabase/migrations/20260604000400_rls_phase1.sql`
**Commit:** 7690806
**Applied fix:** Added explicit write policy `CREATE POLICY "patient_consents_patient_write" ON public.patient_consents FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());`, making tenant-scoped write access explicit per the CLAUDE.md "always pair USING with WITH CHECK" rule. Verified at migration lines 16-19.

### WR-05: `logBusinessEvent` errors are silently discarded — audit failure is invisible

**Files modified:** `src/lib/audit.ts`
**Commit:** caf02a6
**Applied fix:** The `audit_logs` insert destructures `{ error }`; on failure it logs `console.error('[audit] logBusinessEvent failed:', error.message, params)` with full context, surfacing audit failures to operators without throwing (callers are not interrupted). Verified at `src/lib/audit.ts:11-23`.

---

_Fixed: 2026-06-20T18:02:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
