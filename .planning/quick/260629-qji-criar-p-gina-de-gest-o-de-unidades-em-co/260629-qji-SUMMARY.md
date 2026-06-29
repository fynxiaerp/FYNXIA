---
phase: quick-260629-qji
plan: "01"
subsystem: config
tags: [units, crud, rbac, soft-delete, rsc]
dependency_graph:
  requires: [src/actions/units.ts (existing), src/lib/validators/unit.ts (existing)]
  provides: [/config/unidades route, deactivateUnit action, UnitFormDialog, UnitsTable]
  affects: [config module, units table (soft-delete)]
tech_stack:
  added: []
  patterns: [RSC page + PageHeader + Table + FormDialog, RHF + zodResolver reuse, soft-delete via deleted_at]
key_files:
  created:
    - src/app/(dashboard)/config/unidades/page.tsx
    - src/components/config/UnitFormDialog.tsx
    - src/components/config/UnitsTable.tsx
  modified:
    - src/actions/units.ts
decisions:
  - deactivateUnit uses createClient() (SSR authenticated session) matching existing actions pattern
  - Default-unit guard in both Server Action (hard block) and UI (Excluir button disabled)
  - unitSchema reused as-is from @/lib/validators/unit — no inline schema duplication
  - No .default() in schema (D-133) — RHF defaultValues supply all values
metrics:
  duration: "~8 minutes"
  completed: "2026-06-29"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Quick Task 260629-qji: Unidades Management Page Summary

**One-liner:** Standalone `/config/unidades` CRUD page with soft-delete action, mirroring fornecedores/centros-de-custo patterns, admin-gated with default-unit protection.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add `deactivateUnit` soft-delete action | c013eb1 | `src/actions/units.ts` |
| 2 | Create `UnitFormDialog` + `UnitsTable` components | 6c63fac | `src/components/config/UnitFormDialog.tsx`, `src/components/config/UnitsTable.tsx` |
| 3 | Create `/config/unidades` RSC page + build verify | 2ce4473 | `src/app/(dashboard)/config/unidades/page.tsx` |

## What Was Built

- **`deactivateUnit(unitId)`** — new Server Action appended to the existing `src/actions/units.ts`. Guards: `assertNotReadOnly()`, admin/superadmin role check, default-unit block (returns error if `is_default=true`). Soft-deletes via `deleted_at + ativo:false` so `listUnits` (which filters `deleted_at IS NULL`) excludes it automatically. Audit logs `unit.deleted`.

- **`UnitFormDialog`** — create/edit dialog reusing `unitSchema` + `UnitInput` from `@/lib/validators/unit`. No `.default()` (D-133). RHF `defaultValues` supply all values. Ativo Switch disabled for the default unit in edit mode. Mirrors `CostCenterFormDialog.tsx` structure exactly.

- **`UnitsTable`** — table with Nome (+ "Padrão" badge), Slug, CNPJ, Status columns and Ações column (Editar via `UnitFormDialog` + Excluir button disabled for default unit). Uses `useTransition` + `router.refresh()`. `EmptyState` when no units. Mirrors `SuppliersTable.tsx`.

- **`/config/unidades` RSC page** — role-gated Server Component: unauthenticated → "Não autenticado" alert; non-admin → "Acesso restrito" alert; admin/superadmin → `PageHeader` + "Nova Unidade" button + `UnitsTable`. `/config/unidades` appears in `next build` route output.

## Verification

- `npx tsc --noEmit`: clean (no new errors in non-test files)
- `npx next build`: succeeds; `/config/unidades` listed as `ƒ (Dynamic)` route
- Manual UAT: deploy to fynxia.vercel.app and verify CRUD flow as admin

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired from live `listUnits` + `createUnit` + `updateUnit` + `deactivateUnit` Server Actions.

## Self-Check

- [x] `src/actions/units.ts` — modified, `deactivateUnit` exported
- [x] `src/components/config/UnitFormDialog.tsx` — created (221 lines)
- [x] `src/components/config/UnitsTable.tsx` — created (119 lines)
- [x] `src/app/(dashboard)/config/unidades/page.tsx` — created (119 lines)
- [x] Commits c013eb1, 6c63fac, 2ce4473 exist in git log

## Self-Check: PASSED
