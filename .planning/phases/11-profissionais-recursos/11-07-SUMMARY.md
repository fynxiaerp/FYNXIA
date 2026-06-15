---
phase: 11-profissionais-recursos
plan: "07"
subsystem: resources-cadastro
tags: [resources, ui, forms, rls, lgpd]
one_liner: "RES-01 resources cadastro: Server Actions (create/update/delete) + RHF+Zod v3 form + list/edit RSC pages under /clinica/recursos"

dependency_graph:
  requires: [11-05]
  provides: [resources-server-actions, ResourceForm, recursos-pages]
  affects: [agenda-booking-guard-in-11-04]

tech_stack:
  added: []
  patterns:
    - Server Actions with assertNotReadOnly + role gate + tenant scope
    - RHF v7 + zodResolver(resourceSchema) + no .default() in schema
    - RSC list/edit pages with PageHeader + EmptyState + design tokens
    - @base-ui Button render-prop (no asChild)
    - Status badges using semantic tokens (emerald/amber/muted)

key_files:
  created:
    - src/actions/resources.ts
    - src/components/resources/ResourceForm.tsx
    - src/app/(dashboard)/clinica/recursos/page.tsx
    - src/app/(dashboard)/clinica/recursos/[id]/page.tsx
  modified: []

key_decisions:
  - id: D-11-07-01
    decision: "Used 'novo' as sentinel id for create mode in [id] page to avoid a separate /clinica/recursos/novo/page.tsx route"
    rationale: "Keeps the route structure flat; matches pattern used elsewhere in the project"
  - id: D-11-07-02
    decision: "Status badge uses emerald/amber CSS color classes (not shadcn semantic classes) because these are the closest semantic tokens for positive/warning/muted states"
    rationale: "Dark mode variants (dark:text-emerald-400) included; avoids raw gray/slate"

metrics:
  duration_minutes: 5
  completed_date: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 11 Plan 07: Resources Cadastro UI Summary

RES-01 resources cadastro delivered: Server Action layer (`createResource`/`updateResource`/`deleteResource`) + `ResourceForm` (RHF+Zod v3) + list and edit RSC pages under `/clinica/recursos`. Setting a resource's `status='manutencao'` is the booking-block trigger consumed by `isResourceAvailable()` in Plan 04.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Resources Server Actions | 63ed67e | src/actions/resources.ts |
| 2 | ResourceForm + list/edit pages | 5c0a5a5 | src/components/resources/ResourceForm.tsx, src/app/(dashboard)/clinica/recursos/page.tsx, src/app/(dashboard)/clinica/recursos/[id]/page.tsx |

## Verification Results

- `npx vitest run src/__tests__/resources/resources.test.ts`: **28/28 PASSED** (resources.ts source-inspection asserts for `assertNotReadOnly()` + `logBusinessEvent` GREEN)
- `npx tsc --noEmit`: **clean** (only pre-existing unrelated error in `src/actions/checkin.ts:261`)
- `npx next build`: **clean** — `/clinica/recursos` and `/clinica/recursos/[id]` rendered as dynamic routes

## Deviations from Plan

### Pre-existing Issue (Out of Scope)

`src/actions/checkin.ts:261` has a pre-existing `TS2352` type assertion error (not introduced by this plan, verified via stash). Per deviation rules, logged but not fixed.

None in files modified by this plan — executed exactly as written.

## Known Stubs

None. All fields are wired to real DB data (resources table) and live Server Actions.

## Threat Surface Scan

No new trust boundaries introduced beyond what the threat model in the plan covers. The four new files are covered by T-11-26 (assertNotReadOnly), T-11-27 (tenant scope), and T-11-28 (enum validation).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/actions/resources.ts exists | FOUND |
| src/components/resources/ResourceForm.tsx exists | FOUND |
| src/app/(dashboard)/clinica/recursos/page.tsx exists | FOUND |
| src/app/(dashboard)/clinica/recursos/[id]/page.tsx exists | FOUND |
| commit 63ed67e exists | FOUND |
| commit 5c0a5a5 exists | FOUND |
