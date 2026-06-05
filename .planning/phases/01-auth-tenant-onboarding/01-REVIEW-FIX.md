---
phase: 01-auth-tenant-onboarding
fixed_at: 2026-06-05T00:00:00Z
review_path: .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-05T00:00:00Z
**Source review:** .planning/phases/01-auth-tenant-onboarding/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical, 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Race condition in `acceptInvitation` — concurrent requests can redeem the same token twice

**Files modified:** `src/actions/invitations.ts`
**Commit:** d3e1d92
**Applied fix:** Replaced the separate `SELECT` + `UPDATE` pattern with a single atomic `UPDATE ... WHERE status='pending' AND expires_at >= now() RETURNING *` using Supabase's chained `.update().eq('status','pending').gte('expires_at', ...).select().single()`. Only proceeds if the update returns a row. Also removed the now-redundant separate `update({ status: 'accepted' })` call that followed later in the function, since the claim step already performs that write.

---

### CR-02: Open redirect in `/auth/confirm` route — `redirect_to` parameter not validated

**Files modified:** `src/app/auth/confirm/route.ts`
**Commit:** f5cfef0
**Applied fix:** Added validation that `rawNext` starts with `/` and does not start with `//` before assigning to `next`. Any value failing this check falls back to `/clinica`, preventing protocol-relative URL redirects off-site.

---

### CR-03: `invitations` table has no DB-level audit trigger

**Files modified:** `supabase/migrations/20260604000300_clinics_users_phase1.sql`
**Commit:** 61e12cc
**Applied fix:** Added `CREATE TRIGGER audit_invitations AFTER INSERT OR UPDATE OR DELETE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes()` after the existing `audit_users` trigger. Uses the same `audit_table_changes()` SECURITY DEFINER function already in use for the `users` table, which correctly reads `tenant_id` from the row being mutated.

---

### WR-01: `signUpClinic` — error from `signInWithPassword` after signup is silently ignored

**Files modified:** `src/actions/auth.ts`
**Commit:** 4901c83
**Applied fix:** Destructured the error return from `signInWithPassword` and added an early return with a Portuguese error message (`'Conta criada, mas não foi possível autenticar automaticamente. Faça login.'`) when sign-in fails, so the user is never redirected to `/clinica` without an active session.

---

### WR-02: `acceptInvitation` — `signInWithPassword` error silently ignored after user creation

**Files modified:** `src/actions/invitations.ts`
**Commit:** 6aa633b
**Applied fix:** Destructured the error return from `signInWithPassword` in `acceptInvitation` and added an early return with a Portuguese error message (`'Conta criada. Acesse a página de login para entrar.'`) when sign-in fails. The invitation is already consumed at this point, so the error message directs the user to the login page rather than implying a recoverable invite state.

---

### WR-03: `revokeInvitation` uses anon client for actor fetch without checking query error

**Files modified:** `src/actions/invitations.ts`
**Commit:** cc68de4
**Applied fix:** Destructured `actorError` from the `users` query in `revokeInvitation` and added a dedicated early return for `actorError ?? !actor` (returning `'Usuário não encontrado'`) before the role check. This separates the "user row not found / DB error" case from the "user found but wrong role" case, and prevents the admin client update from proceeding when the actor fetch itself fails.

---

### WR-04: `patient_consents` RLS policy missing `WITH CHECK` — inserts not restricted

**Files modified:** `supabase/migrations/20260604000400_rls_phase1.sql`
**Commit:** 7690806
**Applied fix:** Added an explicit `CREATE POLICY "patient_consents_patient_write" ON public.patient_consents FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id())` policy after the existing SELECT policy. This makes the write restriction explicit and tenant-scoped, per CLAUDE.md convention ("Always pair USING with WITH CHECK").

---

### WR-05: `logBusinessEvent` errors are silently discarded — audit failure is invisible

**Files modified:** `src/lib/audit.ts`
**Commit:** caf02a6
**Applied fix:** Destructured `{ error }` from the `audit_logs` insert call and added an `if (error)` branch that logs `console.error('[audit] logBusinessEvent failed:', error.message, params)`. The function does not throw (callers must not fail due to audit errors), but the error is now surfaced to the operator via the server log with full context for monitoring integration.

---

_Fixed: 2026-06-05T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
