---
phase: "06"
plan: "06"
subsystem: clinical-module
tags: [ux-polish, pageheader, agenda, pacientes, prontuario, odontograma, typography]
dependency_graph:
  requires: ["06-03", "06-04"]
  provides: [clinical-module-shell, inline-tabs, sortable-patient-table, pdf-download-button]
  affects: [agenda, pacientes-list, patient-detail, contas-a-receber]
tech_stack:
  added: []
  patterns:
    - PageHeader on every clinical page (title + breadcrumbs + actions)
    - EmptyState primitive replacing ad-hoc inline empty states
    - TanStack Table sortable headers with aria-sort + ArrowUp/ArrowDown icons
    - PdfButton 'use client' component with Loader2 spinner + blob download
    - Inline tab content rendering (no redirect stub cards)
key_files:
  created:
    - src/app/(dashboard)/clinica/pacientes/[id]/loading.tsx
    - src/components/patients/PdfButton.tsx
  modified:
    - src/app/(dashboard)/clinica/agenda/page.tsx
    - src/components/agenda/AgendaCalendar.tsx
    - src/app/(dashboard)/clinica/pacientes/page.tsx
    - src/components/patients/PatientTable.tsx
    - src/app/(dashboard)/clinica/pacientes/[id]/page.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx
decisions:
  - "Patient detail Prontuario/Odontograma tabs render inline: sub-route content components lifted into tab panels; router.push pattern breaks tab visual context; same RLS-scoped data"
  - "PdfButton use-client with Loader2 spinner: plain anchor cannot show loading state; server PDF generation logic unchanged"
  - "Agenda empty-state fires on events.length===0 not dentists.length===0: previous trigger hid empty state when dentists existed but had no appointments"
  - "Todos os dentistas as __all__ sentinel value: null in nuqs maps to all-dentists view; SelectItem value='__all__' maps back to null on change"
metrics:
  duration_minutes: 20
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_changed: 8
---

# Phase 06 Plan 06: Clinical Module Visual Sweep (Wave 3) Summary

**One-liner:** Clinical shell sweep — PageHeader + inline prontuário/odontograma tabs + sortable patient table with Eye-only action + agenda empty-state fix + PdfButton with spinner.

---

## What Was Built

### Task 1 — Agenda: PageHeader, empty-state fix, dentist filter, ellipsis

- `agenda/page.tsx`: Replaced ad-hoc `<div>` header with `PageHeader` (title "Agenda", Nova Consulta button action). Fixed empty-state condition: now fires when `events.length === 0` instead of the incorrect `dentists.length === 0` trigger. Uses `EmptyState` with `CalendarX` icon ("Nenhuma consulta esta semana"). Calendar renders inside `h-[calc(100vh-64px)] p-0` for full-viewport layout.
- `AgendaCalendar.tsx`: Added "Todos os dentistas" as the first `SelectItem` (value `__all__`); `Select.value` maps `null` → `__all__`; `onValueChange` maps `__all__` → `null` (clears nuqs filter). Changed `'Salvando...'` → `'Salvando…'` (proper Unicode ellipsis).
- `loading.tsx` and `error.tsx` were already present from a prior wave — verified correct.

### Task 2 — Pacientes list: EmptyState, sortable table, Eye-only

- `pacientes/page.tsx`: Replaced inline empty state with `EmptyState` component (`UserX` icon, "Nenhum paciente cadastrado", CTA "Novo Paciente" for staff). Already had PageHeader from an earlier wave.
- `PatientTable.tsx`: Added sort support to `full_name` and `cpf` columns (`enableSorting: true`). `TableHead` renders with `onClick={header.column.getToggleSortingHandler()}`, `aria-sort="ascending|descending|none"`, and `text-primary` on active sorted column. Sort icon inline: `ArrowUp` (asc), `ArrowDown` (desc), `ArrowUpDown` (unsorted). Removed redundant `Pencil` action button — Eye-only remains. Fixed `font-medium` → `font-semibold` on patient name Link cell (typography contract).

### Task 3 — Patient detail: PageHeader, inline tabs, PdfButton, loading.tsx

- `[id]/page.tsx`: Full rewrite. Replaced ad-hoc breadcrumb + h1 header with `PageHeader` (patient name as title, Clínica > Pacientes > [Nome] breadcrumbs, `PdfButton` as actions slot). Inline Prontuário tab renders `ProntuarioForm` + medical records history directly (fetched server-side via `listMedicalRecords`). Inline Odontograma tab renders `Odontogram` component directly (fetched server-side via `dental_records` query). Eliminated both redirect stub cards. Tab content areas use `p-4` padding.
- `PdfButton.tsx` (new): `'use client'` component with `Loader2` spinner during fetch. On click: sets loading → fetches `/api/patients/[id]/prontuario.pdf` → creates object URL → triggers `<a>` download → revokes URL → clears loading. Server PDF generation logic untouched.
- `[id]/loading.tsx` (new): `PageHeaderSkeleton` + patient sub-header skeleton + 4 tab button skeletons + content line skeletons.

### Deviation — Typography fix: contas-a-receber (Rule 1)

- `contas-a-receber/page.tsx`: `font-medium` on empty-state paragraph (line 89) → `font-semibold`. This file is in `typography.test.ts` audited list and was the sole failing test before this plan.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed font-medium typography violation in contas-a-receber**
- **Found during:** Pre-execution test run (typography.test.ts 1 failure)
- **Issue:** `<p className="text-sm font-medium">Nenhum recebível cadastrado</p>` — `font-medium` is banned by the 2-weight typography contract
- **Fix:** Changed to `font-semibold`
- **Files modified:** `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx`
- **Commit:** f8f5453

**2. [Rule 2 - Missing functionality] Todos os dentistas sentinel value handling**
- **Found during:** Task 1 implementation
- **Issue:** Adding "Todos os dentistas" as a SelectItem requires a non-empty string value (shadcn Select rejects empty string as a valid item value); the existing `onValueChange={(v) => setDentistId(v || null)}` pattern would not distinguish between "no selection" and "all dentists" once an item is present
- **Fix:** Used `__all__` as sentinel value; `Select.value` maps `dentistId ?? '__all__'`; `onValueChange` maps `'__all__' → null`
- **Files modified:** `src/components/agenda/AgendaCalendar.tsx`
- **Commit:** 75bc3b2

---

## Known Stubs

None. All tab content is wired to real server-side data (listMedicalRecords, dental_records query, listAnamneses). PdfButton calls the real PDF endpoint. No placeholder text or hardcoded empty values in rendered output.

---

## Threat Flags

None. Prontuário and Odontograma tab content renders the same RLS-scoped clinical data already served at the sub-routes (`/prontuario`, `/odontograma`). No new data paths, no new network endpoints. CPF/health masking logic is unchanged. PDF endpoint auth unchanged.

---

## Verification

- `npx vitest run src/__tests__/ui/` — 125/125 tests pass (5 test files)
- `npx tsc --noEmit` — exit 0
- `npx next build` — clean (29 routes compiled, 0 errors)

---

## Self-Check

### Files exist
- `src/app/(dashboard)/clinica/pacientes/[id]/loading.tsx` — FOUND
- `src/components/patients/PdfButton.tsx` — FOUND
- `src/app/(dashboard)/clinica/agenda/page.tsx` — FOUND (modified)
- `src/components/agenda/AgendaCalendar.tsx` — FOUND (modified)
- `src/app/(dashboard)/clinica/pacientes/page.tsx` — FOUND (modified)
- `src/components/patients/PatientTable.tsx` — FOUND (modified)
- `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` — FOUND (modified)
- `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx` — FOUND (modified)

### Commits exist
- 75bc3b2 — feat(06-06): agenda — PageHeader, empty-state fix, Todos os dentistas, ellipsis
- 5f74851 — feat(06-06): pacientes list — EmptyState component, sortable table, Eye-only action
- af925e2 — feat(06-06): patient detail — PageHeader, inline tabs, PdfButton, loading.tsx
- f8f5453 — fix(06-06): contas-a-receber — clear font-medium typography violation

## Self-Check: PASSED
