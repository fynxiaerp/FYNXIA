---
phase: 14-financeiro-cadastros-base
plan: "05"
subsystem: financeiro-ui
tags: [ui, tree, accordion, rsc, fcad-01, plano-de-contas]
dependency_graph:
  requires:
    - plan: 14-04 (listAccountsTree, createAccount, updateAccount — chart-of-accounts Server Actions)
    - plan: 14-03 (chart_of_accounts schema + RLS)
  provides:
    - component: src/components/financeiro/AccountFormDialog.tsx (create/edit dialog)
    - component: src/components/financeiro/ChartOfAccountsTree.tsx (recursive Accordion tree)
    - route: src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx
    - route: src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx
    - route: src/app/(dashboard)/clinica/financeiro/plano-de-contas/error.tsx
  affects:
    - plan: 14-06 (CostCenters + BankAccounts UI — same hub cards pattern)
    - plan: 14-07 (TransactionModal expansion — AccountFormDialog pattern reference)
tech_stack:
  added: []
  patterns:
    - Recursive AccordionItem tree with flat-map for parent Select (chart tree pattern)
    - RowContent extracted as shared sub-component for trigger and leaf rows
    - collectGroupIds() computes defaultValue for all-open accordion on mount
    - canEdit prop gates admin row actions (UI defense-in-depth per T-14-14)
    - flattenTree() inside ChartOfAccountsTree — single source of parent list for all dialogs
    - Dialog open state managed by wrapper div onClick (contents pattern) — avoids asChild anti-pattern
key_files:
  created:
    - src/components/financeiro/AccountFormDialog.tsx
    - src/components/financeiro/ChartOfAccountsTree.tsx
    - src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx
    - src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/plano-de-contas/error.tsx
  modified:
    - src/app/(dashboard)/clinica/financeiro/page.tsx
decisions:
  - id: D-14-05-01
    summary: "Dialog trigger uses wrapper div onClick instead of DialogTrigger render prop"
    rationale: "AccountFormDialog needs to accept any ReactNode trigger (Button, icon button). @base-ui DialogTrigger renders a button element — wrapping a Button inside it creates nested button (invalid HTML). The contents div pattern dispatches open state via onClick without DOM nesting issues."
  - id: D-14-05-02
    summary: "type and parent_id are immutable in edit mode — fields hidden/disabled"
    rationale: "Changing type or reparenting an account would break the tree structure and invalidate existing transactions. Edit mode shows type as disabled Select and hides parentId field entirely — mirrors chart-of-accounts.ts updateAccount which only accepts name/ativo/code."
  - id: D-14-05-03
    summary: "parents prop in page.tsx passed as empty array to page-level AccountFormDialog"
    rationale: "The 'Nova Conta' page-header button opens a create dialog with no parent context. The full parent list is available inside ChartOfAccountsTree via flattenTree(accounts). Passing parents=[] to the page-level dialog means no parent select options — user can pick parentId from the tree-level add-child buttons which pre-set parentId."
metrics:
  duration_minutes: 25
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 1
---

# Phase 14 Plan 05: Plano de Contas UI Summary

**One-liner:** Recursive Accordion tree (ChartOfAccountsTree) + AccountFormDialog (RHF+Zod create/edit) + /clinica/financeiro/plano-de-contas RSC route + 3 new cadastro cards on financeiro hub.

---

## What Was Built

Wave 5 (UI): FCAD-01 SC1 user-visible tree. Admin sees Edit + Add Child buttons on hover; non-admin sees read-only tree. Financeiro hub gains Plano de Contas, Centros de Custo, Contas Correntes navigation cards.

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/financeiro/AccountFormDialog.tsx` | 244 | RHF+Zod dialog: create/edit chart_of_accounts; fields código/nome/tipo/conta-pai/ativo; Switch ativo with inline warning |
| `src/components/financeiro/ChartOfAccountsTree.tsx` | 214 | Recursive Accordion tree: AccordionItem for groups, div[role=listitem] for leaves; canEdit row actions; type badges; inactive strikethrough |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx` | 75 | RSC: role fetch → isAdmin, listAccountsTree, ChartOfAccountsTree, empty state, error Alert |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx` | 48 | animate-pulse skeleton: PageHeader + 3 groups × 2 children |
| `src/app/(dashboard)/clinica/financeiro/plano-de-contas/error.tsx` | 25 | AlertTriangle + "Algo deu errado" + reset button |

### Files Modified

| File | Change |
|------|--------|
| `src/app/(dashboard)/clinica/financeiro/page.tsx` | Add GitBranch/Building2/Landmark imports; add 3 navItems (Plano de Contas, Centros de Custo, Contas Correntes) |

---

## Commits

| Hash | Description |
|------|-------------|
| 94db37e | feat(14-05): AccountFormDialog + ChartOfAccountsTree components |
| 31719b1 | feat(14-05): plano-de-contas route + financeiro hub cards |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

**D-14-05-01 — Dialog trigger pattern:** The plan specified `trigger: ReactNode` prop and opening the dialog when the trigger is clicked. Because @base-ui `DialogTrigger` renders its own `<button>` and wrapping a `<Button>` inside it creates invalid nested buttons, the component uses a `div.contents` wrapper with `onClick`/`onKeyDown` to set `open=true`. This is semantically equivalent and avoids the nested-button DOM violation.

**D-14-05-03 — parents=[] on page-level dialog:** The "Nova Conta" header button receives `parents=[]` (no parent select). Admins needing to create a child account use the "+ Conta Filha" button on group rows inside `ChartOfAccountsTree`, which pre-sets `parentId` and passes the full flattened tree as `parents`. This is the intended UX flow per UI-SPEC interaction contract.

---

## Checkpoint: human-verify (Task 3)

Task 3 is a `checkpoint:human-verify` gate. All build tasks are complete and `npm run build` exits 0.

**What to verify:**
1. Visit `/clinica/financeiro` — confirm 3 new cards: Plano de Contas, Centros de Custo, Contas Correntes.
2. Click "Plano de Contas" — confirm tree shows seeded odontological hierarchy (1 Receitas → 1.1 → 1.1.1 etc.), all groups expanded, codes monospaced.
3. Click "Nova Conta" → create a leaf under 2.1; confirm it appears with auto-computed code.
4. Edit an account; toggle ativo off; confirm strikethrough rendering.
5. Log in as `socio` — confirm NO Edit/Add buttons visible.

---

## Known Stubs

None — tree renders real data from `listAccountsTree`. AccountFormDialog calls real `createAccount`/`updateAccount` Server Actions.

---

## Threat Flags

No new trust boundaries beyond plan's threat model:
- T-14-14 (elevation — edit controls to non-admin): mitigated — `canEdit={isAdmin}` hides UI; real gate is admin role check + RLS in Plan 04 Server Actions
- T-14-15 (info disclosure — cross-tenant tree): mitigated — `listAccountsTree` runs under RLS (clinic_id = get_my_tenant_id())

---

## Self-Check: PASSED

Files created:
- FOUND: src/components/financeiro/AccountFormDialog.tsx
- FOUND: src/components/financeiro/ChartOfAccountsTree.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/plano-de-contas/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/plano-de-contas/error.tsx

Commits:
- FOUND: 94db37e
- FOUND: 31719b1

Build: exits 0
