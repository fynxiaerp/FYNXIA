---
phase: 14-financeiro-cadastros-base
plan: 01
subsystem: financeiro
tags: [tdd, red-scaffolds, test-contracts, wave-0, fcad]
dependency_graph:
  requires: []
  provides:
    - test-contract: src/__tests__/financeiro/migrations-phase14.test.ts
    - test-contract: src/__tests__/financeiro/chart-of-accounts.test.ts
    - test-contract: src/__tests__/financeiro/transaction-classification.test.ts
    - test-contract: src/__tests__/financeiro/regression-guard-phase14.test.ts
  affects:
    - plan: 14-02 (migrations must satisfy migrations-phase14.test.ts)
    - plan: 14-03 (transactions.ts expansion must satisfy transaction-classification.test.ts)
    - plan: 14-04 (chart-tree.ts must satisfy chart-of-accounts.test.ts)
tech_stack:
  added: []
  patterns:
    - dynamic-import guard for RED module contracts (mirrors receivables.test.ts existsSync pattern)
    - inline mirror Zod schema for contract documentation (transaction-classification.test.ts)
    - readFileSync + empty-string fallback for RED SQL source-inspection (migrations-phase14.test.ts)
key_files:
  created:
    - src/__tests__/financeiro/migrations-phase14.test.ts
    - src/__tests__/financeiro/chart-of-accounts.test.ts
    - src/__tests__/financeiro/transaction-classification.test.ts
    - src/__tests__/financeiro/regression-guard-phase14.test.ts
  modified: []
decisions:
  - id: D-14-01-01
    summary: Empty-string fallback (not existsSync guard + skip) for SQL source-inspection
    rationale: Tests FAIL RED when migration files absent — plan contract requires RED state to prove real assertions
  - id: D-14-01-02
    summary: Inline mirror schema in transaction-classification.test.ts always passes (GREEN contract doc)
    rationale: Provides self-documenting contract even before Plan 03 ships; dynamic-import section tests the actual module
  - id: D-14-01-03
    summary: Module-path sanity check uses conditional (not hard expect) in chart-of-accounts.test.ts
    rationale: Allows the test to describe wave progression without failing GREEN when Plan 04 ships
metrics:
  duration_minutes: 8
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 14 Plan 01: Wave 0 RED Scaffolds Summary

**One-liner:** 4 failing test files encoding FCAD-01/FCAD-02 contracts (migration DDL, buildTree, Zod classification, Phase 3 regression guard) before any implementation exists.

---

## What Was Built

Wave 0 (RED): 4 test files under `src/__tests__/financeiro/` that lock the Phase 14 acceptance contract into executable assertions. All assertions targeting future code fail RED; the regression guard passes GREEN immediately.

### Files Created

| File | Lines | State | Unblocks |
|------|-------|-------|---------|
| `migrations-phase14.test.ts` | 303 | RED (46/48 fail) | Plan 02 (migrations) |
| `chart-of-accounts.test.ts` | 151 | RED (dynamic import fails) | Plan 04 (chart-tree.ts) |
| `transaction-classification.test.ts` | 154 | RED (dynamic import fails) | Plan 03 (transaction-schema.ts) |
| `regression-guard-phase14.test.ts` | 46 | GREEN (existsSync passes) | Wave merge verification |

### Contract Encoded

**migrations-phase14.test.ts** encodes:
- `chart_of_accounts`: DDL (parent_id RESTRICT, code TEXT NOT NULL, type CHECK, clinic_id CASCADE, ativo, indexes, unique code index)
- `cost_centers`: DDL (unit_id FK, is_default, partial unique index per unit)
- `bank_accounts`: DDL (saldo_inicial NUMERIC(12,2), clinic index)
- `financial_transactions` ALTERs: 3 new columns NULLABLE (D-03b), partial indexes WHERE IS NOT NULL
- `financial_categories` ALTER: account_id column
- RLS policies: ENABLE RLS + tenant_read (SELECT) + admin_write (FOR ALL with BOTH USING and WITH CHECK — T-14-02)
- Seed: plano de contas odontológico (codes 1, 2, 1.1.1, 2.1.4), trigger ordering (seed_accounts_on_clinic < seed_categories_on_clinic alphabetically — Pitfall 5), CC default per unit, backfills

**chart-of-accounts.test.ts** encodes:
- `buildTree(rows)`: root+child nesting, empty input → [], two roots → length 2
- `nextChildCode(parentCode, siblingCount)`: `'1.1', 2` → `'1.1.3'`; `null, 1` → `'2'`

**transaction-classification.test.ts** encodes:
- `accountId` required: missing → `safeParse.success === false`, `issues[0].message === 'Conta contábil obrigatória'`
- `costCenterId` required: missing → `issues[0].message === 'Centro de custo obrigatório'`
- `bankAccountId` optional: omitted or null → `success === true`
- Full valid input → `success === true`

**regression-guard-phase14.test.ts** encodes:
- Phase 3 guard files exist: `migrations/financial.test.ts`, `webhooks/asaas.test.ts`, `actions/transactions.test.ts`
- Documents that re-running these suites at wave merge will confirm no Phase 3 regressions

---

## Test Results (Wave 0 state)

```
src/__tests__/financeiro/ suite:
  3 files FAIL RED (expected — migration files + modules absent)
  4 files PASS GREEN (receivables, charge-form, money, regression-guard)
  
  57 assertions failing (RED contracts)
  27 assertions passing (GREEN: mirror schema + regression guard + existing tests)
```

`npm run build` exits 0 — test files are typecheck-clean despite RED assertions.

---

## Commits

| Hash | Description |
|------|-------------|
| b3d4283 | test(14-01): RED scaffold — Phase 14 migration source-inspection |
| faeca42 | test(14-01): RED scaffolds — buildTree, classification schema, regression guard |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dynamic-import pattern for chart-of-accounts.test.ts: conditional meta-check**
- **Found during:** Task 2
- **Issue:** Plan specified a `it.skip` pattern was NOT allowed, but the hard `expect(false).toBe(true)` in the "module absent" case would invert and fail when Plan 04 ships, making the test permanently red after implementation.
- **Fix:** Used a conditional `if (!exists) expect(false) else expect(true)` so the test documents wave progression without permanently breaking.
- **Files modified:** `src/__tests__/financeiro/chart-of-accounts.test.ts`
- **Commit:** faeca42

None other — plan executed essentially as written.

---

## Known Stubs

None — this plan creates test files only; no UI rendering or data flows involved.

---

## Threat Flags

None — this plan creates test files only. No runtime trust boundary is crossed.

---

## Self-Check: PASSED

Files created:
- FOUND: src/__tests__/financeiro/migrations-phase14.test.ts
- FOUND: src/__tests__/financeiro/chart-of-accounts.test.ts
- FOUND: src/__tests__/financeiro/transaction-classification.test.ts
- FOUND: src/__tests__/financeiro/regression-guard-phase14.test.ts

Commits:
- FOUND: b3d4283
- FOUND: faeca42
