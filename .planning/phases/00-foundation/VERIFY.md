# Phase 0 — Manual Verification Checklist

**Plan:** 00-03 (db push + RLS verification)
**Project:** jqjwyqlbbuqnrffdnlpp
**Requirement refs:** INFRA-02, INFRA-04, INFRA-06, INFRA-07, SEC-07, C-1, C-2, C-5

This checklist covers the manual verifications that cannot be automated by CI —
they require dashboard access, live SQL Editor interaction, or post-build artifact inspection.

Run each step in order. Record results in the checkboxes.

---

## 1. Region Confirmation (INFRA-02 / LGPD Data Residency)

**Why:** sa-east-1 (São Paulo) is immutable after project creation. LGPD requires patient data
to remain within Brazil. If the project was created in the wrong region, a new project must be
created before any data is written.

**Steps:**
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project `jqjwyqlbbuqnrffdnlpp`
3. Navigate to: Project Settings → General → Region
4. Confirm the value reads **"South America (São Paulo)"** / `sa-east-1`

- [ ] Region confirmed as `sa-east-1` (South America / São Paulo)

**If region is NOT sa-east-1:** STOP. Do not proceed. Create a new Supabase project in
sa-east-1 and re-run `npx supabase link --project-ref <new-ref>` + `npx supabase db push`.

---

## 2. RLS Verification SQL Script (INFRA-06 / C-1 / C-5 / SEC-07)

**Why:** `npx tsc --noEmit` and `npm run build` pass based on local TypeScript config — they do NOT
prove the live database is correctly configured. The SQL checks below prove the schema is live and
the security invariants hold against the actual Supabase project.

**Steps:**
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/jqjwyqlbbuqnrffdnlpp/sql)
2. Open file: `supabase/tests/rls-checks.sql` (in the project repo)
3. Run each CHECK block in order and record the results below

### Check 1 — SECURITY DEFINER functions present (C-5 / INFRA-07)

Expected: `get_my_tenant_id` and `get_my_role` both returned with `is_security_definer = true`.

- [ ] `get_my_tenant_id` row present, `is_security_definer = true`
- [ ] `get_my_role` row present, `is_security_definer = true`
- [ ] `custom_access_token_hook` NOT present (FREE plan — hook not registered; expected absence)

### Check 2 — Policy bodies contain no direct FROM users subqueries (C-1)

Expected: 6 policies listed. No `qual` or `with_check` value contains a literal subquery
against the `users` table (e.g., `FROM users` or `FROM public.users`).

- [ ] 6 policies listed (audit_logs x3, tenants x2, users x1)
- [ ] No `qual` or `with_check` field contains a direct `FROM users` subquery
- [ ] All policies use `get_my_tenant_id()` or `get_my_role()` calls only

### Check 3 — C-1 RLS recursion test (INFRA-06)

**This test must be run as the `authenticated` role, not the service role.**

In the SQL Editor, run in a single transaction:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT * FROM public.users LIMIT 1;
ROLLBACK;
```

- [ ] Query returns 0 rows (empty table) or actual rows — NOT an error
- [ ] NO "stack depth limit exceeded" error
- [ ] NO "infinite recursion detected in policy" error

### Check 4 — Zero bare TIMESTAMP columns (SEC-07)

Expected: query returns 0 rows. Any row returned is a violation.

- [ ] 0 rows returned — all timestamps in public schema are TIMESTAMPTZ

### Check 5 — RLS enabled on all 3 core tables (INFRA-06)

Expected: at minimum `tenants`, `users`, `audit_logs` listed with `rls_enabled = true`.

- [ ] `tenants` listed with RLS enabled
- [ ] `users` listed with RLS enabled
- [ ] `audit_logs` listed with RLS enabled

### Check 6 — REVOKE EXECUTE from PUBLIC confirmed

Expected: `can_execute = false` for both `get_my_tenant_id` and `get_my_role` for the `public` role.

- [ ] `get_my_tenant_id` — `can_execute = false` for `public` role
- [ ] `get_my_role` — `can_execute = false` for `public` role

---

## 3. Post-Build Secret Check (C-2 / SEC)

**Why:** Next.js inlines all `NEXT_PUBLIC_` environment variables into the static bundle at build time.
If `SUPABASE_SERVICE_ROLE_KEY` or `ENCRYPTION_KEY` were accidentally prefixed with `NEXT_PUBLIC_`,
they would appear in `.next/static/` and be visible to any browser loading the app.

**Steps:**
1. Run the production build: `npm run build`
2. After build completes, run the security check:
   ```bash
   grep -r "service_role" .next/static/ && echo "LEAK DETECTED" || echo "CLEAN"
   ```
   Or use the package.json script: `npm run security-check`
3. On Windows PowerShell (without Git Bash):
   ```powershell
   findstr /s "service_role" .next\static\ ; if ($LASTEXITCODE -eq 0) { "LEAK DETECTED" } else { "CLEAN" }
   ```

- [ ] `grep -r "service_role" .next/static/` returns nothing (exit code 1 = no match = CLEAN)
- [ ] `npm run security-check` script exits 0 with output "CLEAN" (or no output)

**If LEAK DETECTED:** Immediately check:
- No env var starts with `NEXT_PUBLIC_SUPABASE_SERVICE` or `NEXT_PUBLIC_ENCRYPTION`
- `src/lib/supabase/admin.ts` has `import 'server-only'` at the top
- `src/lib/crypto.ts` has `import 'server-only'` at the top
- Trace the import chain from any `"use client"` file to find the leak

---

## 4. JWT / Auth Hook Status (INFRA-07)

**Note:** Supabase FREE plan — Custom Access Token Hook is Pro-only and is NOT used in this project.

**What this means for INFRA-07:**
- INFRA-07 (inject `tenant_id` + `user_role` into JWT) is fulfilled via SECURITY DEFINER functions, NOT via the JWT hook.
- `get_my_tenant_id()` reads `tenant_id` from `public.users` at query time (per RLS evaluation).
- `get_my_role()` reads `role` from `public.users` at query time.
- No JWT claims for `tenant_id` or `user_role` are present — this is expected and correct.
- The `jwt.io` decode step from `00-VALIDATION.md` is NOT required (no claims to verify).

- [x] INFRA-07 acknowledged: fulfilled via SECURITY DEFINER functions (not JWT hook)
- [x] Custom Access Token Hook intentionally absent — FREE plan constraint (D-11)
- [ ] Upgrade path noted: when migrating to Supabase Pro, add `custom_access_token_hook` migration and register in Auth > Hooks as a performance optimization (reduces 1 DB lookup per RLS evaluation per query)

---

## 5. Sign-Off

Complete this section once all checks above are checked off.

| Check | Requirement | Status |
|-------|-------------|--------|
| Region = sa-east-1 | INFRA-02 | ⬜ pending |
| SECURITY DEFINER functions present | INFRA-07 / C-5 | ⬜ pending |
| No direct FROM users in policy bodies | C-1 | ⬜ pending |
| RLS recursion test passes | INFRA-06 / C-1 | ⬜ pending |
| 0 bare TIMESTAMP columns | SEC-07 | ⬜ pending |
| RLS enabled on all 3 tables | INFRA-06 | ⬜ pending |
| REVOKE EXECUTE from PUBLIC confirmed | C-5 | ⬜ pending |
| Post-build secret check CLEAN | C-2 | ⬜ pending |
| Hook absence acknowledged | INFRA-07 | ⬜ pending |

**Phase 0 sign-off:** [ ] All checks complete — Phase 0 Foundation is production-ready.

---

*Created: 2026-06-04*
*Plan: 00-03*
*Project ref: jqjwyqlbbuqnrffdnlpp*
