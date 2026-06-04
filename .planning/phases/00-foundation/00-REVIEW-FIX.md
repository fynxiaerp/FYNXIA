---
phase: 00-foundation
fixed_at: 2026-06-04T00:00:00Z
review_path: .planning/phases/00-foundation/00-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 00: Code Review Fix Report

**Fixed at:** 2026-06-04T00:00:00Z
**Source review:** .planning/phases/00-foundation/00-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: RLS Verification Check 6 Is a No-Op — REVOKE Test Never Fires

**Files modified:** `supabase/tests/rls-checks.sql`
**Commit:** 623765a
**Applied fix:** Replaced the broken `pg_proc CROSS JOIN pg_roles WHERE rolname='public'` query (which always returns 0 rows because PUBLIC is a PostgreSQL pseudo-role with no row in pg_roles) with a direct `has_function_privilege('anon', ...)` and `has_function_privilege('authenticated', ...)` check against named roles. The new query returns one row per function showing whether anon and authenticated roles can execute it — both must be `false` for the REVOKE to be confirmed effective.

---

### CR-02: Middleware Blanket-Bypasses All `/api/*` Routes — Future Auth Gap

**Files modified:** `src/proxy.ts`
**Commit:** 98f7b8e
**Applied fix:** Replaced the blanket `isApiRoute = pathname.startsWith('/api')` variable with a whitelist `isPublicApiRoute` that only permits `/api/health` (exact match) and `/api/webhooks/*` (webhook routes that authenticate via HMAC signature). All other `/api/*` routes now go through the standard auth guard — unauthenticated requests to protected API paths receive a `401 Unauthorized` JSON response rather than a login redirect, which is the correct behaviour for programmatic API consumers.

---

### WR-01: `tenants_admin_update` WITH CHECK Does Not Re-Assert Role Constraint

**Files modified:** `supabase/migrations/20260603000100_rls_policies.sql`
**Commit:** cbce7d4
**Applied fix:** Added `AND get_my_role() = 'admin'` to the `WITH CHECK` clause of the `tenants_admin_update` policy so that both the pre-update row check (USING) and the post-update proposed row check (WITH CHECK) fully enforce the tenant + role invariant. Previously the WITH CHECK only verified tenant scope, leaving the role assertion absent from the write-time validation.

---

### WR-02: Email Confirmation Disabled in Auth Config

**Files modified:** `supabase/config.toml`
**Commit:** d8dc26e
**Applied fix:** Changed `enable_confirmations = false` to `enable_confirmations = true` in the `[auth.email]` section, with an inline comment noting the LGPD compliance rationale. Users must now verify their email address before first sign-in, establishing account ownership proof required for LGPD consent attribution.

---

### WR-03: Password Policy Too Weak for Healthcare SaaS

**Files modified:** `supabase/config.toml`
**Commit:** 39fa6bc
**Applied fix:** Raised `minimum_password_length` from `6` to `10` and set `password_requirements` to `"lower_upper_letters_digits"`, requiring passwords to contain both uppercase and lowercase letters plus digits. This aligns with CFM best-practice guidelines for systems storing patient health data under LGPD.

---

### WR-04: `@base-ui/react` Not in Documented Tech Stack

**Files modified:** `CLAUDE.md`
**Commit:** 981b815
**Applied fix:** Since `@base-ui/react` is actively used in `src/components/ui/button.tsx` (confirmed by codebase search), the fix is documentation rather than removal. Added a "UI Component Primitives" conventions section to CLAUDE.md that establishes the canonical usage rule: prefer `shadcn add <component>` first; reach for `@base-ui/react` directly only when shadcn has no equivalent. Lists the current `button.tsx` usage as the canonical example and instructs developers to document future `@base-ui/react` additions in the same table.

---

_Fixed: 2026-06-04T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
