---
phase: 14-financeiro-cadastros-base
plan: "07"
subsystem: financeiro-ui
tags: [ui, fcad-02, classification, nuqs, transaction-modal, category-mapping]
dependency_graph:
  requires:
    - plan: 14-04 (transactionClassificationSchema, listCategoriesWithAccounts, updateCategoryAccount, listCostCenters, listBankAccounts, listAccountsTree — Server Actions)
    - plan: 14-05 (AccountFormDialog/tree pattern; AccountNode type from chart-tree.ts)
    - plan: 14-06 (CostCentersTable/BankAccountsTable patterns; BRL mask pattern)
  provides:
    - component: src/components/financeiro/TransactionModal.tsx (expanded with accountId + costCenterId + bankAccountId fields + category auto-fill)
    - component: src/components/financeiro/CategoriesAccountMappingTable.tsx (inline Select mapping, status badges)
    - component: src/components/financeiro/CashFlowFilters.tsx (nuqs unit/CC URL filters)
    - route: src/app/(dashboard)/clinica/financeiro/categorias/page.tsx
    - route: src/app/(dashboard)/clinica/financeiro/categorias/loading.tsx
    - route: src/app/(dashboard)/clinica/financeiro/categorias/error.tsx
  affects:
    - requirement: FCAD-02 (mandatory classification on manual entries + unit/CC filter on fluxo de caixa)
tech_stack:
  added: []
  patterns:
    - nuqs useQueryState for URL-persisted unit/cc filter (shareable, refresh-safe)
    - category→accountId auto-fill via form.setValue on category select change
    - leafAccounts filtered by current type (receita/despesa) in TransactionModal
    - flattenToLeaves() shared helper (page.tsx + categorias/page.tsx) — extracts non-grupo, ativo nodes from AccountNode tree
    - useTransition + router.refresh() for inline category→account mapping update
    - Amber count badge above table for unmapped category count
    - @base-ui Select onValueChange typed as (value: string | null) — null guard required
key_files:
  created:
    - src/components/financeiro/CategoriesAccountMappingTable.tsx
    - src/components/financeiro/CashFlowFilters.tsx
    - src/app/(dashboard)/clinica/financeiro/categorias/page.tsx
    - src/app/(dashboard)/clinica/financeiro/categorias/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/categorias/error.tsx
  modified:
    - src/components/financeiro/TransactionModal.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
decisions:
  - id: D-14-07-01
    summary: "@base-ui Select onValueChange typed as (value: string | null) — null guard required"
    rationale: "shadcn Select (wrapping @base-ui) passes null when value is cleared; TypeScript strict mode requires null guard in all onValueChange handlers; handlers updated to (value: string | null) with early return on null"
  - id: D-14-07-02
    summary: "CashFlowFilters + fluxo-de-caixa modal wiring committed in same Task 1 commit"
    rationale: "fluxo-de-caixa/page.tsx imports CashFlowFilters; both files needed to compile together; Task 3 implementation was done alongside Task 1 to satisfy npm run build in Task 1 acceptance criteria"
  - id: D-14-07-03
    summary: "flattenToLeaves() duplicated in fluxo-de-caixa/page.tsx and categorias/page.tsx (not extracted to lib)"
    rationale: "Both RSC pages need the same flatten logic; extracting to lib would require a shared file with no 'use server'; acceptable duplication for two callsites — can be extracted to src/lib/financeiro/chart-tree.ts in a future plan if a third callsite emerges"
metrics:
  duration_minutes: 10
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
---

# Phase 14 Plan 07: FCAD-02 UI — Classification Fields + Mapping Screen + Filters Summary

**One-liner:** TransactionModal extended with required Conta Contábil + Centro de Custo (category auto-fill) + CategoriesAccountMappingTable screen + nuqs unit/CC filter on fluxo de caixa (FCAD-02 complete).

---

## What Was Built

Wave 5 (UI): FCAD-02 fully wired at the UI layer. Manual entries now require classification; the admin mapping screen lets each category be linked to a leaf chart account; fluxo de caixa filters by unit/CC via URL state.

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/financeiro/CategoriesAccountMappingTable.tsx` | 181 | Inline Select per category (filtered by type); status badges Mapeada/Sem conta; unmapped count badge; canEdit gates admin actions |
| `src/components/financeiro/CashFlowFilters.tsx` | 97 | nuqs useQueryState for `?unit=` and `?cc=` URL filters; unit select narrows CC options |
| `src/app/(dashboard)/clinica/financeiro/categorias/page.tsx` | 76 | RSC: role fetch → isAdmin; Promise.all(listCategoriesWithAccounts, listAccountsTree); flattenToLeaves; Alert + CategoriesAccountMappingTable |
| `src/app/(dashboard)/clinica/financeiro/categorias/loading.tsx` | 46 | animate-pulse skeleton: PageHeader + alert + 5 table rows per UI-SPEC |
| `src/app/(dashboard)/clinica/financeiro/categorias/error.tsx` | 24 | AlertTriangle + "Algo deu errado" + reset button |

### Files Modified

| File | Change |
|------|--------|
| `src/components/financeiro/TransactionModal.tsx` | Add accountId (required z.string uuid), costCenterId (required), bankAccountId (optional); category auto-fill via handleCategoryChange; leafAccounts filtered by type; Centro de Custo pre-selected with defaultCostCenterId; Conta Corrente optional select |
| `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx` | Extend searchParams to {month, unit, cc}; parallel fetch listCategoriesWithAccounts + listAccountsTree + listCostCenters + listBankAccounts + listUnits; pass new props to TransactionModal; render CashFlowFilters; listTransactions called with costCenterId/unitId from params |

---

## Test Results

```
src/__tests__/financeiro/ — 7 files, 84/84 PASS (no regressions)
npm run build: exits 0 (Turbopack, TypeScript clean)
```

---

## Commits

| Hash | Description |
|------|-------------|
| 2960196 | feat(14-07): TransactionModal classification fields + category auto-fill + CashFlowFilters |
| 267faba | feat(14-07): CategoriesAccountMappingTable + categorias route segment |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @base-ui Select onValueChange passes `string | null`, not `string`**
- **Found during:** Task 1 + Task 3 build verification (TypeScript error)
- **Issue:** `onValueChange` handlers typed as `(value: string)` — TypeScript strict mode rejects assignment because `@base-ui` Select passes `string | null` when value is cleared.
- **Fix:** Changed all `onValueChange` handler signatures to `(value: string | null)` with early `if (!value) return` guards in TransactionModal and CashFlowFilters.
- **Files modified:** `src/components/financeiro/TransactionModal.tsx`, `src/components/financeiro/CashFlowFilters.tsx`
- **Commit:** 2960196

### Implementation Notes

**D-14-07-02 — CashFlowFilters committed with Task 1:** The fluxo-de-caixa page imports CashFlowFilters, so both needed to compile together. CashFlowFilters was implemented in full (not as a stub) during Task 1, satisfying the Task 3 acceptance criteria in the same commit. No deviation in quality — both were completed to spec.

---

## Task 4: Visual Verification (human-verify)

Task 4 is a `checkpoint:human-verify` gate. Per execution objective, treated as pre-approved (consolidated visual verification at phase end). All build tasks complete, `npm run build` exits 0, 84/84 tests GREEN.

**What to verify at phase end:**
1. Fluxo de caixa → "+ Lançamento" → submit without Conta Contábil / Centro de Custo → confirm "Campo obrigatório" on both.
2. Pick a mapped Categoria → confirm Conta Contábil auto-fills with helper "Preenchido automaticamente pela categoria"; Centro de Custo pre-selected with default.
3. Visit `/clinica/financeiro/categorias` → change a category's account → confirm status badge flips to "Mapeada".
4. Back on fluxo de caixa → apply unit/CC filter → confirm URL carries `?cc=`/`?unit=` and list narrows.

---

## Known Stubs

None — all components wire to real Server Actions. TransactionModal passes accountId + costCenterId to `createTransaction` which enforces them via `transactionClassificationSchema`.

---

## Threat Flags

No new trust boundaries beyond plan's threat model:
- T-14-19 (cross-tenant classification ids): mitigated — Select options come from RLS-filtered listings; createTransaction (Plan 04) sets tenant_id from actor; RLS WITH CHECK is backstop
- T-14-20 (unit/cc filter leaking rows): mitigated — listTransactions runs under RLS; foreign cc/unit id matches 0 rows
- T-14-21 (updateCategoryAccount cross-tenant/leaf abuse): mitigated — Plan 04 action validates same-tenant + leaf + matching type before UPDATE

---

## Self-Check: PASSED

Files created:
- FOUND: src/components/financeiro/CategoriesAccountMappingTable.tsx
- FOUND: src/components/financeiro/CashFlowFilters.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/categorias/page.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/categorias/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/categorias/error.tsx

Files modified (verified by grep):
- FOUND: src/components/financeiro/TransactionModal.tsx (costCenterId + accountId + Preenchido automaticamente)
- FOUND: src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx (CashFlowFilters + leafAccounts + costCenterId filter)

Commits:
- FOUND: 2960196
- FOUND: 267faba

Tests: 84/84 PASS
Build: exits 0
