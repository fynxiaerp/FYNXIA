---
phase: 11-profissionais-recursos
plan: 01
subsystem: testing
tags: [professionals, resources, scheduling, realtime, testing, wave-0]
dependency_graph:
  requires: []
  provides: [test-contract-PRO-01, test-contract-PRO-02, test-contract-PRO-03, test-contract-RES-01, test-contract-RES-02, test-contract-RES-03, regression-guard-GIST]
  affects: [phase11-plans-02-08]
tech_stack:
  added: []
  patterns: [source-inspection-MM-SRC, pure-unit-existsSync-guard, absolute-path-dynamic-import, ES2017-no-dotAll]
key_files:
  created:
    - src/__tests__/migrations/phase11.test.ts
    - src/__tests__/professionals/professionals.test.ts
    - src/__tests__/professionals/availability.test.ts
    - src/__tests__/resources/resources.test.ts
    - src/__tests__/resources/waiting-room.test.ts
  modified: []
decisions:
  - MM() returns '' for missing migrations so new-artifact asserts are RED-on-content not crash-on-throw
  - existsSync guard + expect.fail() for dynamic imports — pure-unit tests skip cleanly when target absent
  - PRESENCE_FLOW array OR isValidPresenceTransition accepted in waiting-room.test.ts — flexible to Plan 03 implementation choice
  - Negation tests on LGPD (no cpf/full_name in panel) use guarded SRC — RED on initials/presence_status when file absent
  - Regression guard reads 20260605000100_clinical_tables.sql via M() (throws) not MM() — intentional; file must exist
metrics:
  duration: ~8 minutes
  completed: "2026-06-14"
  tasks: 2
  files_created: 5
  tests_total: 129
  tests_green: 14
  tests_red: 115
---

# Phase 11 Plan 01: Wave 0 RED Test Scaffolds Summary

**One-liner:** Wave 0 RED test scaffolds for all 6 Phase 11 requirements (PRO-01..03, RES-01..03) using source-inspection + pure-unit convention, with a REGRESSION GUARD locking the appointments EXCLUDE GIST and status CHECK as unchanged.

---

## What Was Built

5 test files under `src/__tests__/{migrations,professionals,resources}/` that encode the verification contract for Waves 1–4:

| File | Covers | Tests |
|------|--------|-------|
| `phase11.test.ts` | Migration inspection (6 migrations) + regression guard + proxy route | 55 (8 GREEN, 47 RED) |
| `professionals.test.ts` | Action source-inspection + commissionRules Zod unit (PRO-01, PRO-03) | 9 (1 GREEN, 8 RED) |
| `availability.test.ts` | isSlotWithinAvailability pure-unit + booking SRC + resource_id blocker-fix (PRO-02, RES-02) | 11 (0 GREEN, 11 RED) |
| `resources.test.ts` | Resources migration + isResourceAvailable pure-unit + action SRC (RES-01, RES-02) | 28 (2 GREEN, 26 RED) |
| `waiting-room.test.ts` | Presence columns + Realtime + waitingMinutes + PRESENCE_FLOW + checkin SRC + LGPD panel guard (RES-03) | 26 (3 GREEN, 23 RED) |

**Total: 129 tests — 14 GREEN (expected), 115 RED (Wave 0 intent).**

---

## Regression Guard (CRITICAL — GREEN now)

The `REGRESSION: appointments GIST + status CHECK unchanged` describe block in `phase11.test.ts` has **8 GREEN tests** that lock the existing `20260605000100_clinical_tables.sql`:

1. `CONSTRAINT no_overlap EXCLUDE USING GIST` still present
2. `tenant_id WITH =` in GIST clause
3. `dentist_id WITH =` in GIST clause
4. `WHERE (status NOT IN ('cancelado'))` GIST filter
5. All 5 original status values: `agendado`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`
6. No Phase 11 migration file drops `no_overlap` constraint
7. No Phase 11 migration alters `appointments.status` column type

These tests MUST remain GREEN throughout all Phase 11 waves. Any accidental GIST modification will immediately fail them.

---

## Test Design Decisions

### MM() vs M() for migration helpers
New Phase 11 migration files use `MM(suffix)` which returns `''` when the file is absent. Assertions on `''` produce clear `expected '' to match /pattern/` failures — no stack crash. The regression guard uses `M()` (throws) because `20260605000100_clinical_tables.sql` must always exist.

### Dynamic import with existsSync guard
All pure-unit tests (`isSlotWithinAvailability`, `isResourceAvailable`, `waitingMinutes`, `commissionRulesSchema`) use:
```typescript
const path = resolve(process.cwd(), 'src/lib/scheduling/availability.ts')
if (!existsSync(path)) {
  expect.fail('... does not exist yet — Plan 03 target')
}
const mod = await import(/* @vite-ignore */ path) as any
```
This pattern satisfies both:
- `npx tsc --noEmit` stays clean (no `@`-alias TS2307 on absent modules)
- Test suite runs without import crash (existsSync guards before `await import`)

### ES2017 dotAll constraint (D-163)
No `/is` or `/s` flag used anywhere. Multi-line SQL assertions use separate `.toMatch()` calls per pattern. Confirmed tsc exit 0.

### LGPD negation tests (T-11-02)
The `/painel/[clinic-slug]/page.tsx` file doesn't exist yet. The tests:
- `does NOT select cpf` → passes (empty string has no match)
- `does NOT select full_name directly` → passes
- `references presence_status` → FAILS RED (empty string)
- `uses initials transform` → FAILS RED

This is correct Wave 0 behavior: the safety guards pass immediately, the positive assertions will turn GREEN when Plan 08 creates the panel.

### RES-02 Blocker-fix (resource_id in appointment validator)
`availability.test.ts` includes the Plan 04 blocker-fix assertion:
```
appointment Zod schema has optional resource_id uuid field
resource_id is validated as a uuid
```
Both RED now (appointment.ts doesn't have `resource_id` yet). Turn GREEN when Plan 04 edits `src/lib/validators/appointment.ts`.

---

## Verification Results

```
npx vitest run src/__tests__/migrations/phase11.test.ts src/__tests__/professionals/ src/__tests__/resources/
Tests: 115 failed | 14 passed (129)
```

```
npx tsc --noEmit
(no output — exit 0)
```

```
npx vitest run src/__tests__/agenda/ src/__tests__/actions/ src/__tests__/proxy/
Tests: 96 passed (96)
```

All three criteria from the plan's acceptance criteria are met:
- Suite RUNS without import/parse crash ✓
- GIST regression guard block PASSES now ✓
- `npx tsc --noEmit` clean ✓
- Existing tests unaffected ✓

---

## Requirements Coverage

| Requirement | Covered By | Test Count |
|-------------|-----------|------------|
| PRO-01 | phase11.test.ts (migration inspection), professionals.test.ts (action SRC + backfill) | 22 |
| PRO-02 | availability.test.ts (pure-unit + SRC) | 7 |
| PRO-03 | professionals.test.ts (commissionRules Zod unit) | 4 |
| RES-01 | phase11.test.ts + resources.test.ts (migration + isResourceAvailable) | 20 |
| RES-02 | phase11.test.ts + resources.test.ts + availability.test.ts (FK + no-GIST + app-check + blocker-fix) | 8 |
| RES-03 | phase11.test.ts + waiting-room.test.ts (presence + realtime + panel) | 21 |

All 6 requirements have at least one assertion (plan success criterion met).

---

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Migration + professionals scaffolds | `28acd5b` | phase11.test.ts, professionals.test.ts, availability.test.ts |
| Task 2: Resources + waiting-room scaffolds | `50816ec` | resources.test.ts, waiting-room.test.ts |

---

## Deviations from Plan

None — plan executed exactly as written.

The PRESENCE_FLOW vs `isValidPresenceTransition` flexible acceptance in `waiting-room.test.ts` is intentional implementation flexibility for Plan 03, not a deviation from the plan spec.

---

## Known Stubs

None — this plan creates test files only. No implementation stubs introduced.

---

## Threat Flags

None — test files only read source code. No new network endpoints, auth paths, or schema changes introduced.

---

## Self-Check: PASSED

Files created:
- `src/__tests__/migrations/phase11.test.ts` — FOUND
- `src/__tests__/professionals/professionals.test.ts` — FOUND
- `src/__tests__/professionals/availability.test.ts` — FOUND
- `src/__tests__/resources/resources.test.ts` — FOUND
- `src/__tests__/resources/waiting-room.test.ts` — FOUND

Commits verified:
- `28acd5b` — FOUND (test(11-01): Wave 0 RED scaffolds — migrations + professionals)
- `50816ec` — FOUND (test(11-01): Wave 0 RED scaffolds — resources + waiting-room)
