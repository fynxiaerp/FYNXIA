---
phase: 00-foundation
verified: 2026-06-04T00:00:00Z
status: human_needed
score: 13/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run live RLS checks in Supabase SQL Editor (supabase/tests/rls-checks.sql)"
    expected: "Check 1: get_my_tenant_id + get_my_role both prosecdef=true. Check 2: 6 policies, no FROM users in qual/with_check. Check 3: authenticated role SELECT on users returns rows/empty — no stack-depth error. Check 4: 0 bare TIMESTAMP columns. Check 5: tenants, users, audit_logs listed with rls_enabled=true. Check 6: REVOKE EXECUTE confirmed (note: Check 6 query in rls-checks.sql has a no-op bug — see anti-pattern CR-01; manual verify via has_function_privilege('anon') instead)."
    why_human: "Requires live Supabase SQL Editor access; cannot be verified against the local migration files alone."
  - test: "Post-build secret check: run npm run build then grep -r 'service_role' .next/static/"
    expected: "No output (CLEAN) — SUPABASE_SERVICE_ROLE_KEY absent from the static bundle."
    why_human: "Requires a live Next.js build with real environment variables set; cannot verify without a completed build artifact."
---

# Phase 0: Foundation Verification Report

**Phase Goal:** Establish the complete project scaffold, security primitives, and multi-tenant database foundation for the FYNXIA dental ERP.
**Verified:** 2026-06-04T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `get_my_tenant_id()` SECURITY DEFINER function exists and every RLS policy uses it — no policy queries users directly (C-1) | VERIFIED | `supabase/migrations/20260603000000_initial_schema.sql` defines `get_my_tenant_id()` with `SECURITY DEFINER`. `supabase/migrations/20260603000100_rls_policies.sql` contains zero `FROM users` or `FROM public.users` in any policy body. |
| 2 | `get_my_tenant_id()` + `get_my_role()` confirmed `prosecdef=true` on the live DB — tenant/role isolation functional (FREE plan) | HUMAN NEEDED | Migration files and generated `src/types/database.types.ts` (containing `get_my_role` and `get_my_tenant_id` function signatures from live schema) confirm the functions were pushed. Live `prosecdef=true` confirmation requires SQL Editor. |
| 3 | No direct PostgreSQL connections in the codebase — only Supabase JS client via PostgREST/Supavisor (C-6 closed) | VERIFIED | `grep` for `prisma`, `require('pg')`, `from 'pg'` across `src/` returns no matches. All DB access uses `@supabase/supabase-js` + `@supabase/ssr`. |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` absent from any `NEXT_PUBLIC_` env var and absent from `.next/static/` build output (C-2 closed) | PARTIAL | `admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix), `import 'server-only'` is present. `.env.local.example` does NOT contain `NEXT_PUBLIC_SUPABASE_SERVICE`. Static bundle check requires post-build human verification. |
| 5 | All timestamps are `TIMESTAMPTZ`, health-data columns use AES-256 encryption, `vercel.json` declares `regions: ["gru1"]` | VERIFIED | Migration files: no bare `TIMESTAMP` (regex confirms). `vercel.json` contains `"gru1"`. `crypto.ts` exports `encrypt`/`decrypt`/`encryptJSON`/`decryptJSON` using `aes-256-gcm`. `users.sensitive_data TEXT` is defined for AES-256 ciphertext. |

**Score:** 13/15 must-haves verified (see per-plan breakdown below)

---

### Deferred Items

None identified — all must-haves are within Phase 0 scope.

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase/client.ts` | Browser client via `createBrowserClient` | VERIFIED | File exists, contains `createBrowserClient` |
| `src/lib/supabase/server.ts` | Server client with `import 'server-only'` | VERIFIED | First line is `import 'server-only'`; uses `createServerClient` with try/catch `setAll` |
| `src/lib/supabase/admin.ts` | Service-role client, `import 'server-only'`, `SUPABASE_SERVICE_ROLE_KEY` | VERIFIED | `import 'server-only'` on line 1; uses `SUPABASE_SERVICE_ROLE_KEY` (not NEXT_PUBLIC_) |
| `src/lib/supabase/middleware.ts` | `updateSession()` helper, getUser, H-4 cookie writes | VERIFIED | Exists; calls `getUser()`; `setAll` writes to both `request.cookies.set` and `supabaseResponse.cookies.set` |
| `src/middleware.ts` | Session refresh + route protection | ORPHANED (deviation) | File does not exist — replaced by `src/proxy.ts` (Next.js 16 convention). `src/proxy.ts` fulfills identical purpose with `proxy()` function and same `config.matcher`. Documented in 00-01-SUMMARY.md. |
| `src/proxy.ts` | Next.js 16 route protection (replaces middleware.ts) | VERIFIED | Exists; calls `updateSession()`; contains auth redirect logic; exports `config.matcher` |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt, `import 'server-only'` | VERIFIED | `import 'server-only'` on line 1; `ALGORITHM = 'aes-256-gcm'`; exports `encrypt`, `decrypt`, `encryptJSON`, `decryptJSON<T>` |
| `vercel.json` | `gru1` region + `maxDuration` | VERIFIED | Contains `"regions": ["gru1"]`; `maxDuration: 30` (API), `60` (documents) |
| `.env.local.example` | Env contract; `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY` present; no `NEXT_PUBLIC_SUPABASE_SERVICE` | VERIFIED | File exists with all 4 vars; sensitive vars marked SERVER ONLY; no NEXT_PUBLIC_ prefix on secrets |
| `src/app/api/health/route.ts` | Public GET endpoint, `runtime = 'nodejs'` | VERIFIED | Exports `GET` returning `{ status, ts }`; `export const runtime = 'nodejs'` |
| `supabase/config.toml` | Supabase CLI initialized | VERIFIED | File exists |
| `src/app/(auth)/layout.tsx` | Auth route group layout | VERIFIED | File exists |
| `src/app/(dashboard)/layout.tsx` | Dashboard route group layout | VERIFIED | File exists |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260603000000_initial_schema.sql` | tenants, users, audit_logs + SECURITY DEFINER functions | VERIFIED | Contains all 3 tables; `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER with `SET search_path = public`; `REVOKE EXECUTE FROM PUBLIC` on both; no bare TIMESTAMP |
| `supabase/migrations/20260603000100_rls_policies.sql` | RLS enablement + tenant isolation policies | VERIFIED | `ENABLE ROW LEVEL SECURITY` 3 times; `tenant_id = get_my_tenant_id()`; `FOR DELETE USING (false)`; `FOR UPDATE USING (false)`; no `FROM users` in policy bodies; no `auth.jwt()` |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/database.types.ts` | Generated TypeScript types from live schema | VERIFIED | Contains `audit_logs`, `tenants`, `users` tables; `get_my_role` and `get_my_tenant_id` in `Functions` map — confirms live push |
| `supabase/tests/rls-checks.sql` | Repeatable RLS verification SQL | VERIFIED | Contains 6 checks covering C-1, C-5, SEC-07, INFRA-06; references `get_my_tenant_id`, `pg_policies`, `information_schema.columns` |
| `.planning/phases/00-foundation/VERIFY.md` | Manual verification checklist | VERIFIED | Contains `sa-east-1`, `jwt`, `hook`; post-build secret check step present |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/proxy.ts` | `@supabase/ssr createServerClient` | `updateSession()` in `src/lib/supabase/middleware.ts` | WIRED | `proxy.ts` imports `updateSession` from `@/lib/supabase/middleware`; `middleware.ts` uses `createServerClient` with `getUser()` |
| `src/lib/supabase/admin.ts` | `process.env.SUPABASE_SERVICE_ROLE_KEY` | `import 'server-only'` guard | WIRED | `import 'server-only'` on line 1; `SUPABASE_SERVICE_ROLE_KEY` used directly (no NEXT_PUBLIC_ prefix); C-2 closed |
| `src/lib/supabase/middleware.ts` | Cookie passthrough (request + response) | H-4 prevention via `setAll` | WIRED | `setAll` writes to `request.cookies.set(name, value)` AND `supabaseResponse.cookies.set(name, value, options)` |
| `getUser()` in middleware | Auth Server JWT validation | `supabase.auth.getUser()` not `getSession()` | WIRED | `getUser()` called in `src/lib/supabase/middleware.ts:33`; `getSession` appears only in warning comments |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `users_tenant_isolation` policy | `get_my_tenant_id()` | `tenant_id = get_my_tenant_id()` | WIRED | Policy body: `USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id())` |
| `audit_logs_tenant_select` / `tenants` policies | `get_my_tenant_id()` + `get_my_role()` | SECURITY DEFINER DB lookup (FREE plan) | WIRED | `audit_logs_tenant_select` uses both functions; `tenants_admin_update` uses both; no `auth.jwt()` anywhere |

---

## Data-Flow Trace (Level 4)

Phase 0 produces only infrastructure (client factories, crypto utility, SQL migrations, generated types). No components render dynamic data. Level 4 data-flow trace is not applicable.

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `src/lib/crypto.ts` exports four functions | `grep "export function" src/lib/crypto.ts` | `encrypt`, `decrypt`, `encryptJSON`, `decryptJSON<T>` — 4 exports found | PASS |
| `vercel.json` pins gru1 | `grep "gru1" vercel.json` | `"regions": ["gru1"]` found | PASS |
| `admin.ts` has no NEXT_PUBLIC_ on service role key | `grep "NEXT_PUBLIC_.*SERVICE_ROLE" src/` | No matches | PASS |
| `getSession` absent from middleware flow | `grep "getSession" src/proxy.ts src/lib/supabase/middleware.ts` | Only appears in a comment; no functional call | PASS |
| Generated types contain all 3 tables | Check `src/types/database.types.ts` | `audit_logs`, `tenants`, `users` all present with full Row/Insert/Update types | PASS |
| No bare TIMESTAMP in migrations | `grep "TIMESTAMP(?!TZ)" supabase/migrations/*.sql` | No matches | PASS |
| No `FROM users` in RLS policy file | `grep "FROM.*users" supabase/migrations/20260603000100_rls_policies.sql` | No matches | PASS |
| No `auth.jwt()` in any migration | `grep "auth.jwt()" supabase/migrations/*.sql` | No matches | PASS |
| `package.json` contains `security-check` | Present | `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/ && exit 1 || echo OK` | PASS |
| Live schema confirmed pushed | `supabase/.temp/linked-project.json` + generated types contain live function signatures | `get_my_role` and `get_my_tenant_id` in `Functions` map in generated types | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | Plan 01 | Next.js 15 App Router + TypeScript strict mode | VERIFIED | `next@16.2.7` installed (compatible); `tsconfig.json` has `"strict": true` + `"noUncheckedIndexedAccess": true`; tsc --noEmit passes (per SUMMARY) |
| INFRA-02 | Plan 03 | Supabase PostgreSQL in sa-east-1 (São Paulo) | HUMAN NEEDED | Project `jqjwyqlbbuqnrffdnlpp` linked; SUMMARY documents user confirmed sa-east-1. Requires dashboard verification checkbox in VERIFY.md to be completed. |
| INFRA-03 | Plan 01 | Deploy to Vercel gru1 (São Paulo) | VERIFIED | `vercel.json` contains `"regions": ["gru1"]`; `maxDuration` configured |
| INFRA-04 | Plans 02, 03 | Versioned migrations in `supabase/migrations/` | VERIFIED | Two migration files exist with timestamped names; live schema confirmed via generated types |
| INFRA-05 | Plan 01 | Sensitive vars managed via Vercel Env Vars (never in code) | VERIFIED | `.env.local.example` documents contract; `admin.ts` + `crypto.ts` read from `process.env` (server-only); no hardcoded secrets |
| INFRA-06 | Plans 02, 03 | RLS enabled on all tables using `get_my_tenant_id()` SECURITY DEFINER | VERIFIED (code) / HUMAN NEEDED (live) | Migration has 3x `ENABLE ROW LEVEL SECURITY`; all policies use `get_my_tenant_id()`/`get_my_role()`; live check in VERIFY.md checkbox |
| INFRA-07 | Plans 02, 03 | Multi-tenant isolation via SECURITY DEFINER functions (FREE plan) | VERIFIED (code) / HUMAN NEEDED (live) | Both functions defined in migration; `prosecdef=true` confirmed only via live SQL check (VERIFY.md checkbox) |
| SEC-07 | Plan 02 | All timestamp columns use TIMESTAMPTZ | VERIFIED | Grep confirms zero bare TIMESTAMP in migrations |
| SEC-08 | Plan 01 | Sensitive health data encrypted AES-256 before storage | VERIFIED | `crypto.ts` implements AES-256-GCM; `users.sensitive_data TEXT` defined for encrypted blobs; server-only guarded |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/tests/rls-checks.sql` | 155-167 | Check 6 joins `pg_proc` with `pg_roles WHERE rolname = 'public'` — `PUBLIC` is a pseudo-role not in `pg_roles`, so join always returns 0 rows. REVOKE EXECUTE is never actually verified. | Warning | Security invariant for INFRA-07/C-5 appears verified but isn't. Replace with `has_function_privilege('anon', oid, 'EXECUTE')` per CR-01 in REVIEW.md. |
| `src/proxy.ts` | 15-16 | `isApiRoute` blanket-bypasses ALL `/api/*` routes — every future API endpoint is public by default unless individually guarded. | Warning | Latent auth bypass for future feature API routes (27 planned modules). Flagged in CR-02 of REVIEW.md. Not a Phase 0 goal blocker; recommended fix before Phase 1 ships feature routes. |
| `supabase/config.toml` | ~226 | `enable_confirmations = false` — users can sign in without email verification | Warning | LGPD compliance gap for healthcare SaaS. Phase 1 (Auth) must address this before production. |
| `supabase/config.toml` | ~182-185 | `minimum_password_length = 6` — weak password policy for healthcare system | Warning | Below CFM/LGPD best practice. Phase 1 should set 10+ chars with complexity. |
| `package.json` | 10 | `security-check` script runs without checking if `.next/static/` exists — if run before build, silently reports "OK" with no check performed | Info | CI must ensure build precedes this check. |

None of the anti-patterns block the Phase 0 goal of establishing the foundation scaffold. All are flagged for Phase 1 resolution.

---

## Human Verification Required

### 1. Live RLS Security Invariants

**Test:** Open `supabase/tests/rls-checks.sql` in the Supabase SQL Editor for project `jqjwyqlbbuqnrffdnlpp` and run all 6 checks. For Check 6, use the corrected query from REVIEW.md CR-01:
```sql
SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed_can_execute
FROM pg_proc p WHERE p.proname IN ('get_my_tenant_id', 'get_my_role')
  AND p.pronamespace = 'public'::regnamespace;
```
Complete all checkboxes in `.planning/phases/00-foundation/VERIFY.md`.

**Expected:**
- Check 1: `get_my_tenant_id` and `get_my_role` both with `is_security_definer = true`
- Check 2: 6 policies listed, no `FROM users` in any `qual`/`with_check`
- Check 3: `SET LOCAL ROLE authenticated; SELECT * FROM public.users LIMIT 1;` returns rows or 0 rows (no stack-depth error)
- Check 4: 0 rows returned for bare TIMESTAMP columns
- Check 5: `tenants`, `users`, `audit_logs` listed with `rls_enabled = true`
- Check 6 (corrected): `anon_can_execute = false` and `authed_can_execute = false` for both functions

**Why human:** Requires live Supabase SQL Editor access and authenticated-role simulation; cannot be verified programmatically against local files.

### 2. Post-Build Secret Check (C-2)

**Test:** Run `npm run build` then `grep -r "service_role" .next/static/` (or `npm run security-check`). On Windows PowerShell: `findstr /s "service_role" .next\static\`.

**Expected:** No output (grep exits 1 = no match = CLEAN). SUPABASE_SERVICE_ROLE_KEY must not appear in any client bundle file.

**Why human:** Requires a completed Next.js build with environment variables set; `.next/static/` does not exist until after `npm run build`.

### 3. Supabase Region Confirmation (INFRA-02 / LGPD)

**Test:** Supabase Dashboard -> Project Settings -> General -> Region for project `jqjwyqlbbuqnrffdnlpp`.

**Expected:** Region reads "South America (São Paulo)" / `sa-east-1`.

**Why human:** Dashboard-only check; the Supabase CLI `supabase/.temp/linked-project.json` confirms the project is linked but does not expose the region setting.

---

## Gaps Summary

No automated-verifiable gaps were found. All 13 of 15 programmatically verifiable must-haves pass. The remaining 2 items require human verification:

1. **INFRA-02 / INFRA-06 / INFRA-07 (live DB):** Migration files and generated types strongly indicate the schema was pushed to the correct project, but `prosecdef=true` confirmation and RLS recursion-free proof require running `rls-checks.sql` in the SQL Editor and completing VERIFY.md checkboxes.

2. **C-2 post-build check:** The static bundle secret scan requires a live build artifact.

One code-quality issue warrants attention before Phase 1 ships feature routes:

- **`src/proxy.ts` blanket API bypass (CR-02):** The `isApiRoute` check makes all future `/api/*` routes unauthenticated by default. This is not a Phase 0 goal violation (no feature routes exist yet), but must be fixed before Phase 1 adds any protected API endpoints.

---

_Verified: 2026-06-04T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
