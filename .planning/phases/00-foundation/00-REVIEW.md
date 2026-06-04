---
phase: 00-foundation
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/admin.ts
  - src/lib/supabase/middleware.ts
  - src/proxy.ts
  - src/lib/crypto.ts
  - src/app/page.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/api/health/route.ts
  - vercel.json
  - .env.local.example
  - supabase/config.toml
  - tsconfig.json
  - package.json
  - supabase/migrations/20260603000000_initial_schema.sql
  - supabase/migrations/20260603000100_rls_policies.sql
  - src/types/database.types.ts
  - supabase/tests/rls-checks.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 00: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The foundation layer is well-structured overall. The Supabase client architecture correctly follows the three-client pattern (`client`, `server`, `admin`), the middleware auth flow uses `getUser()` over `getSession()`, and the crypto module implements AES-256-GCM correctly with per-encryption IVs. The multi-tenant RLS design using `SECURITY DEFINER` functions is sound for the FREE plan constraint.

Two critical issues were found: a broken REVOKE verification test that gives false confidence the REVOKE was applied, and a blanket API route bypass in the middleware that silently leaves all future `/api/*` routes unauthenticated. Four warnings address a weak `WITH CHECK` guard on tenant admin updates, email confirmation disabled, weak password policy, and an `@base-ui/react` dependency not in the documented stack. Three informational items cover the `ip_address` type, a missing audit log INSERT path, and the `security-check` script's build dependency.

---

## Critical Issues

### CR-01: RLS Verification Check 6 Is a No-Op — REVOKE Test Never Fires

**File:** `supabase/tests/rls-checks.sql:155-167`

**Issue:** Check 6 is supposed to confirm that `get_my_tenant_id()` and `get_my_role()` are not executable by the PUBLIC role. The query joins `pg_proc` with `pg_roles WHERE rolname = 'public'`. However, `PUBLIC` in PostgreSQL is a pseudo-role — it does **not** appear as a row in `pg_roles`. The join produces zero rows unconditionally, meaning the check always "passes" regardless of whether `REVOKE EXECUTE FROM PUBLIC` was actually effective. The security invariant (INFRA-07 / T-00-13) is unverified.

**Fix:** Replace with a direct privilege check using `has_function_privilege`:

```sql
-- CHECK 6 (corrected): REVOKE EXECUTE confirmation
-- Expected: both rows return can_execute = false.
-- If true, the REVOKE did not take effect and any user can call these functions directly.
SELECT
  p.proname          AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed_can_execute
FROM pg_proc p
WHERE p.proname IN ('get_my_tenant_id', 'get_my_role')
  AND p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;

-- EXPECTED: both anon_can_execute AND authed_can_execute = false for both functions.
```

---

### CR-02: Middleware Blanket-Bypasses All `/api/*` Routes — Future Auth Gap

**File:** `src/proxy.ts:15-16`

**Issue:** The `isApiRoute` check marks every path starting with `/api` as public, causing the middleware to skip authentication checks entirely for those routes and return `supabaseResponse` without a user guard. This is intentional for `/api/health` now, but it will silently allow any future `/api/*` route (billing webhooks, patient data exports, admin operations) to be accessed without authentication unless each individual route handler independently implements its own auth. In a codebase with 27 planned modules, this is a latent authorization bypass waiting to happen — especially since the comment says "future webhook endpoints," which signals future developers that `/api/*` is a safe place to add routes without worrying about auth.

**Fix:** Remove the blanket API bypass. Instead, use a whitelist for the specific routes that must be public, and require all other `/api` routes to go through the standard auth check:

```typescript
// src/proxy.ts
const isPublicApiRoute =
  pathname === '/api/health' ||
  pathname.startsWith('/api/webhooks/') // Webhooks authenticate via signature, not session

// Unauthenticated user accessing a protected route → redirect to login
if (!user && !isAuthRoute && !isPublicApiRoute) {
  // For non-browser API requests, return 401 instead of redirecting
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const redirectUrl = new URL('/login', request.url)
  redirectUrl.searchParams.set('redirectedFrom', pathname)
  return NextResponse.redirect(redirectUrl)
}
```

---

## Warnings

### WR-01: `tenants_admin_update` WITH CHECK Does Not Re-Assert Role Constraint

**File:** `supabase/migrations/20260603000100_rls_policies.sql:65-73`

**Issue:** The `USING` clause checks both `id = get_my_tenant_id() AND get_my_role() = 'admin'`, but the `WITH CHECK` clause only checks `id = get_my_tenant_id()`. Per PostgreSQL semantics, USING is evaluated against the *current* row (pre-update) and WITH CHECK is evaluated against the *proposed new* row (post-update). A non-admin user fails USING and is correctly blocked. However, the asymmetry means the WITH CHECK provides weaker guarantees than documented: if a role escalation bug elsewhere allowed a non-admin to pass USING, the WITH CHECK would not catch it. Per CLAUDE.md "Pitfall 5: every write policy has both USING and WITH CHECK" — the spirit is that both should fully enforce the invariant.

**Fix:**
```sql
CREATE POLICY "tenants_admin_update" ON public.tenants
  FOR UPDATE
  USING (
    id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  )
  WITH CHECK (
    id = get_my_tenant_id()
    AND get_my_role() = 'admin'   -- re-assert role on the new row too
  );
```

---

### WR-02: Email Confirmation Disabled in Auth Config

**File:** `supabase/config.toml:226`

**Issue:** `enable_confirmations = false` means users can sign in immediately after registration without verifying their email address. For a healthcare SaaS handling patient data under LGPD, this allows anyone to register with a fake or another person's email address and immediately gain access. This weakens account ownership verification and makes it impossible to prove LGPD consent was given by the actual email owner.

**Fix:**
```toml
[auth.email]
enable_confirmations = true   # require email verification before first sign-in
```

This requires the onboarding flow to handle the "check your email" confirmation state, but is necessary for LGPD compliance.

---

### WR-03: Password Policy Too Weak for Healthcare SaaS

**File:** `supabase/config.toml:182-185`

**Issue:** `minimum_password_length = 6` and `password_requirements = ""` (no complexity requirements). CLAUDE.md explicitly notes "Minimum 6, recommended 8 or more" and the project stores sensitive patient health data under LGPD. Six characters with no complexity requirements is below the threshold expected for healthcare systems. The Brazilian LGPD and CFM (Federal Council of Medicine) best-practice guidelines both recommend stronger credential policies for systems storing health data.

**Fix:**
```toml
minimum_password_length = 10
password_requirements = "lower_upper_letters_digits"
```

---

### WR-04: `@base-ui/react` Not in Documented Tech Stack

**File:** `package.json:13`

**Issue:** `@base-ui/react` is listed as a production dependency but is not mentioned in CLAUDE.md's tech stack. CLAUDE.md specifies `shadcn/ui` + `@radix-ui/*` as the component primitives. `@base-ui/react` is a separate MUI-sponsored project with a different API surface and bundle profile. Having both in production creates ambiguity about which primitives to use for new components, increases bundle size, and could cause accessibility/styling conflicts since both libraries provide similar primitives (dialog, popover, etc.).

**Fix:** Determine whether `@base-ui/react` is actually used anywhere in the codebase. If not, remove it. If it is used, document the decision in CLAUDE.md and establish which library is canonical for which component types.

---

## Info

### IN-01: `ip_address` Column Typed as `unknown` in Database Types

**File:** `src/types/database.types.ts:49` (and lines 90, 116)

**Issue:** The `ip_address` column in `audit_logs` has PostgreSQL type `INET`, which the Supabase type generator maps to `unknown`. This forces all call sites reading `ip_address` to use a type assertion or cast, which erodes type safety. The actual runtime value delivered by PostgREST is a string representation of the IP address.

**Fix:** The generated types file should be treated as read-only (regenerated via `supabase gen types`), but if the generator cannot resolve INET to string, add a manual override type or a type helper:
```typescript
// In a types helper file, not in the generated file:
export type AuditLogRow = Omit<Tables<'audit_logs'>, 'ip_address'> & {
  ip_address: string | null
}
```

---

### IN-02: No INSERT Path for `audit_logs` in Phase 0 — Application Cannot Write Audit Records Yet

**File:** `supabase/migrations/20260603000100_rls_policies.sql:28-48`

**Issue:** The `audit_logs` table intentionally has no INSERT RLS policy, with comments saying inserts come from "SECURITY DEFINER triggers (Phase 1+)". This is architecturally correct, but means the audit trail is completely non-functional until Phase 1 triggers are implemented. Any user action in Phase 0 (login, profile update, tenant config) generates no audit record. If Phase 1 is delayed, there will be a gap in the compliance log. This should be tracked as a known gap in the Phase 0 scope.

**Fix:** No code change required at this stage. Ensure the Phase 1 plan explicitly lists implementing the audit trigger as a hard prerequisite before any user-facing feature ships to production. Consider adding a `-- AUDIT GAP: no INSERT policy until Phase 1 triggers` comment to make the gap visible in the migration file.

---

### IN-03: `security-check` Script Requires a Prior Build to Be Meaningful

**File:** `package.json:10`

**Issue:** The `security-check` script runs `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/` to detect accidental service role key exposure in the client bundle. However, `.next/static/` only exists after running `next build`. If this script runs in CI before a build step, it will find no `.next/static/` directory and `grep` will exit non-zero (no such directory), causing the `|| echo OK` branch to fire — silently reporting "OK" when no check was actually performed.

**Fix:** Either ensure the script runs after the build step in CI, or add an existence check:
```json
"security-check": "test -d .next/static && (grep -r 'NEXT_PUBLIC_SUPABASE_SERVICE' .next/static/ && exit 1 || echo OK) || echo 'SKIP: build not found — run after next build'"
```

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
