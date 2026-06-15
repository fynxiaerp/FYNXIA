---
phase: 11-profissionais-recursos
plan: "06"
subsystem: professionals
tags: [professionals, ui, forms, availability, commission, server-actions]
dependency_graph:
  requires: [11-05]
  provides: [professionals-cadastro-ui, professionals-server-actions]
  affects: [appointments-availability-gate, phase-16-commission]
tech_stack:
  added: []
  patterns:
    - RHF v7 + zodResolver(professionalSchema) tabbed form
    - AvailabilityGrid controlled component pattern (windows + exceptions)
    - soft-delete via deleted_at on professionals
    - delete-and-reinsert pattern for availability grade update
    - WaitingPanel stub for painel/[clinic-slug] (Rule 3 deviation)
key_files:
  created:
    - src/actions/professionals.ts
    - src/components/professionals/ProfessionalForm.tsx
    - src/components/professionals/AvailabilityGrid.tsx
    - src/app/(dashboard)/clinica/profissionais/page.tsx
    - src/app/(dashboard)/clinica/profissionais/[id]/page.tsx
    - src/components/painel/WaitingPanel.tsx
  modified: []
decisions:
  - "delete-and-reinsert for availability grade update (replaces grade atomically per action call)"
  - "AvailabilityGrid manages its own local state independently from RHF to avoid complex nested schema"
  - "commission_rules stored as JSONB array — no calculation in this plan (Phase 16 computes)"
  - "WaitingPanel stub created inline (Rule 3) to unblock build from 11-08 parallel wave"
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-14"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 11 Plan 06: Professionals Cadastro UI Summary

**One-liner:** Tabbed RHF+Zod professionals form (Ficha/Horários/Comissão) with AvailabilityGrid weekly editor, JSONB commission_rules storage, and admin-gated CRUD Server Actions.

## What Was Built

### Task 1 — professionals Server Actions (`src/actions/professionals.ts`)

`createProfessional`, `updateProfessional`, `deleteProfessional` with:
- `await assertNotReadOnly()` at the top of every mutation (T-11-22)
- `getActor()` pattern identical to appointments.ts
- admin/superadmin role gate with pt-BR error messages
- Zod `safeParse` validation of professionalSchema + availability windows + exceptions (T-11-24/25)
- Nested writes: insert professionals row → insert availability rows → insert exception rows
- Update path: delete-and-reinsert availability grade + exceptions atomically
- Soft delete via `deleted_at = now()` (LGPD)
- `logBusinessEvent` with professional_id only (no PII)
- All queries tenant-scoped via `.eq('clinic_id', actor.tenant_id)` (T-11-23)

### Task 2 — UI Components + RSC Pages

**`AvailabilityGrid.tsx`** (`'use client'`):
- Controlled component: `value: { windows, exceptions }` + `onChange`
- 7 weekday rows with add/remove time window inputs (HH:MM)
- Exceptions sub-section: date + folga/extra type + optional start/end + reason
- Parent (ProfessionalForm) owns state; RHF form handles top-level schema

**`ProfessionalForm.tsx`** (`'use client'`):
- RHF + `zodResolver(professionalSchema)` — no `.default()` in schema
- Three tabs (Ficha / Horários / Comissão)
- Ficha: full_name, CRO, CRO_UF (uppercase), vinculo Select, unit_id Select, user_id Select (link dentist login)
- tag input for especialidades (Enter key or Add button)
- Horários: `<AvailabilityGrid>` bound to separate local state, merged on submit
- Comissão: `CommissionRulesEditor` for flat_pct + service_pct JSONB array with helper text
- On success: `router.push('/clinica/profissionais')`
- Alert variant="destructive" for server errors (pt-BR)

**`/clinica/profissionais/page.tsx`** (RSC):
- Resolves tenant via `headers()` x-user-id
- Fetches professionals WHERE clinic_id = tenant AND deleted_at IS NULL
- Reads `x-read-only` — hides "Novo Profissional" CTA for read-only roles
- EmptyState with CTA; table with nome, CRO/UF, vínculo, especialidades, status, Editar link

**`/clinica/profissionais/[id]/page.tsx`** (RSC):
- Sentinel `id='novo'` → create mode
- Edit mode: fetches professional + professional_availability + professional_availability_exceptions
- Passes typed defaultValues + defaultAvailability + defaultExceptions to ProfessionalForm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WaitingPanel missing — unblocked build from Plan 11-08**
- **Found during:** Task 2 — `npx next build` failed on `src/app/painel/[clinic-slug]/page.tsx` line 19
- **Issue:** Plan 11-08 committed check-in server actions but the `WaitingPanel` client component was not committed, leaving an unresolved import that broke the build
- **Fix:** Created `src/components/painel/WaitingPanel.tsx` stub — renders LGPD-safe initials + status table, satisfies the type contract expected by the painel page
- **Files modified:** `src/components/painel/WaitingPanel.tsx` (new)
- **Commit:** `e739adf` (included in Task 2 commit)

## Known Stubs

- `src/components/painel/WaitingPanel.tsx`: stub implementation — no Supabase Realtime subscription yet (Plan 11-08 will implement full real-time TV panel). The page renders correctly but doesn't auto-refresh.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/professionals/professionals.test.ts` | 9/9 GREEN |
| `npx tsc --noEmit` | clean (exit 0) |
| `npx next build` | clean — 48 routes, including `/clinica/profissionais` and `/clinica/profissionais/[id]` |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `6a54019` | professionals Server Actions (create/update/delete + availability + exceptions) |
| 2 | `e739adf` | ProfessionalForm + AvailabilityGrid + list/edit pages + WaitingPanel stub |

## Self-Check: PASSED
