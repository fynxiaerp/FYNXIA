---
phase: 08-documentos-assinatura-icp-brasil
plan: 01
subsystem: testing
tags: [vitest, node-forge, icp-brasil, tdd, source-inspection, pfx, rsa, template-engine, react-pdf]

requires:
  - phase: 07-sistema-multiunidade-pap-is
    provides: test-cert.pfx fixture, node-forge 1.4.0 installed, vitest infra (setup.ts + server-only mock), pfx-metadata.ts PFX load pattern

provides:
  - Five Wave 0 RED test files locking Phase 8 implementation contracts
  - Real RSA sign→verify round-trip test (GREEN) pinning the exact algorithm Plan 02 must match
  - Template engine behavior tests (RED) encoding fillTemplate + detectVariables contracts
  - Migration source-inspection tests (RED) encoding document_tables/rls/bucket SQL shape
  - Server Action source-inspection tests (RED) encoding document-templates.ts + documents.ts structure
  - DocumentoPDF source-inspection tests (RED) encoding Flexbox/Font.register/signatureBlock contract

affects:
  - 08-02: sign-document.ts, template-engine.ts, migrations, actions, DocumentoPDF must satisfy these tests
  - 12-receituario: reuses document engine tested here
  - 15-nfse: reuses document engine tested here

tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD: source-inspection tests read target files via readFileSync at runtime (not static import) so tsc stays green while targets don't exist"
    - "Crypto contract pinning: sign→verify test directly exercises node-forge 1.4.0 API; Plan 02 must reproduce identical output"
    - "ES2017-safe regex: dotAll flag (s) unsupported at target ES2017; replaced with split(';') + per-statement test for multi-line SQL assertions"
    - "rsa.PublicKey cast: cert.publicKey typed as PublicKey (union); cast to forge.pki.rsa.PublicKey to access .verify()"

key-files:
  created:
    - src/__tests__/icp/sign-document.test.ts
    - src/__tests__/documents/template-engine.test.ts
    - src/__tests__/migrations/phase8.test.ts
    - src/__tests__/documents/actions.test.ts
    - src/__tests__/pdf/documento.test.ts
  modified: []

key-decisions:
  - "sign-document.test.ts directly exercises node-forge (no import of Plan 02 code) to lock the algorithm before implementation"
  - "Source-inspection via readFileSync (not static import) keeps tsc --noEmit exit 0 for files that don't exist yet"
  - "Replaced dotAll regex /pattern/s with split(';') per-statement testing to satisfy ES2017 tsc target"
  - "forge.pki.rsa.PublicKey cast required for .verify() call — forge types PublicKey as union without .verify()"

patterns-established:
  - "Wave 0 scaffold: crypto round-trip test GREEN immediately; source-inspection tests RED by design"
  - "Migration glob helper M(suffix): finds migration by suffix to survive timestamp prefix changes"

requirements-completed: [DOC-01, DOC-02, DOC-03]

duration: 10min
completed: 2026-06-14
---

# Phase 08 Plan 01: Wave 0 RED Test Scaffolds Summary

**Five vitest files lock Phase 8 contracts: real node-forge RSA sign+verify GREEN against test-cert.pfx, four source-inspection scaffolds RED until Plan 02 delivers migrations/actions/PDF/template-engine**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-14T14:00:00Z
- **Completed:** 2026-06-14T14:07:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `sign-document.test.ts` passes immediately (2 tests GREEN): pins 344-char RSA signature, verify=true, 40-char SHA-1 thumbprint, Node/forge SHA-256 consistency — all contracts Plan 02 must reproduce
- Four source-inspection scaffolds (template-engine, migrations, actions, documento) are RED-by-design with clear failure messages pointing to missing Plan 02 targets
- `npx tsc --noEmit` exits 0 across all five new test files (ES2017-safe regex, proper forge type casts)

## Task Commits

1. **Task 1: Crypto sign→verify test (GREEN) + template-engine test (RED)** - `e9ba6d7` (test)
2. **Task 2: Source-inspection RED scaffolds (migrations, actions, PDF)** - `7fbe711` (test)

## Files Created/Modified

- `src/__tests__/icp/sign-document.test.ts` - Real RSA round-trip + SHA-256 consistency (GREEN)
- `src/__tests__/documents/template-engine.test.ts` - fillTemplate + detectVariables behavior (RED)
- `src/__tests__/migrations/phase8.test.ts` - document_tables/rls/bucket SQL shape assertions (RED)
- `src/__tests__/documents/actions.test.ts` - document-templates.ts + documents.ts structure assertions (RED)
- `src/__tests__/pdf/documento.test.ts` - DocumentoPDF Flexbox/Font.register/signatureBlock assertions (RED)

## Decisions Made

- Used `readFileSync` (not static `import`) for all source-inspection targets so `tsc --noEmit` stays green when target files don't exist — vitest fails at test runtime with a clear "file not found" message instead of a compile-time error
- `@ts-expect-error not-yet-implemented` on the template-engine import (static ESM import required for behavior testing); other four use readFileSync only
- Replaced `/pattern/is` (dotAll) regex with `sql.split(';').some(s => ...)` per-statement checks because tsconfig `target: "ES2017"` does not support the `s` flag
- Cast `cert.publicKey` to `forge.pki.rsa.PublicKey` to access `.verify()` — node-forge types `PublicKey` as a union that doesn't expose `.verify()` on the base type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tsc error on forge PublicKey.verify() call**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** `forge.pki.Certificate.publicKey` is typed as `PublicKey` (union) which does not expose `.verify()` — tsc error TS2339
- **Fix:** Cast to `forge.pki.rsa.PublicKey` before calling `.verify()`
- **Files modified:** `src/__tests__/icp/sign-document.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `7fbe711` (Task 2 commit)

**2. [Rule 1 - Bug] Replaced ES2018 dotAll regex flag with ES2017-compatible alternative**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** `/pattern/is` uses the `s` (dotAll) flag, not available at `target: "ES2017"` — tsc error TS1501 on two assertions
- **Fix:** Replaced with `sql.split(';').some(s => /ON\s+public\.document_versions/i.test(s) && /FOR UPDATE/i.test(s))` per-statement logic
- **Files modified:** `src/__tests__/migrations/phase8.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; semantic equivalence preserved
- **Committed in:** `7fbe711` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug; tsc compliance)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No behavior or scope change.

## Issues Encountered

None beyond the two tsc errors fixed above.

## Known Stubs

None — these are test files only; no production code stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only.

## Next Phase Readiness

- Wave 0 RED scaffolds complete; Plan 02 has a fixed target with no interpretation
- Plan 02 must make all 5 files pass: implement `src/lib/documents/template-engine.ts`, write three migrations (`_document_tables.sql`, `_document_rls.sql`, `_documents_bucket.sql`), write `src/actions/document-templates.ts` + `src/actions/documents.ts`, and create `src/components/pdf/DocumentoPDF.tsx`
- No blockers

---
*Phase: 08-documentos-assinatura-icp-brasil*
*Completed: 2026-06-14*
