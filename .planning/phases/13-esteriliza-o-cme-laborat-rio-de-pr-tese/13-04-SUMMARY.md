---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: "04"
subsystem: esterilizacao-cme + protese-lab
tags: [esterilizacao, cme, protese, server-actions, block-guard, financial, audit, patient-safety, tdd]
dependency_graph:
  requires:
    - 13-02 (cycle-status lib + sterilization_cycles + kit_usages tables + Zod schemas)
    - 13-03 (prosthetic_labs + lab_orders tables + lab-cost helpers + Zod schemas)
  provides:
    - src/actions/sterilization.ts (registerSterilizationCycle, updateBiologicalResult, registerKitUsage BLOCK GUARD, listSterilizationCycles, getKitTraceability)
    - src/actions/lab-orders.ts (createLab, updateLab, createLabOrder, setLabOrderCost, updateLabOrderStatus, listLabOrders, listLabs)
    - CME-02 patient-safety block guard (server-side, cannot be bypassed by client/race)
    - LAB-02 financial despesa posting (financial_transactions insert + financial_transaction_id backfill)
  affects:
    - src/actions/
    - src/__tests__/esterilizacao/
    - src/__tests__/protese/
tech_stack:
  added: []
  patterns:
    - getActor + assertNotReadOnly + role gate + tenant scope + logBusinessEvent (mirrors resources.ts exactly)
    - Pre-push type cast: SupabaseClient<any> idiom (mirrors clinical-documents.ts) for new Phase 13 tables before Plan 05 type regen
    - TDD source-inspection: readFileSync assertions validate guard ordering (isCycleUsable before kit_usages insert) and financial schema (tenant_id on financial_transactions)
    - Double-post idempotency guard: re-fetch financial_transaction_id before inserting despesa
    - COST_ROLES=['admin','superadmin'] matches financial_transactions write RLS
key_files:
  created:
    - src/actions/sterilization.ts
    - src/actions/lab-orders.ts
    - src/__tests__/esterilizacao/sterilization-action.test.ts
    - src/__tests__/protese/lab-order-action.test.ts
  modified: []
decisions:
  - "COST_ROLES=['admin','superadmin'] only (not dentist) — matches financial_transactions admin-write RLS; dentists can create/update orders but cannot post financials"
  - "financial_transactions uses tenant_id (NOT clinic_id) — per 20260606000100_financial_tables.sql schema; lab_orders/prosthetic_labs use clinic_id"
  - "Kit-usage block guard (CME-02) lives in the Server Action (not only UI): re-fetches cycle at use-time, runs isCycleUsable against fresh row + server today — TOCTOU mitigation"
  - "Double-post idempotency guard: setLabOrderCost re-fetches lab_orders.financial_transaction_id and returns 'já lançado' error if already set — prevents duplicate despesa (T-13-15)"
  - "Pre-push cast idiom (SupabaseClient<any>): Phase 13 tables absent from database.types.ts until Plan 05 pushes; cast keeps tsc --noEmit clean"
  - "postLabExpense private helper shared by createLabOrder (at-creation posting) and setLabOrderCost (post-hoc posting) — single code path for LAB-02 despesa logic"
  - "financial_categories: resolve lab/prótese despesa category via ILIKE '%laborat%'; leave category_id null if none found (D-04 — never create categories here)"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
requirements: [CME-01, CME-02, CME-03, LAB-01, LAB-02]
---

# Phase 13 Plan 04: CME + LAB Server Actions Summary

**One-liner:** CME server actions with patient-safety kit-usage block guard (CME-02: server-side re-fetch + isCycleUsable BEFORE insert, TOCTOU-proof) and LAB server actions with financial despesa posting (LAB-02: financial_transactions tenant_id insert + financial_transaction_id backfill) and double-post idempotency guard — 109 tests GREEN, tsc clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | sterilization.ts — register cycle + bio result + kit-usage block guard + traceability | 033ad96 | src/actions/sterilization.ts, src/__tests__/esterilizacao/sterilization-action.test.ts |
| 2 | lab-orders.ts — lab CRUD + OS + setLabOrderCost financial posting + status | d588e81 | src/actions/lab-orders.ts, src/__tests__/protese/lab-order-action.test.ts |

## What Was Built

### Task 1 — sterilization.ts (CME-01/CME-02/CME-03)

**registerSterilizationCycle** (CME-01):
- Zod-validates via `sterilizationCycleSchema`
- Computes status snapshot via `deriveCycleStatus({ biologicalResult, validade })`
- Inserts into `sterilization_cycles` with `clinic_id = actor.tenant_id`
- Logs `sterilization.cycle.registered` (IDs only — LGPD)

**updateBiologicalResult**:
- Re-fetches the cycle's `validade` (tenant-scoped) for accurate status recomputation
- Updates `biological_result` + recomputed `status` + `updated_at`
- Logs `sterilization.biological.updated`

**registerKitUsage — PATIENT-SAFETY BLOCK GUARD (CME-02)**:
- `assertNotReadOnly()` + TEAM_ROLES gate
- Zod-validates via `kitUsageSchema`
- **Re-fetches the sterilization cycle SERVER-SIDE** (T-13-12: cannot be bypassed by direct call, stale UI, or race)
- Runs `isCycleUsable({ biologicalResult, validade })` against the FRESHLY-READ row with server `today` (T-13-13: TOCTOU mitigation)
- **If `!check.usable` → returns `{ success:false, blocked:true, error: reason }` and DOES NOT insert** — the block is authoritative
- On success: inserts `kit_usages` with `clinic_id = actor.tenant_id` + logs `kit.usage.registered`

**listSterilizationCycles**: read-only tenant-scoped list, ordered by `cycle_date DESC`.

**getKitTraceability(params)**: returns `kit_usages` joined to `sterilization_cycles` for lote→patient traceability (CME-03), filterable by `cycleId` or `patientId`.

### Task 2 — lab-orders.ts (LAB-01/LAB-02)

**createLab / updateLab** (LAB-01):
- ORDER_ROLES-gated (admin/superadmin/dentist)
- Zod-validates via `labSchema`
- `clinic_id = actor.tenant_id` on all prosthetic_labs operations
- Logs `lab.created` / `lab.updated`

**createLabOrder** (LAB-01):
- ORDER_ROLES-gated; Zod-validates via `labOrderSchema`
- Inserts `lab_orders` tenant-scoped with `stages` JSONB, `status` enum
- If `isCostPostable(cost)` AND `COST_ROLES.includes(actor.role)` → calls `postLabExpense` inline at creation

**setLabOrderCost (LAB-02)** — financial posting:
- COST_ROLES=['admin','superadmin'] only (matches financial_transactions write RLS)
- `isCostPostable(cost)` guard: rejects zero/null/negative
- **Double-post guard (T-13-15)**: re-fetches `lab_orders.financial_transaction_id`; returns `'Custo já lançado no financeiro para esta OS'` if already set
- Resolves optional lab/prótese despesa category via `financial_categories ILIKE '%laborat%'` (D-04)
- Inserts `financial_transactions` with **`tenant_id: actor.tenant_id`** (NOT clinic_id), `type: 'despesa'`, `amount`, `description = buildLabExpenseDescription(...)`, `transaction_date`, `posted_by`
- Backfills `lab_orders.financial_transaction_id` (LAB-02)
- Logs `lab.order.cost.posted`

**Private helper `postLabExpense`**: shared by `createLabOrder` (at-creation posting) and `setLabOrderCost` (post-hoc posting) — single code path for LAB-02 despesa logic, no duplication.

**updateLabOrderStatus**: enviado/prova/concluido enum guard; ORDER_ROLES-gated; tenant-scoped; logs `lab.order.status.updated`.

**listLabOrders / listLabs**: read-only tenant-scoped lists.

## Verification Results

```
vitest run src/__tests__/esterilizacao/ src/__tests__/protese/
  Test Files: 8 passed (8)
  Tests:      109 passed (109)

  Breakdown:
  - sterilization-action.test.ts:  13 passed (source-inspection CME-01/02/03)
  - kit-block-guard.test.ts:        8 passed (block-guard logic + purity)
  - cycle-status.test.ts:           4 passed (deriveCycleStatus + isCycleUsable)
  - migrations-phase13-cme.test.ts: 27 passed (schema assertions)
  - regression-guard-phase13.test.ts: 5 passed (no ALTER appointments / DROP financial_transactions)
  - lab-order-action.test.ts:       16 passed (source-inspection LAB-01/02)
  - lab-cost.test.ts:                7 passed (isCostPostable + buildLabExpenseDescription)
  - migrations-phase13-lab.test.ts: 29 passed (schema assertions)

tsc --noEmit: exit 0
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both action files contain production logic wired to real Supabase tables. No placeholder data, no hardcoded empty arrays flowing to UI rendering. The actions are consumed by Plan 06 UI components (not yet built).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_server_action_endpoints | src/actions/sterilization.ts | registerKitUsage is a new mutation endpoint at the client/server boundary — covered by T-13-12 (server-side re-fetch block guard) and T-13-14 (assertNotReadOnly + TEAM_ROLES) |
| threat_flag: financial_write_endpoint | src/actions/lab-orders.ts | setLabOrderCost writes to financial_transactions — covered by T-13-15 (double-post guard), T-13-16 (COST_ROLES=['admin','superadmin']), T-13-17 (tenant_id scope) |

## Self-Check: PASSED

- [x] src/actions/sterilization.ts — FOUND
- [x] src/actions/lab-orders.ts — FOUND
- [x] src/__tests__/esterilizacao/sterilization-action.test.ts — FOUND
- [x] src/__tests__/protese/lab-order-action.test.ts — FOUND
- [x] commit 033ad96 — FOUND
- [x] commit d588e81 — FOUND
