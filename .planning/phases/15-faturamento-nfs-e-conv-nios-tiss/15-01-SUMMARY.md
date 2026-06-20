---
phase: 15
plan: 01
subsystem: faturamento
tags: [wave-0, tdd, red-tests, nfse, tiss, service-orders, migrations]
dependency_graph:
  requires: []
  provides: [wave-0-test-scaffolds, faturamento-test-contract]
  affects: [15-02, 15-03, 15-04, 15-05]
tech_stack:
  added: []
  patterns: [source-inspection, absolute-path-dynamic-import-D144, existsSync-guard]
key_files:
  created:
    - src/__tests__/faturamento/migrations-phase15.test.ts
    - src/__tests__/faturamento/regression-guard-phase15.test.ts
    - src/__tests__/faturamento/service-orders.test.ts
    - src/__tests__/faturamento/nfse.test.ts
    - src/__tests__/faturamento/tiss.test.ts
  modified: []
decisions:
  - "D-144 absolute-path dynamic imports (not @-alias) for Wave 0 RED scaffolds: @-alias causes TS2307 when target missing"
  - "Regression guard GREEN: Phase 2 'concluido', Phase 9 nfse/tiss ConnectorType, Phase 3 financial schema all intact"
  - "4 behavior test files RED, 1 regression guard GREEN — exact Wave 0 contract"
metrics:
  duration_minutes: 5
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_created: 5
requirements: [OS-01, OS-02, OS-03, CONV-01, CONV-02, CONV-03]
---

# Phase 15 Plan 01: Wave 0 RED Test Scaffolds Summary

**One-liner:** Five Vitest RED scaffolds encoding Phase 15 faturamento contract — migrations (10 tables, D-27 enums, RLS), OS state machine + idempotency CAS, NFS-e FiscalProvider + ISS math, TISS TissProvider + glosa math.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration + regression source-inspection tests | 118b765 | migrations-phase15.test.ts, regression-guard-phase15.test.ts |
| 2 | Behavior tests — service-orders, nfse, tiss | 448a7e0 | service-orders.test.ts, nfse.test.ts, tiss.test.ts |

---

## What Was Built

### Task 1: Migration Source-Inspection + Regression Guard

**`src/__tests__/faturamento/migrations-phase15.test.ts`** (RED — 72 `toMatch` assertions):
- Asserts all 10 Phase 15 tables across 3 migration files: `services`, `insurer_prices`, `unit_fiscal_config`, `glosa_motivos` (catalog file); `insurers`, `appointment_procedures`, `service_orders`, `service_order_items`, `nfse_records` + `charges` ALTER (OS file); `tiss_lotes`, `tiss_guides`, `tiss_guide_items` (TISS file)
- D-27 enum CHECK constraints verbatim: OS status `rascunho/faturada/cancelada`, NFS-e status `processando/emitida/cancelada/erro`, TISS status `em_analise/autorizada/glosada/paga/recurso`, pagador `particular/convenio`
- OS-01 UNIQUE INDEX on `service_orders(appointment_id) WHERE appointment_id IS NOT NULL`
- D-30 UNIQUE INDEX on `service_orders(idempotency_key)`
- `charges.service_order_id` ALTER (OS-03 Open Question 2)
- `next_os_number` SECURITY DEFINER function (D-25/A1)
- RLS: ENABLE RLS, `get_my_tenant_id()` SELECT, `WITH CHECK`, `get_my_role() IN (...'admin'...)`
- Seed: ANS codes 1001, 9901 in `glosa_motivos`; `seed_services|seed_faturamento` function
- `clinic_id` indexes sampled on 3 tables (CLAUDE.md: mandatory)

**`src/__tests__/faturamento/regression-guard-phase15.test.ts`** (GREEN — 8 assertions):
- Phase 2: `appointment.ts` contains `'concluido'` status
- Phase 9: `integration/types.ts` ConnectorType union contains `'nfse'` and `'tiss'`
- Phase 3: `20260606000100_financial_tables.sql` has `CREATE TABLE public.financial_transactions` + `NUMERIC(12,2)`

### Task 2: Behavior Test Files

**`src/__tests__/faturamento/service-orders.test.ts`** (RED — 13 assertions):
- `computeOsTotal` D-25 math: `[{100},{50}] - 20 + 0 = 130`; integer-cent; acrescimo
- `isValidOsTransition`: rascunho→faturada OK; faturada→rascunho rejected; cancelada→anything rejected
- D-30 idempotency: second `faturarOs` on already-faturada OS returns `{success:true}`, `createCharge` call count stays 0
- D-30 CAS: when CAS UPDATE returns 0 rows → error matches `/corrida|race/i`
- OS-03 particular: `createCharge` called once; `insertInsurerReceivable` not called
- OS-03 convenio: `createCharge` not called; `insertInsurerReceivable` called once

**`src/__tests__/faturamento/nfse.test.ts`** (RED — 18 assertions):
- `FiscalProvider` interface source-inspection: `emit(`, `query(`, `cancel(` present
- `StubFiscalProvider.emit` returns `{status:'emitida', numero: defined}`
- `computeIss(1200, 0.05) === 60` (no float drift); integer-cent check; `computeIss(1000,0.02)===20`
- `resolveAliquota`: override present → use override; override null/undefined → fallback to unitConfig
- D-20 competencia: `provider.emit` called once
- D-20 caixa: `provider.emit` NOT called
- OS-02 convenio guard: `provider.emit` NOT called, returns `{success:true}`
- Pitfall 2 ordering: `insert:processando` index < `emit` index in call order

**`src/__tests__/faturamento/tiss.test.ts`** (RED — 17 assertions):
- `TissProvider` source-inspection: `sendLote(` or `createGuia(` present
- `StubTissProvider.sendLote` returns `{protocolo: string (non-empty)}`
- `computeGuiaGlosaTotals`: sum(valor_glosado)=80 for items [50,30]; valorAutorizado=720; integer-cent
- `criarGuia`: `insertGuia` called with `{status:'em_analise'}`
- `fecharLote`: `sendLote` called once; `updateLote` called with `{protocolo:'PROT-002'}`; result.protocolo returned
- `registrarGlosa`: `updateItem` called with `{glosa_status:'glosada', motivo_glosa_id, valor_glosado:50}`
- `registrarRecurso`: `updateItem` called with `{glosa_status:'em_recurso', recurso_texto}`

---

## Wave 0 State

| File | Status | Tests |
|------|--------|-------|
| migrations-phase15.test.ts | RED (expected) | 71 failed |
| regression-guard-phase15.test.ts | GREEN | 8 passed |
| service-orders.test.ts | RED (expected) | 13 failed |
| nfse.test.ts | RED (expected) | 18 failed |
| tiss.test.ts | RED (expected) | 17 failed |
| **Total** | **4 RED, 1 GREEN** | **119 failed / 8 passed** |

---

## VALIDATION.md Coverage

All 20 per-req rows from 15-VALIDATION.md are covered:

| Req | Behavior | Test File |
|-----|----------|-----------|
| OS-01 | appointment.status=concluido → OS rascunho (UNIQUE constraint) | migrations-phase15.test.ts |
| OS-01 | isValidOsTransition state machine | service-orders.test.ts |
| OS-02 | FiscalProvider.emit() on faturarOs (particular, competência) | nfse.test.ts |
| OS-02 | Stub returns emitida; nfse_records row created (Pitfall 2 order) | nfse.test.ts |
| OS-02 | NFS-e NOT emitted if pagador='convenio' | nfse.test.ts |
| OS-03 | createCharge called (particular path) | service-orders.test.ts |
| OS-03 | Insurer receivable created (convenio path) | service-orders.test.ts |
| CONV-01 | insurers + insurer_prices tables + schema | migrations-phase15.test.ts |
| CONV-02 | criarGuiaTiss creates tiss_guides in em_analise | tiss.test.ts |
| CONV-02 | fecharLote groups, sendLote, protocolo stored | tiss.test.ts |
| CONV-03 | registrarGlosa per item motivo+valor | tiss.test.ts |
| CONV-03 | registrarRecurso → em_recurso | tiss.test.ts |
| D-30 | faturarOs idempotent (second call, no re-emit) | service-orders.test.ts |
| D-30 | CAS guard race detection | service-orders.test.ts |
| D-25 | OS total math | service-orders.test.ts |
| D-25 | ISS base = total after discounts | nfse.test.ts |
| D-27 | Status enums CHECK constraints verbatim | migrations-phase15.test.ts |
| D-20 | regime=competencia → emitirNfse | nfse.test.ts |
| D-20 | regime=caixa → NO NFS-e on faturar | nfse.test.ts |
| D-28 | glosa math sum(valor_glosado) | tiss.test.ts |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — Wave 0 is test-only, no implementation stubs.

---

## Threat Flags

None — Wave 0 creates test files only (read-only source inspection + pure-function unit tests). No network endpoints, auth paths, or DB writes introduced. T-15-02: no real CPF/credentials in fixtures; all use synthetic placeholders (`'k'`, `'test-uuid'`, uuid patterns).

---

## Self-Check

### Files exist:
- src/__tests__/faturamento/migrations-phase15.test.ts — FOUND
- src/__tests__/faturamento/regression-guard-phase15.test.ts — FOUND
- src/__tests__/faturamento/service-orders.test.ts — FOUND
- src/__tests__/faturamento/nfse.test.ts — FOUND
- src/__tests__/faturamento/tiss.test.ts — FOUND

### Commits exist:
- 118b765 test(15-01): migration source-inspection + regression guard — FOUND
- 448a7e0 test(15-01): service-orders/nfse/tiss behavior tests — FOUND

## Self-Check: PASSED
