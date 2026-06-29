---
phase: quick
plan: 260629-ivj
subsystem: financeiro
tags: [suppliers, crud, ui, financeiro, fornecedores]
dependency_graph:
  requires: [src/actions/suppliers.ts]
  provides: [/clinica/financeiro/fornecedores, SuppliersTable, SupplierFormDialog]
  affects: [/clinica/financeiro hub nav]
tech_stack:
  added: []
  patterns: [RSC page + client table + RHF dialog, shadcn Table, useTransition + router.refresh()]
key_files:
  created:
    - src/components/financeiro/SupplierFormDialog.tsx
    - src/components/financeiro/SuppliersTable.tsx
    - src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx
    - src/app/(dashboard)/clinica/financeiro/fornecedores/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/fornecedores/error.tsx
  modified:
    - src/app/(dashboard)/clinica/financeiro/page.tsx
    - src/actions/suppliers.ts
decisions:
  - "SupplierRow type defined in SupplierFormDialog and re-exported for SuppliersTable — single source of truth without extra types file"
  - "listSuppliers called with no filters to show all including inactive — admin needs full history view"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-29T16:46:02Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 2
---

# Phase quick Plan 260629-ivj: Criar Página de Gerenciamento de Fornecedores Summary

**One-liner:** Full CRUD UI for suppliers at /clinica/financeiro/fornecedores — list table, RHF create/edit dialog, deactivate action, hub nav card — following the centros-de-custo page pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SupplierFormDialog + SuppliersTable client components | 5e5fb07 | SupplierFormDialog.tsx, SuppliersTable.tsx |
| 2 | RSC page + loading/error boundaries + hub nav card | 82ee555 | fornecedores/page.tsx, loading.tsx, error.tsx, financeiro/page.tsx, suppliers.ts |

## Checkpoint Reached

**Task 3** is a `checkpoint:human-verify` — see below.

## Decisions Made

1. `SupplierRow` type defined in `SupplierFormDialog.tsx` and imported by `SuppliersTable.tsx` — avoids a separate types file, mirrors the single-source-of-truth pattern used for `CostCenterRow` exported from `cost-centers.ts`.
2. `listSuppliers()` called with no filters (includes inactive rows) — admin needs full history of suppliers, including deactivated ones, to maintain fiscal audit trail.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired to real server actions and Supabase queries.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers:
- T-ivj-01 (WRITER_ROLES gate in suppliers.ts) — already present, UI canEdit is cosmetic
- T-ivj-02 (clinic_id from actor.tenant_id) — unchanged, server action never trusts client input
- T-ivj-03 (RLS scopes listSuppliers to tenant) — unchanged

## Self-Check: PASSED

Files exist:
- src/components/financeiro/SupplierFormDialog.tsx — FOUND
- src/components/financeiro/SuppliersTable.tsx — FOUND
- src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx — FOUND
- src/app/(dashboard)/clinica/financeiro/fornecedores/loading.tsx — FOUND
- src/app/(dashboard)/clinica/financeiro/fornecedores/error.tsx — FOUND

Commits exist:
- 5e5fb07 — FOUND (Task 1)
- 82ee555 — FOUND (Task 2)
