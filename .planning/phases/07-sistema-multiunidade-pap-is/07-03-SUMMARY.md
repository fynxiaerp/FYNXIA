---
phase: "07"
plan: "03"
subsystem: rbac-icp-aiconfig
tags: [rbac, module-permissions, proxy, node-forge, icp-brasil, certificates, ai-agent-config, migrations, read-only-gating]
dependency_graph:
  requires:
    - "07-01: node-forge installed, test scaffolds (matrix.test.ts, pfx-metadata.test.ts, phase7.test.ts)"
    - "07-02: units table, user_units, role expansion migrations"
  provides:
    - "src/proxy.ts: MODULE_PERMISSIONS 11-role x 7-module matrix + isReadOnly + x-read-only header"
    - "src/lib/icp/pfx-metadata.ts: server-only extractPfxMetadata() (node-forge PKCS12)"
    - "supabase/migrations/20260614000500_certificates.sql: certificates table + private icp-certificates bucket"
    - "supabase/migrations/20260614000600_ai_agent_config.sql: ai_agent_config table (L0-L4) + partial unique indexes"
    - "__mocks__/server-only.js + src/__tests__/setup.ts: CJS require() test infrastructure"
  affects:
    - "Plan 04: db push applies 20260614000500 + 20260614000600"
    - "Plan 05: empresa/config UI reads MODULE_PERMISSIONS gating + reads x-read-only"
    - "Plan 06: certificate upload Server Action uses extractPfxMetadata() + admin client bucket write"
    - "Plans 05-09: assertNotReadOnly() (Plan 01) + x-read-only header (this plan) gate all mutations"
    - "Phase 10 (AIG): ai_agent_config autonomy enforcement reads this plan's table"
    - "Phase 8 (DOC): cert signing reads certificates table storage_path + cert_password_enc"
tech_stack:
  added: []
  patterns:
    - "MODULE_PERMISSIONS matrix: 11 roles x 7 modules (Research Pattern 3 verbatim)"
    - "routeToModule() most-specific resolver: /clinica/financeiro -> financeiro BEFORE /clinica"
    - "ROLE_ROUTES derived from MODULE_PERMISSIONS for backward compat with existing tests"
    - "x-read-only request header forwarded alongside x-user-role in proxy()"
    - "node-forge: forge.pki.certificateToAsn1(cert) for thumbprint (not cert.toAsn1())"
    - "forge.pki.oids.certBag ?? literal fallback for type-safe OID indexing"
    - "Partial unique indexes (WHERE unit_id IS NULL / IS NOT NULL) for nullable FK deduplication"
    - "CJS require() server-only mock: __mocks__/server-only.js + setupFiles registration"
key_files:
  created:
    - src/lib/icp/pfx-metadata.ts
    - supabase/migrations/20260614000500_certificates.sql
    - supabase/migrations/20260614000600_ai_agent_config.sql
    - __mocks__/server-only.js
    - src/__tests__/setup.ts
  modified:
    - src/proxy.ts (ROLE_ROUTES -> MODULE_PERMISSIONS matrix + isReadOnly + x-read-only header)
    - src/__tests__/icp/pfx-metadata.test.ts (require() .ts extension fix)
    - vitest.config.ts (setupFiles added)
decisions:
  - "routeToModule() uses an ordered array (ROUTE_MODULE_MAP) so /clinica/financeiro is checked before /clinica — guarantees most-specific module wins"
  - "ROLE_ROUTES derived from MODULE_PERMISSIONS via deriveRoleRoutes() — single source of truth, no duplication"
  - "Unknown roles fall back to patient-level access (/paciente only) preserving original ROLE_ROUTES fallback behavior"
  - "forge.pki.certificateToAsn1(cert) used instead of cert.toAsn1() — cert objects in node-forge 1.4.0 do not have toAsn1() method"
  - "CERT_BAG_OID uses ?? fallback literal because forge.pki.oids.certBag is typed string|undefined — avoids tsc TS2322"
  - "__mocks__/server-only.js + setup.ts pre-cache: vi.mock() only intercepts ESM imports, not CJS require(); setup file patches require.cache before tests run"
  - "pfx-metadata.test.ts require() uses full .ts path — stripped path (without extension) fails Node CJS resolution even in Vitest"
  - "Partial unique indexes chosen over UNIQUE(clinic_id, agent_key, unit_id): PostgreSQL treats NULLs as distinct, making plain UNIQUE unable to deduplicate unit_id=NULL rows"
metrics:
  duration_minutes: 75
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 3
  completed_date: "2026-06-14"
---

# Phase 07 Plan 03: RBAC Matrix, ICP Reader & Config Migrations Summary

11-role x 7-module MODULE_PERMISSIONS matrix (Research Pattern 3 verbatim) with most-specific route resolution and x-read-only header forwarding in proxy.ts; server-only node-forge PKCS12 metadata extractor for ICP-Brasil A1 certificates; and SQL migrations for the certificates metadata table (private Storage bucket) and ai_agent_config (autonomy L0-L4 with partial unique indexes).

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | MODULE_PERMISSIONS matrix + isReadOnly + x-read-only in proxy.ts | 7c1f885 | src/proxy.ts |
| 2 | node-forge pfx metadata extractor + test infrastructure | 6e6a677 | src/lib/icp/pfx-metadata.ts, src/__tests__/icp/pfx-metadata.test.ts, vitest.config.ts, __mocks__/server-only.js, src/__tests__/setup.ts |
| 3 | certificates + ai_agent_config migrations | 62a920a | supabase/migrations/20260614000500_certificates.sql, supabase/migrations/20260614000600_ai_agent_config.sql |

---

## Verification

- `npx vitest run src/__tests__/rbac/matrix.test.ts` → 23 PASS (GREEN)
- `npx vitest run src/__tests__/proxy/rbac.test.ts` → 25 PASS (GREEN — no regression)
- `npx vitest run src/__tests__/icp/pfx-metadata.test.ts` → 15 PASS (GREEN)
- `npx vitest run src/__tests__/migrations/phase7.test.ts` → 48 PASS (GREEN — all Plan 02 + Plan 03 targets)
- Full suite combined: **111 tests across 4 files, all GREEN**
- `npx tsc --noEmit` → exit 0 (clean)
- Confirmed: `isReadOnly('auditor', '/clinica/financeiro') === true`
- Confirmed: `isReadOnly('socio', '/clinica/financeiro') === true`
- Confirmed: `isReadOnly('socio', '/bi') === true`
- Confirmed: `isPathAllowed('ti', '/config') === true`
- Confirmed: `isPathAllowed('dentist', '/bi') === false`
- Confirmed: extractPfxMetadata extracts subject_cn='FYNXIA Teste', thumbprint_sha1 (40-char hex), Date objects, cnpj=null (synthetic cert)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] node-forge cert.toAsn1() is not a function**
- **Found during:** Task 2 — first test run of pfx-metadata.test.ts
- **Issue:** Research Pattern 4 used `cert.toAsn1()` but node-forge 1.4.0 cert objects (returned from certBag.cert) do not have a `toAsn1()` method. The correct API is `forge.pki.certificateToAsn1(cert)`.
- **Fix:** Updated `pfx-metadata.ts` to use `forge.pki.certificateToAsn1(cert)` for thumbprint computation.
- **Files modified:** src/lib/icp/pfx-metadata.ts
- **Commit:** 6e6a677

**2. [Rule 1 - Bug] forge.pki.oids.certBag typed string|undefined causes TS2322**
- **Found during:** Task 2 — `npx tsc --noEmit` after writing pfx-metadata.ts
- **Issue:** TypeScript types for node-forge type `forge.pki.oids.certBag` as `string | undefined`, so assigning it directly to `const certBagOid: string` failed.
- **Fix:** Changed to `const CERT_BAG_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'` (literal fallback for the well-known OID).
- **Files modified:** src/lib/icp/pfx-metadata.ts
- **Commit:** 6e6a677

**3. [Rule 1 - Bug] vi.mock('server-only') does not intercept CJS require() calls**
- **Found during:** Task 2 — pfx-metadata.test.ts getExtractFn() returned undefined
- **Issue:** Plan 01's test scaffold used `require(PFX_MODULE_PATH.replace(/\.ts$/, ''))`. Two sub-issues: (a) `vi.mock('server-only', ...)` only mocks ESM imports, not CJS `require()`, causing `server-only` to throw when pfx-metadata.ts is loaded via `require()`; (b) stripping `.ts` from the path makes Node's CJS resolver unable to find the file.
- **Fix:**
  - Added `__mocks__/server-only.js` (empty module) for manual mock
  - Added `src/__tests__/setup.ts` that pre-registers server-only as a no-op in `require.cache` before tests run
  - Registered `setupFiles: ['src/__tests__/setup.ts']` in `vitest.config.ts`
  - Fixed `pfx-metadata.test.ts` `getExtractFn` to use `require(PFX_MODULE_PATH)` (full `.ts` path) instead of stripped path — Vitest's Node runtime transforms `.ts` files but only when the extension is explicit
  - Fixed `src/__tests__/setup.ts` cast from `as NodeJS.Module` to `as unknown as NodeJS.Module` (TS2352)
- **Files modified:** src/__tests__/icp/pfx-metadata.test.ts, vitest.config.ts; created __mocks__/server-only.js, src/__tests__/setup.ts
- **Commit:** 6e6a677

---

## Known Stubs

None — this plan creates infrastructure (proxy matrix, SQL migrations, server-only extractor). No UI components or data flows wired yet. Migration files are ready for Plan 04 db push.

---

## Threat Flags

All mitigations from the plan's threat model applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-07-08 (read-only mutation via Server Action POST) | x-read-only header set per routeToModule() most-specific resolution; assertNotReadOnly() (Plan 01) gates mutations |
| T-07-09 (.pfx exfiltration) | icp-certificates bucket public=false; service-role only; cert_password_enc AES-256-GCM; storage_path never exposed via public URL |
| T-07-10 (forged x-user-role) | proxy re-reads role from public.users each request (unchanged from v1) |
| T-07-11 (malicious cert subject injection) | metadata treated as display-only; Plan 06 uses parameterized inserts |
| T-07-12 (non-admin raising autonomy) | ai_agent_config write RLS restricted to admin/superadmin + tenant scope |

---

## Self-Check

| Check | Result |
|-------|--------|
| src/proxy.ts contains MODULE_PERMISSIONS | FOUND |
| src/proxy.ts contains isReadOnly | FOUND |
| src/proxy.ts contains x-read-only | FOUND |
| src/proxy.ts contains NETWORK_ROLES | FOUND |
| src/proxy.ts contains financeiro | FOUND |
| src/proxy.ts contains bi | FOUND |
| src/lib/icp/pfx-metadata.ts exists | FOUND |
| src/lib/icp/pfx-metadata.ts contains import 'server-only' | FOUND |
| src/lib/icp/pfx-metadata.ts contains extractPfxMetadata | FOUND |
| src/lib/icp/pfx-metadata.ts contains pkcs12 | FOUND |
| src/lib/icp/pfx-metadata.ts contains 2.16.76.1.3.3 | FOUND |
| supabase/migrations/20260614000500_certificates.sql | FOUND |
| supabase/migrations/20260614000500 contains icp-certificates | FOUND |
| supabase/migrations/20260614000500 contains cert_password_enc | FOUND |
| supabase/migrations/20260614000500 contains thumbprint_sha1 | FOUND |
| supabase/migrations/20260614000500 contains storage_path | FOUND |
| supabase/migrations/20260614000500 contains public=false | FOUND |
| supabase/migrations/20260614000600_ai_agent_config.sql | FOUND |
| supabase/migrations/20260614000600 contains autonomy_level | FOUND |
| supabase/migrations/20260614000600 contains L0..L4 CHECK | FOUND |
| supabase/migrations/20260614000600 contains WHERE unit_id IS NULL | FOUND |
| supabase/migrations/20260614000600 contains WHERE unit_id IS NOT NULL | FOUND |
| supabase/migrations/20260614000600 has NO plain UNIQUE(clinic_id,agent_key,unit_id) | CONFIRMED |
| commit 7c1f885 | FOUND |
| commit 6e6a677 | FOUND |
| commit 62a920a | FOUND |

## Self-Check: PASSED
