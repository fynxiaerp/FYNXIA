---
phase: 14-financeiro-cadastros-base
plan: "06"
subsystem: financeiro-ui
tags: [ui, table, dialog, rsc, fcad-01, centros-de-custo, contas-correntes]
dependency_graph:
  requires:
    - plan: 14-04 (listCostCenters, createCostCenter, updateCostCenter, listBankAccounts, createBankAccount, updateBankAccount — Server Actions)
    - plan: 14-05 (hub card pattern, plano-de-contas route pattern)
  provides:
    - component: src/components/financeiro/CostCenterFormDialog.tsx (create/edit dialog)
    - component: src/components/financeiro/CostCentersTable.tsx (tabular CC list with ativo toggle)
    - component: src/components/financeiro/BankAccountFormDialog.tsx (create/edit dialog with BRL mask)
    - component: src/components/financeiro/BankAccountsTable.tsx (tabular bank account list)
    - route: src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
    - route: src/app/(dashboard)/clinica/financeiro/centros-de-custo/loading.tsx
    - route: src/app/(dashboard)/clinica/financeiro/centros-de-custo/error.tsx
    - route: src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx
    - route: src/app/(dashboard)/clinica/financeiro/contas-correntes/loading.tsx
    - route: src/app/(dashboard)/clinica/financeiro/contas-correntes/error.tsx
  affects:
    - plan: 14-07 (TransactionModal expansion — CostCenter + BankAccount Select fields)
tech_stack:
  added: []
  patterns:
    - shadcn Table + Dialog pattern (UnitsManager.tsx replicated exactly)
    - CostCenterFormDialog: unit Select immutable in edit mode
    - BRL mask on blur (handleAmountBlur from TransactionModal/ChargeForm) for saldo inicial
    - useTransition + router.refresh() for inline ativo toggle without full page reload
    - div.contents wrapper onClick trigger (D-14-05-01 pattern) — avoids nested button DOM violation
    - canEdit prop gates all admin actions in table; real gate is Server Action WRITE_ROLES check
key_files:
  created:
    - src/components/financeiro/CostCenterFormDialog.tsx
    - src/components/financeiro/CostCentersTable.tsx
    - src/components/financeiro/BankAccountFormDialog.tsx
    - src/components/financeiro/BankAccountsTable.tsx
    - src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
    - src/app/(dashboard)/clinica/financeiro/centros-de-custo/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/centros-de-custo/error.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-correntes/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-correntes/error.tsx
  modified: []
decisions:
  - id: D-14-06-01
    summary: "unitId field disabled in edit mode for CostCenterFormDialog"
    rationale: "Changing a cost center's unit affiliation would orphan existing transaction references; unit is set at creation only — mirrors the type/parentId immutability pattern from AccountFormDialog (D-14-05-02)"
  - id: D-14-06-02
    summary: "BRL mask uses string field (saldoInicialStr) in RHF; parsed to number on submit"
    rationale: "RHF input fields are string-typed; saldo_inicial is NUMERIC(12,2) in DB — same pattern as TransactionModal amountStr; parseBRLToNumber converts on submit; no .default() in Zod (D-133)"
metrics:
  duration_minutes: 11
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 10
  files_modified: 0
---

# Phase 14 Plan 06: Centros de Custo + Contas Correntes UI Summary

**One-liner:** Tabular CostCentersTable (two-line cell + ativo toggle) + BankAccountsTable (BRL saldo, font-mono columns) + 2 RSC route segments with dialogs — FCAD-01 cadastros complete.

---

## What Was Built

Wave 5 (UI): 2 tabular cadastro screens. Admin sees full CRUD; non-admin sees read-only table. Each route has its own loading.tsx (skeleton) and error.tsx (AlertTriangle + reset).

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/financeiro/CostCenterFormDialog.tsx` | 195 | RHF+Zod dialog: create/edit cost_centers; fields nome/unidade (Select)/ativo (Switch); unit immutable in edit |
| `src/components/financeiro/CostCentersTable.tsx` | 110 | shadcn Table: two-line Nome cell (text-xs subtitle), Ativo Badge, ativo toggle Switch via useTransition+router.refresh |
| `src/components/financeiro/BankAccountFormDialog.tsx` | 215 | RHF+Zod dialog: create/edit bank_accounts; BRL mask on blur for saldo inicial; font-mono agencia/conta inputs |
| `src/components/financeiro/BankAccountsTable.tsx` | 90 | shadcn Table: Nome/Apelido (font-semibold), Banco (muted), Agencia/Conta (font-mono tabular-nums), Saldo (text-right tabular-nums formatBRL) |
| `src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx` | 68 | RSC: role fetch → isAdmin; Promise.all(listCostCenters, listUnits); PageHeader + CostCentersTable |
| `src/app/(dashboard)/clinica/financeiro/centros-de-custo/loading.tsx` | 55 | animate-pulse skeleton: PageHeader + 4 table rows |
| `src/app/(dashboard)/clinica/financeiro/centros-de-custo/error.tsx` | 24 | AlertTriangle + "Algo deu errado" + reset button |
| `src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx` | 62 | RSC: role fetch → isAdmin; listBankAccounts; PageHeader + BankAccountsTable |
| `src/app/(dashboard)/clinica/financeiro/contas-correntes/loading.tsx` | 58 | animate-pulse skeleton: PageHeader + 3 table rows |
| `src/app/(dashboard)/clinica/financeiro/contas-correntes/error.tsx` | 24 | AlertTriangle + "Algo deu errado" + reset button |

---

## Commits

| Hash | Description |
|------|-------------|
| dad11ab | feat(14-06): CostCenterFormDialog + CostCentersTable + centros-de-custo route |
| 470c679 | feat(14-06): BankAccountFormDialog + BankAccountsTable + contas-correntes route |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

**D-14-06-01 — unitId immutable in edit mode:** CostCenterFormDialog disables the unit Select when `mode === 'edit'`. This mirrors the type/parentId immutability in AccountFormDialog (D-14-05-02). The Server Action `updateCostCenter` does not accept `unitId` as a parameter — consistent with this constraint.

**D-14-06-02 — BRL string field + parse on submit:** BankAccountFormDialog uses `saldoInicialStr: z.string()` in the Zod schema and a `parseBRLToNumber()` helper on submit to convert to the numeric `saldoInicial` required by `createBankAccount`/`updateBankAccount`. Pattern mirrors TransactionModal's `amountStr` field.

---

## Task 3: Visual Verification (human-verify)

Task 3 is a `checkpoint:human-verify` gate. All build tasks complete and `npm run build` exits 0 (Turbopack, 57 routes).

**What to verify:**
1. Visit `/clinica/financeiro/centros-de-custo` — confirm each unit shows its seeded default CC (name = unit name, "Ativo").
2. Create a new CC ("Marketing") tied to a unit; confirm it appears with the unit subtitle in `text-xs text-muted-foreground`.
3. Toggle a CC inactive; confirm the badge updates to "Inativo".
4. Visit `/clinica/financeiro/contas-correntes`; create "Conta Itaú" with saldo R$ 1.000,00; confirm it lists right-aligned as R$ 1.000,00.
5. As a read-only role (socio), confirm no create/edit controls visible.

---

## Known Stubs

None — all components wire to real Server Actions (listCostCenters, createCostCenter, updateCostCenter, listBankAccounts, createBankAccount, updateBankAccount).

---

## Threat Flags

No new trust boundaries beyond plan's threat model:
- T-14-16 (cross-tenant unitId): mitigated — units Select populated from `listUnits()` (RLS-filtered, tenant-scoped); Plan 04 `createCostCenter` sets `clinic_id` from actor
- T-14-17 (elevation — non-admin write): mitigated — `canEdit={isAdmin}` hides UI; real gate is `WRITE_ROLES` check in Server Actions
- T-14-18 (info disclosure — cross-tenant bank accounts): mitigated — `listBankAccounts` runs under RLS `clinic_id = get_my_tenant_id()`

---

## Self-Check: PASSED

Files created:
- FOUND: src/components/financeiro/CostCenterFormDialog.tsx
- FOUND: src/components/financeiro/CostCentersTable.tsx
- FOUND: src/components/financeiro/BankAccountFormDialog.tsx
- FOUND: src/components/financeiro/BankAccountsTable.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/centros-de-custo/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/centros-de-custo/error.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/contas-correntes/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/contas-correntes/error.tsx

Commits:
- FOUND: dad11ab
- FOUND: 470c679

Build: exits 0 (57 routes, TypeScript clean)
