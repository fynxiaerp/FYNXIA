---
phase: "07"
plan: "01"
subsystem: foundation
tags: [node-forge, test-scaffold, rbac, guards, icp, tdd-red]
dependency_graph:
  requires: []
  provides:
    - node-forge@1.4.0 (PKCS12 parser for Plan 03)
    - src/lib/auth/guards.ts (assertNotReadOnly guard for Plans 05/06)
    - src/__tests__/migrations/phase7.test.ts (migration contracts for Plans 02/03)
    - src/__tests__/rbac/matrix.test.ts (RBAC contracts for Plan 03)
    - src/__tests__/icp/pfx-metadata.test.ts (cert extractor contracts for Plan 03)
    - src/__tests__/icp/fixtures/test-cert.pfx (PKCS12 fixture for Plan 03)
  affects:
    - src/proxy.ts (Plan 03 extends it with MODULE_PERMISSIONS + isReadOnly)
    - supabase/migrations/ (Plans 02/03 turn migration tests GREEN)
    - src/lib/icp/pfx-metadata.ts (Plan 03 turns pfx-metadata tests GREEN)
tech_stack:
  added:
    - node-forge@1.4.0 (production dep — pure-JS PKCS12/ASN.1 parser)
    - "@types/node-forge@1.3.14 (devDep — TypeScript types)"
  patterns:
    - source-inspection test style (readFileSync + toMatch on SQL/TS files)
    - server-only guard module with async headers() pattern (Next.js 15)
    - RED-by-design TDD scaffolds with tsc-clean dynamic require
key_files:
  created:
    - src/lib/auth/guards.ts
    - src/__tests__/migrations/phase7.test.ts
    - src/__tests__/rbac/matrix.test.ts
    - src/__tests__/icp/pfx-metadata.test.ts
    - src/__tests__/icp/fixtures/test-cert.pfx
  modified:
    - package.json (node-forge + @types/node-forge added)
    - package-lock.json
decisions:
  - "Source-inspection test style chosen for all Phase 7 scaffolds to keep tsc GREEN while targets don't exist yet"
  - "pfx-metadata test uses dynamic require() (not static import) to avoid TS2307 on non-existent module"
  - "matrix.test.ts imports isPathAllowed statically (exists) but uses readFileSync for MODULE_PERMISSIONS/isReadOnly (Plan 03 targets)"
  - "assertNotReadOnly() is async to correctly await headers() in Next.js 15"
metrics:
  duration_minutes: 64
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 2
  completed_date: "2026-06-14"
---

# Phase 07 Plan 01: Wave 0 Foundation — Dependencies, Guard & Test Scaffolds Summary

Wave 0 foundation for Phase 7: installed node-forge 1.4.0, created server-only assertNotReadOnly() mutation guard, and wrote three RED source-inspection test scaffolds (migrations, RBAC matrix, ICP cert extractor) plus a synthetic PKCS12 fixture — establishing all test contracts before the implementation waves begin.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install node-forge dependency | b3a9c3b | package.json, package-lock.json |
| 2 | Create assertNotReadOnly() server guard | c2e20ad | src/lib/auth/guards.ts |
| 3 | Write RED test scaffolds — migrations + RBAC matrix | 6d5e960 | src/__tests__/migrations/phase7.test.ts, src/__tests__/rbac/matrix.test.ts |
| 4 | Generate .pfx fixture + RED pfx-metadata test | 50d15df | src/__tests__/icp/pfx-metadata.test.ts, src/__tests__/icp/fixtures/test-cert.pfx |

---

## Verification

- `npm ls node-forge` → `node-forge@1.4.0` (resolved)
- `npx tsc --noEmit` → exit 0 (clean after all 4 tasks)
- `npx vitest run src/__tests__/migrations/phase7.test.ts` → 48 FAIL (RED — migration files not written yet) ✓
- `npx vitest run src/__tests__/rbac/matrix.test.ts` → 12 FAIL / 11 PASS (RED — MODULE_PERMISSIONS/isReadOnly not in proxy.ts yet; guards.ts assertions pass) ✓
- `npx vitest run src/__tests__/icp/pfx-metadata.test.ts` → 12 FAIL / 3 PASS (RED — pfx-metadata.ts not written yet; fixture existence passes) ✓
- `src/__tests__/icp/fixtures/test-cert.pfx` → 2579 bytes, valid PKCS12 DER (0x30 header) ✓

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored matrix.test.ts to avoid static import of non-existent exports**
- **Found during:** Task 3 — `npx tsc --noEmit` failed with TS2305 after first draft
- **Issue:** First draft statically imported `MODULE_PERMISSIONS` and `isReadOnly` from `@/proxy` which don't exist yet; this caused tsc errors, violating the "tsc stays GREEN" contract
- **Fix:** Rewrote matrix.test.ts to use `readFileSync` (source-inspection) for the Plan 03 targets; only `isPathAllowed` (which already exists) is imported statically
- **Files modified:** src/__tests__/rbac/matrix.test.ts
- **Commit:** 6d5e960

**2. [Rule 1 - Bug] Refactored pfx-metadata.test.ts to avoid beforeAll import error and dynamic import TS error**
- **Found during:** Task 4 — `npx tsc --noEmit` failed with TS2304 (beforeAll not imported) and TS2307 (module not found)
- **Issue:** First draft used `beforeAll` without importing from vitest and used `await import('@/lib/icp/pfx-metadata')` which tsc resolves statically
- **Fix:** Removed beforeAll/dynamic import; used `require()` inside a helper function (runtime-only, not checked by tsc); source-inspection handles module existence checks
- **Files modified:** src/__tests__/icp/pfx-metadata.test.ts
- **Commit:** 50d15df

---

## Known Stubs

None — this plan creates test scaffolds and a guard helper, not UI components or data flows.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The synthetic .pfx fixture is a throwaway self-signed cert (T-07-02: accepted per threat model).

---

## Self-Check

Checking that all claimed artifacts exist and commits are present.

| Check | Result |
|-------|--------|
| src/lib/auth/guards.ts | FOUND |
| src/__tests__/migrations/phase7.test.ts | FOUND |
| src/__tests__/rbac/matrix.test.ts | FOUND |
| src/__tests__/icp/pfx-metadata.test.ts | FOUND |
| src/__tests__/icp/fixtures/test-cert.pfx | FOUND |
| commit b3a9c3b | FOUND |
| commit c2e20ad | FOUND |
| commit 6d5e960 | FOUND |
| commit 50d15df | FOUND |

## Self-Check: PASSED
