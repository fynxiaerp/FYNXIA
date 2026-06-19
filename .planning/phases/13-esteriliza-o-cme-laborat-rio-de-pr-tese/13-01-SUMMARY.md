---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: "01"
subsystem: esterilizacao-cme + protese
tags: [tests, red, scaffold, tdd, esterilizacao, protese, migration, regression-guard]
dependency_graph:
  requires: []
  provides:
    - RED test contracts for cycle-status derivation (Plan 02 turns GREEN)
    - RED test contracts for isCycleUsable block guard — CME-02 patient-safety (Plan 04 turns GREEN)
    - RED test contracts for lab-cost helper (Plan 03 turns GREEN)
    - Migration source-inspection asserts for CME migrations (Plan 02 turns GREEN)
    - Migration source-inspection asserts for LAB migrations (Plan 03 turns GREEN)
    - Regression guard locking appointments GIST + financial_transactions (always GREEN)
  affects:
    - src/__tests__/esterilizacao/
    - src/__tests__/protese/
tech_stack:
  added: []
  patterns:
    - absolute-path dynamic import + existsSync guard (D-144 compliance — tsc stays at exit 0)
    - it.skipIf(!has) pattern for pure-logic scaffolds
    - it.skipIf(files.length === 0) pattern for migration source-inspection
    - Regression guard always-runs on empty string (passes vacuously)
key_files:
  created:
    - src/__tests__/esterilizacao/cycle-status.test.ts
    - src/__tests__/esterilizacao/kit-block-guard.test.ts
    - src/__tests__/esterilizacao/migrations-phase13-cme.test.ts
    - src/__tests__/esterilizacao/regression-guard-phase13.test.ts
    - src/__tests__/protese/lab-cost.test.ts
    - src/__tests__/protese/migrations-phase13-lab.test.ts
  modified: []
decisions:
  - "absolute-path via path.resolve(process.cwd(), ...) — NOT hardcoded string, NOT @-alias; D-144 compliance"
  - "it.skipIf(!has) for pure-logic tests; it.skipIf(files.length === 0) for migration tests"
  - "Regression guard uses Phase 13 prefix filter (20260619000*) — only Phase 13 migrations scanned"
  - "Regression guard always runs (empty string fails no not.toContain assertions)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 13 Plan 01: RED Scaffolds Summary

**One-liner:** Six RED test scaffolds for CME + Lab Prótese — pure-logic unit tests (cycle status, kit-block guard, lab-cost) and source-inspection migration tests with regression guard, all using absolute-path + existsSync (D-144) so tsc stays at exit 0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED pure-logic scaffolds — cycle-status, kit-block-guard, lab-cost | c2b709b | cycle-status.test.ts, kit-block-guard.test.ts, lab-cost.test.ts |
| 2 | RED migration source-inspection + regression guard scaffolds | 98d104f | migrations-phase13-cme.test.ts, migrations-phase13-lab.test.ts, regression-guard-phase13.test.ts |

## What Was Built

### Task 1 — Pure-logic RED Scaffolds

**cycle-status.test.ts** (4 cases, all skipped):
- `deriveCycleStatus` with aprovado + past validade → vencido
- aprovado + future validade → aprovado
- reprovado → reprovado
- pendente → pendente

**kit-block-guard.test.ts** (6 isCycleUsable cases + 2 purity assertions, all skipped):
- reprovado → usable=false, reason contains 'reprovado'
- pendente → usable=false, reason contains 'pendente'
- aprovado + past validade → usable=false, reason contains 'vencido'
- aprovado + validade === referenceDate → usable=true (boundary: expiry is `validade < hoje`)
- aprovado + future validade → usable=true
- aprovado + validade=null → usable=true (no expiry recorded)
- Source-inspection: target must NOT contain 'use server' or 'server-only'

**lab-cost.test.ts** (7 cases, all skipped):
- isCostPostable: 0→false, null→false, -5→false, 120.5→true
- buildLabExpenseDescription: includes orderNumber, prosthesisType, labName

### Task 2 — Migration Source-Inspection + Regression Guard

**migrations-phase13-cme.test.ts** (all skipIf files.length===0):
- sterilization_cycles: CREATE TABLE, autoclave_id, REFERENCES public.resources(id), biological_result CHECK (pendente/aprovado/reprovado), status CHECK (aprovado/reprovado/vencido), all parameter columns, clinic_id, unit_id, idx_sterilization_cycles_clinic
- kit_usages: CREATE TABLE, sterilization_cycle_id, appointment_id, patient_id, clinic_id, idx_kit_usages_cycle, idx_kit_usages_patient
- RLS: ENABLE ROW LEVEL SECURITY, USING, WITH CHECK

**migrations-phase13-lab.test.ts** (all skipIf files.length===0):
- prosthetic_labs: CREATE TABLE, clinic_id, nome, deleted_at, idx_prosthetic_labs_clinic
- lab_orders: CREATE TABLE, lab_id, REFERENCES public.prosthetic_labs(id), patient_id, appointment_id, prosthesis_type, due_date, stages, cost, status CHECK (enviado/prova/concluido), clinic_id, unit_id, deleted_at, all 3 indexes
- LAB-02: financial_transaction_id OR lab_order reference asserted
- RLS: ENABLE ROW LEVEL SECURITY, USING, WITH CHECK

**regression-guard-phase13.test.ts** (always runs — 5 passed):
- sql does NOT contain 'DROP CONSTRAINT no_overlap'
- sql does NOT contain 'ALTER TABLE public.appointments'
- sql does NOT contain 'DROP TABLE public.financial_transactions'
- sql does NOT contain 'ALTER TABLE public.financial_transactions DROP'
- sql does NOT contain 'ALTER COLUMN status'

## Verification Results

```
vitest run src/__tests__/esterilizacao/ src/__tests__/protese/
  Test Files: 1 passed | 5 skipped (6)
  Tests: 5 passed | 75 skipped (80)

tsc --noEmit: exit 0
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan produces only test scaffolds (RED by design). All 6 files exist and are complete contracts.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only.

## Self-Check: PASSED

- [x] src/__tests__/esterilizacao/cycle-status.test.ts — FOUND
- [x] src/__tests__/esterilizacao/kit-block-guard.test.ts — FOUND
- [x] src/__tests__/esterilizacao/migrations-phase13-cme.test.ts — FOUND
- [x] src/__tests__/esterilizacao/regression-guard-phase13.test.ts — FOUND
- [x] src/__tests__/protese/lab-cost.test.ts — FOUND
- [x] src/__tests__/protese/migrations-phase13-lab.test.ts — FOUND
- [x] commit c2b709b — FOUND
- [x] commit 98d104f — FOUND
