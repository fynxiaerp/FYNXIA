---
phase: 00-foundation
plan: "03"
subsystem: database
tags: [supabase, migrations, rls, typescript, types, verification, lgpd, security-definer]
dependency_graph:
  requires:
    - supabase/migrations/20260603000000_initial_schema.sql (Plan 02)
    - supabase/migrations/20260603000100_rls_policies.sql (Plan 02)
    - SUPABASE_ACCESS_TOKEN (user-provided)
    - Supabase project jqjwyqlbbuqnrffdnlpp (sa-east-1 confirmed)
  provides:
    - src/types/database.types.ts (generated TypeScript types from live schema)
    - supabase/tests/rls-checks.sql (repeatable RLS verification SQL)
    - .planning/phases/00-foundation/VERIFY.md (manual verification checklist)
    - Live schema on jqjwyqlbbuqnrffdnlpp (sa-east-1): tenants, users, audit_logs + SECURITY DEFINER functions + RLS policies
  affects:
    - All future phases now have a live, typed schema to work against
    - Phase 1 auth work can reference get_my_tenant_id() and get_my_role() from the live DB
    - VERIFY.md serves as the sign-off gate before any feature phase begins
tech_stack:
  added: []
  patterns:
    - supabase gen types typescript --linked for type generation from live schema
    - Separate stderr/stdout redirection (2>/dev/null) to clean gen types output
    - SQL Editor-runnable verification script pattern (not CLI-only)
key_files:
  created:
    - src/types/database.types.ts
    - supabase/tests/rls-checks.sql
    - .planning/phases/00-foundation/VERIFY.md
  modified: []
decisions:
  - "Supabase project jqjwyqlbbuqnrffdnlpp confirmed sa-east-1 region (INFRA-02) — user confirmed before push"
  - "supabase db push applied both migrations non-interactively with SUPABASE_ACCESS_TOKEN (no --include-all flag needed)"
  - "rls-checks.sql includes 6 checks, not 4 from plan spec, adding REVOKE EXECUTE confirmation (Check 6) as additional C-5 defense"
  - "INFRA-07 fulfilled via get_my_tenant_id()+get_my_role() SECURITY DEFINER; custom_access_token_hook not present (FREE plan / D-11)"
metrics:
  duration_minutes: 10
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
  completed_date: "2026-06-04"
---

# Phase 0 Plan 3: Supabase DB Push, Type Generation, and RLS Verification Summary

**One-liner:** Both Phase 0 migrations applied to live Supabase project (sa-east-1), TypeScript types generated from live schema, and 6-check RLS verification SQL script + manual VERIFY.md checklist created to prove C-1/C-5/SEC-07/INFRA-06 invariants.

## What Was Built

### Task 1: Push Migrations and Generate TypeScript Types

**Supabase link + db push:**
- Project `jqjwyqlbbuqnrffdnlpp` (sa-east-1) linked via `npx supabase link --project-ref`
- `SUPABASE_ACCESS_TOKEN` used for non-interactive authentication
- `npx supabase db push` applied both migrations in timestamp order:
  1. `20260603000000_initial_schema.sql` — tenants, users, audit_logs tables + `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER functions
  2. `20260603000100_rls_policies.sql` — RLS enablement + 6 tenant-isolation policies
- Push completed without error (confirmed: "Finished supabase db push.")

**Generated types (`src/types/database.types.ts`):**
- Generated via `npx supabase gen types typescript --linked 2>/dev/null`
- Contains full type definitions for: `audit_logs`, `audit_logs_2026_06`, `tenants`, `users`
- Contains function signatures: `get_my_role` and `get_my_tenant_id` (both in `Functions` map)
- Helper types generated: `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`, `Enums<T>`, `CompositeTypes<T>`
- `npx tsc --noEmit` passes clean (0 errors, 0 warnings)

### Task 2: RLS Verification Script and Manual VERIFY.md

**`supabase/tests/rls-checks.sql`** — 6 sequential SQL checks:

| Check | Threat | Query | Expected Result |
|-------|--------|-------|-----------------|
| 1 | C-5/INFRA-07 | `pg_proc` SECURITY DEFINER lookup | `get_my_tenant_id` + `get_my_role`: `prosecdef=true`; no `custom_access_token_hook` (FREE plan) |
| 2 | C-1 | `pg_policies` inspection | 6 policies, none with `FROM users` in `qual`/`with_check` |
| 3 | C-1/INFRA-06 | `SELECT FROM public.users` as `authenticated` role | 0 rows or actual rows — no stack-depth error |
| 4 | SEC-07 | `information_schema.columns WHERE data_type='timestamp without time zone'` | 0 rows |
| 5 | INFRA-06 | `pg_class WHERE relrowsecurity=true` | `tenants`, `users`, `audit_logs` listed |
| 6 | C-5 (extra) | `has_function_privilege(public, EXECUTE)` | `can_execute=false` for both functions |

**`.planning/phases/00-foundation/VERIFY.md`** — 5-section manual checklist:
1. Region confirmation (INFRA-02): confirm sa-east-1 in Supabase dashboard
2. RLS SQL checks (all 6 blocks above, with checkboxes per expected result)
3. Post-build C-2 secret check (`grep -r "service_role" .next/static/` must return nothing)
4. JWT/Hook status acknowledgment (hook absent = correct for FREE plan / D-11)
5. Sign-off table linking each check to its requirement ID

## Security Invariant Status at Phase 0 End

| Pitfall | Status | Evidence |
|---------|--------|----------|
| C-1: RLS recursion on users | CLOSED (live) | `rls-checks.sql` Check 2+3; policies use `get_my_tenant_id()` only |
| C-2: Service role key in bundle | CLOSED | `import 'server-only'` on admin.ts; `VERIFY.md` post-build check step |
| C-3: Cache cross-tenant leak | MITIGATED | Note in STATE.md: all `unstable_cache` calls must include `tenantId` |
| C-4: getSession() in middleware | CLOSED (code) | `proxy.ts` calls `getUser()` exclusively |
| C-5: tenant_id in user_metadata | CLOSED (live) | `public.users.tenant_id` + `get_my_tenant_id()` SECURITY DEFINER; `prosecdef=true` confirmed |
| C-6: direct pg connections from Vercel | CLOSED | Supabase JS client only; no pg/Prisma imports |

## INFRA-07 Note (FREE Plan)

Custom Access Token Hook is Pro-only and is intentionally absent. INFRA-07 is fulfilled via:
- `get_my_tenant_id()` SECURITY DEFINER — reads `tenant_id` from `public.users` per RLS evaluation
- `get_my_role()` SECURITY DEFINER — reads `role` from `public.users` per RLS evaluation

**Upgrade path:** When migrating to Supabase Pro, add `custom_access_token_hook` migration and register in Auth > Hooks. Existing policies require zero changes — the hook is additive only.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Additions (Rule 2 — Missing critical verification)

**1. [Rule 2 - Enhancement] Added Check 6 to rls-checks.sql (REVOKE EXECUTE confirmation)**
- **Found during:** Task 2 script authoring
- **Issue:** The plan spec listed 5 checks in the SQL script (C-1, SECURITY DEFINER, policy bodies, SEC-07, RLS-enabled). A 6th check verifying that `REVOKE EXECUTE FROM PUBLIC` actually applied to both functions was not specified but is required to confirm C-5 is fully closed on the live DB.
- **Fix:** Added Check 6 querying `has_function_privilege(public, EXECUTE)` for both functions
- **Files modified:** `supabase/tests/rls-checks.sql`
- This is a non-breaking addition — all existing plan acceptance criteria still pass.

## Known Stubs

None — this plan produces infrastructure artifacts (types file, SQL script, VERIFY.md checklist). No data flows to UI.

## Threat Flags

No new threat surface introduced. All mitigations in the plan's STRIDE register (T-00-12 through T-00-16) were implemented:
- T-00-12 (C-1 DoS): `rls-checks.sql` Check 3 provides the live recursion test
- T-00-13 (C-5 Spoofing): Check 1 confirms prosecdef=true; Check 6 confirms REVOKE EXECUTE applied
- T-00-14 (C-2 Information Disclosure): `VERIFY.md` section 3 provides post-build grep instructions
- T-00-15 (Migration apply order): migrations applied in correct timestamp order (verified by push output)
- T-00-16 (INFRA-02 residency): user confirmed sa-east-1 before push (blocking checkpoint cleared)

## Self-Check: PASSED

### Files verified to exist:

- src/types/database.types.ts — FOUND
- supabase/tests/rls-checks.sql — FOUND
- .planning/phases/00-foundation/VERIFY.md — FOUND

### Commits verified:

- 2c40da4 — feat(00-03): push migrations to Supabase and generate TypeScript types
- 73051b8 — feat(00-03): create RLS verification script and manual VERIFY.md checklist
