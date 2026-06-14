---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "01"
subsystem: wave-0-test-scaffolds
tags: [ai, governance, audit, ocr, testing, wave-0]
dependency_graph:
  requires: []
  provides:
    - src/__tests__/migrations/phase10.test.ts
    - src/__tests__/governance/policy.test.ts
    - src/__tests__/governance/approvals.test.ts
    - src/__tests__/audit/audit-ui.test.ts
    - src/__tests__/audit/estorno.test.ts
    - src/__tests__/ocr/extract.test.ts
  affects:
    - Plans 02-05 (all must satisfy these scaffold assertions to turn GREEN)
tech_stack:
  added: []
  patterns:
    - source-inspection (readFileSync/existsSync/SRC — mirrors phase8 + connectors convention)
    - pure-unit assertions with existsSync dynamic-import guard (tsc-clean on missing modules)
    - vi.mock('server-only', () => ({})) ESM mock pattern
key_files:
  created:
    - src/__tests__/migrations/phase10.test.ts
    - src/__tests__/governance/policy.test.ts
    - src/__tests__/governance/approvals.test.ts
    - src/__tests__/audit/audit-ui.test.ts
    - src/__tests__/audit/estorno.test.ts
    - src/__tests__/ocr/extract.test.ts
  modified: []
decisions:
  - "Used existsSync + absolute-path dynamic import (not @-alias) for all pure-unit tests on missing modules — avoids TS2307 and keeps tsc exit 0 (D-144 pattern)"
  - "Dropped /is regex flags (dotAll) in approvals.test.ts — tsconfig target ES2017 does not support the s flag; rewrote as separate pattern checks"
  - "Regression guards for tools.ts + confirmation-agent.ts + collection-agent.ts added to policy.test.ts — verifies Plan 03 wrap is additive, not destructive"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-14T19:28:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 10 Plan 01: Wave 0 RED Test Scaffolds Summary

**One-liner:** 6 source-inspection + pure-unit RED scaffolds covering all 8 Phase 10 requirements (AIG/AUD/OCR) using existsSync dynamic-import guards to keep tsc clean while target artifacts don't yet exist.

## What Was Built

Six test scaffold files under `src/__tests__/{migrations,governance,audit,ocr}/` covering the three Phase 10 governance subsystems. All tests are RED by design — they assert artifacts that Plans 02–05 will create, with zero import crashes (the Wave 0 contract).

### File Summary

| File | Requirements | Tests | Status |
|------|-------------|-------|--------|
| `migrations/phase10.test.ts` | AIG-03, AIG-02, OCR-02, AUD-01/03 | 34 | RED (migration files absent) |
| `governance/policy.test.ts` | AIG-01, AIG-03, T-10-03 | 17 | RED (policy.ts absent) |
| `governance/approvals.test.ts` | AIG-02, AUD-02, AUD-03, T-10-04 | 21 | RED (approval-actions.ts + proxy conformidade absent) |
| `audit/audit-ui.test.ts` | AUD-01, AUD-03 | 12 | RED (audit-actions.ts + auditoria page absent) |
| `audit/estorno.test.ts` | AUD-02 | 9 | RED (createEstorno absent) |
| `ocr/extract.test.ts` | OCR-01, OCR-02, T-10-02 | 16 | RED (ocr-confidence.ts + ocr route absent) |
| **Total** | AIG-01..03, AUD-01..03, OCR-01..02 | **109** | **8 pass (regression guards), 101 RED by design** |

### Assertion Contracts Encoded

- `phase10.test.ts`: ai_decision_log immutability (no client INSERT/UPDATE/DELETE policy — T-10-01), approval_requests idempotency_key UNIQUE WHERE partial index, ocr_extractions deleted_at (LGPD soft-delete), audit_logs IF NOT EXISTS index guards
- `policy.test.ts`: computePolicyDecision L0→suggest, L1+safe→execute, L2+sensitive→pending_approval, L4→execute, unknown→block; withAgentPolicy imports 'server-only' (T-10-03)
- `approvals.test.ts`: assertNotReadOnly + idempotency + executed_at + status guard + logBusinessEvent; canApprove alçada (admin yes, receptionist no); proxy.ts conformidade ModuleKey + readOnly roles
- `audit-ui.test.ts`: queryAuditLogs with table_name/actor_id/gte/lte/range; auditoria page is RSC (no 'use client'), renders old_values + new_values
- `estorno.test.ts`: createEstorno references reason + approval_requests type='estorno' + required_role + assertNotReadOnly; canApprove estorno scenario
- `extract.test.ts`: needsReview(fields) at threshold 0.80 (default), custom threshold; route has runtime='nodejs', generateObject, type:'file' (FilePart), zeroDataRetention:true, ocr_extractions, 'pending_review', maskCPF (T-10-02)

## Verification

- `npx vitest run src/__tests__/{migrations,governance,audit,ocr}/`: 6 files run, 8 pass (regression guards), 101 RED by design — no import crashes
- `npx tsc --noEmit`: exit 0 (clean) — existsSync guards prevent TS2307 on absent modules
- `npx vitest run src/__tests__/ai/ src/__tests__/proxy/`: 74 tests still pass (regression clean)

## Commits

| Hash | Message |
|------|---------|
| `70556a8` | test(10-01): Wave 0 RED scaffolds — migrations/phase10, governance/policy, governance/approvals |
| `40fa509` | test(10-01): Wave 0 RED scaffolds — audit/audit-ui, audit/estorno, ocr/extract |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dropped ES2018 regex `s` flag incompatible with tsconfig target**
- **Found during:** Task 1 — `npx tsc --noEmit` after creating approvals.test.ts
- **Issue:** `/pattern/is` (dotAll `s` flag) triggered TS1501 — tsconfig target is ES2017 which predates the dotAll flag
- **Fix:** Replaced multiline `/auditor.*conformidade/is` patterns with separate single-line regex checks (`expect(src).toMatch(/auditor/)` + `expect(src).toMatch(/conformidade/)`) — equivalent assertion coverage without cross-line dot matching
- **Files modified:** `src/__tests__/governance/approvals.test.ts`
- **Commit:** Included in `70556a8`

## Known Stubs

None — Wave 0 only creates test scaffolds. No application code was created or modified.

## Threat Flags

None — test files only read source (no privilege boundary crossed; no new network endpoints).

## Self-Check: PASSED

- [x] `src/__tests__/migrations/phase10.test.ts` — exists, committed in 70556a8
- [x] `src/__tests__/governance/policy.test.ts` — exists, committed in 70556a8
- [x] `src/__tests__/governance/approvals.test.ts` — exists, committed in 70556a8
- [x] `src/__tests__/audit/audit-ui.test.ts` — exists, committed in 40fa509
- [x] `src/__tests__/audit/estorno.test.ts` — exists, committed in 40fa509
- [x] `src/__tests__/ocr/extract.test.ts` — exists, committed in 40fa509
- [x] tsc exit 0
- [x] All 6 scaffolds run without import crashes
- [x] Existing ai/ + proxy/ tests unchanged (74 pass)
