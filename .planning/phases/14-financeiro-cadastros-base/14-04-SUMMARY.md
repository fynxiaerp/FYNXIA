---
phase: 14-financeiro-cadastros-base
plan: "04"
subsystem: financeiro-cadastros
tags: [server-actions, pure-libs, zod, tdd, green, fcad-01, fcad-02, webhook]
dependency_graph:
  requires:
    - plan: 14-03 (live schema + regenerated types — chart_of_accounts, cost_centers, bank_accounts columns)
    - plan: 14-01 (RED test contracts for buildTree, classification schema)
  provides:
    - lib: src/lib/financeiro/chart-tree.ts (buildTree, nextChildCode, AccountNodeFlat, AccountNode)
    - lib: src/lib/financeiro/transaction-schema.ts (transactionClassificationSchema)
    - action: src/actions/chart-of-accounts.ts (listAccountsTree, createAccount, updateAccount, deactivateAccount, deleteAccount)
    - action: src/actions/cost-centers.ts (listCostCenters, createCostCenter, updateCostCenter)
    - action: src/actions/bank-accounts.ts (listBankAccounts, createBankAccount, updateBankAccount)
    - action: src/actions/categories.ts (listCategoriesWithAccounts, updateCategoryAccount)
  affects:
    - plan: 14-05 (PlanoDeContas UI — consumes listAccountsTree, createAccount, updateAccount, deactivateAccount)
    - plan: 14-06 (CentrosDeCusto + ContasCorrente UI — consumes listCostCenters, listBankAccounts, etc.)
    - plan: 14-07 (TransactionModal expansion — consumes transactionClassificationSchema, new filter params)
tech_stack:
  added: []
  patterns:
    - Map-based two-pass adjacency list buildTree (orphan-safe: parent not in map → root)
    - Zod required_error on z.string() for missing-field custom messages (Zod v3 behavior: uuid({ message }) only fires on invalid format, not missing)
    - TransactionInput typed optional at TS level for pre-UI-plan compat; Zod schema enforces required at runtime
    - Best-effort try/catch CC lookup in webhook (D-03b / T-14-13: failure → null, never blocks 200)
    - Array-or-object guard on Supabase join results (mirrors listTransactions pattern)
    - WRITE_ROLES=['admin','superadmin'] const gate (T-14-10 defense-in-depth)
key_files:
  created:
    - src/lib/financeiro/chart-tree.ts
    - src/lib/financeiro/transaction-schema.ts
    - src/actions/chart-of-accounts.ts
    - src/actions/cost-centers.ts
    - src/actions/bank-accounts.ts
    - src/actions/categories.ts
  modified:
    - src/actions/transactions.ts
    - src/app/api/webhooks/asaas/route.ts
    - src/__tests__/financeiro/transaction-classification.test.ts
decisions:
  - id: D-14-04-01
    summary: "Zod required_error on z.string() needed for missing-field custom messages in v3"
    rationale: "z.string().uuid({ message: '...' }) only fires custom message on invalid-format, not missing/undefined values; required_error fires on missing — both transaction-schema.ts and the test mirror schema updated to use this pattern"
  - id: D-14-04-02
    summary: "TransactionInput typed with optional accountId/costCenterId for pre-Plans-05-07 modal compat"
    rationale: "TransactionModal.tsx (existing UI) calls createTransaction without new fields; Plans 05-07 add the selects; Zod schema enforces required at runtime so the error is surfaced correctly to users; typing optional prevents build failure during data-layer-only plan"
  - id: D-14-04-03
    summary: "listTransactions gets opts.costCenterId / opts.unitId filter params for FCAD-02 SC2"
    rationale: "fluxo de caixa page needs unit/CC-scoped totals; unitId resolves to CC ids via cost_centers WHERE unit_id; costCenterId applies .eq() directly"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 3
---

# Phase 14 Plan 04: Data Layer — Pure Libs + Server Actions Summary

**One-liner:** buildTree/nextChildCode pure helpers + transactionClassificationSchema (accountId/costCenterId required) + 4 cadastro Server Actions with admin gate + classification enforcement on manual transactions + non-blocking webhook default-CC resolver.

---

## What Was Built

Wave 4 (GREEN): 2 pure lib files + 4 new Server Action modules + expanded transactions.ts + webhook resolver. Turns all Plan 01 RED unit tests GREEN. Defines the interface contracts consumed by UI Plans 05/06/07.

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/financeiro/chart-tree.ts` | 54 | buildTree (Map-based two-pass, orphan-safe) + nextChildCode + AccountNodeFlat/AccountNode types |
| `src/lib/financeiro/transaction-schema.ts` | 53 | transactionClassificationSchema: accountId+costCenterId required, bankAccountId optional; no .default() (D-133) |
| `src/actions/chart-of-accounts.ts` | 230 | listAccountsTree, createAccount (depth guard, auto-code, 23505), updateAccount, deactivateAccount, deleteAccount (pre-check + UI-SPEC friendly error) |
| `src/actions/cost-centers.ts` | 160 | listCostCenters (units join), createCostCenter (is_default=false), updateCostCenter |
| `src/actions/bank-accounts.ts` | 155 | listBankAccounts, createBankAccount (isMoney2dp on saldoInicial), updateBankAccount |
| `src/actions/categories.ts` | 155 | listCategoriesWithAccounts (account join), updateCategoryAccount (leaf check, cross-tenant guard T-14-11) |

### Files Modified

| File | Change |
|------|--------|
| `src/actions/transactions.ts` | Replace local transactionSchema → transactionClassificationSchema; INSERT adds account_id/cost_center_id/bank_account_id; TransactionRow extended; listTransactions gets opts filter params (FCAD-02 SC2) |
| `src/app/api/webhooks/asaas/route.ts` | Both insert sites add default CC lookup (best-effort try/catch) + account_id=null + bank_account_id=null (D-03b, Pitfall 6, T-14-13) |
| `src/__tests__/financeiro/transaction-classification.test.ts` | Fix mirror schema: z.string({ required_error }) for missing-field detection (Rule 1 — bug in Wave 0 mirror) |

---

## Test Results

```
src/__tests__/financeiro/chart-of-accounts.test.ts:      6/6 PASS (GREEN — Plan 01 RED → GREEN)
src/__tests__/financeiro/transaction-classification.test.ts: 9/9 PASS (GREEN — Plan 01 RED → GREEN)
src/__tests__/financeiro/migrations-phase14.test.ts:     48/48 PASS (unchanged)
src/__tests__/webhooks/asaas.test.ts:                     5/5 PASS (regression GREEN)
src/__tests__/actions/transactions.test.ts:               5/5 PASS (regression GREEN)
All other financeiro suites:                              GREEN (no regressions)

Total: 95/95 PASS
npm run build: exits 0
```

---

## Commits

| Hash | Description |
|------|-------------|
| 4efc6bb | feat(14-04): pure libs — chart-tree.ts + transaction-schema.ts (RED→GREEN) |
| d979f01 | feat(14-04): cadastro Server Actions — chart-of-accounts, cost-centers, bank-accounts, categories |
| 46e6227 | feat(14-04): enforce classification on manual transactions + non-blocking webhook resolver |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v3 uuid({ message }) does not fire on missing fields**
- **Found during:** Task 1 verification
- **Issue:** `z.string().uuid({ message: 'Conta contábil obrigatória' })` fires the custom message only when the value is present but not a valid UUID. When the field is missing/undefined, Zod v3 returns "Required" (the default `invalid_type` message), not the custom message.
- **Fix:** Changed both `accountId` and `costCenterId` in `transaction-schema.ts` to use `z.string({ required_error: '...', invalid_type_error: '...' }).uuid({ message: '...' })` so the custom message fires in all failure cases. Applied the same fix to the mirror schema in `transaction-classification.test.ts` (the mirror was labeled "always GREEN" but was also failing for the same reason — Wave 0 authored it with the same incorrect pattern).
- **Files modified:** `src/lib/financeiro/transaction-schema.ts`, `src/__tests__/financeiro/transaction-classification.test.ts`
- **Commit:** 4efc6bb

**2. [Rule 3 - Blocking] TransactionModal.tsx called createTransaction without new required fields**
- **Found during:** Task 3 build verification
- **Issue:** `TransactionModal.tsx` (pre-existing UI component) calls `createTransaction({ type, categoryId, amount, transactionDate, description })` — missing `accountId` and `costCenterId`. With the new `TransactionInput` type having these as required, TypeScript build failed.
- **Fix:** Changed `TransactionInput.accountId` and `.costCenterId` to `optional | null` at the TypeScript type level. The Zod schema (`transactionClassificationSchema`) still requires them and will return the friendly error message at runtime. The existing modal will show "Conta contábil obrigatória" / "Centro de custo obrigatório" when a user submits without these fields. Plans 05-07 will add the account/CC selectors to the modal.
- **Files modified:** `src/actions/transactions.ts`
- **Commit:** 46e6227

---

## Known Stubs

None — all functions have real implementations. The `TransactionModal` currently lacks account/CC selectors (they will be added in Plans 05-07), but `createTransaction` will correctly surface validation errors if called without those fields.

---

## Threat Flags

No new trust boundaries beyond those already captured in the plan's threat model:
- T-14-09 (cross-tenant account_id/cost_center_id): mitigated — RLS WITH CHECK + tenant_id from actor never from input
- T-14-10 (non-admin write): mitigated — WRITE_ROLES gate in all 4 action modules
- T-14-11 (cross-tenant accountId in updateCategoryAccount): mitigated — explicit clinic_id = actor.tenant_id check + leaf-type check
- T-14-12 (cycle/depth abuse): mitigated — parentDepth >= 2 guard in createAccount
- T-14-13 (webhook blocked by CC lookup): mitigated — try/catch wraps all CC lookups; null on failure; 200 unconditional

---

## Self-Check: PASSED

Files created:
- FOUND: src/lib/financeiro/chart-tree.ts
- FOUND: src/lib/financeiro/transaction-schema.ts
- FOUND: src/actions/chart-of-accounts.ts
- FOUND: src/actions/cost-centers.ts
- FOUND: src/actions/bank-accounts.ts
- FOUND: src/actions/categories.ts

Files modified (verified by grep):
- FOUND: src/actions/transactions.ts (transactionClassificationSchema import + account_id/cost_center_id in INSERT)
- FOUND: src/app/api/webhooks/asaas/route.ts (is_default lookup at both insert sites)

Commits:
- FOUND: 4efc6bb
- FOUND: d979f01
- FOUND: 46e6227

Tests: 95/95 PASS
Build: exits 0
