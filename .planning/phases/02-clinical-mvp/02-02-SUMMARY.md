---
phase: 02-clinical-mvp
plan: "02"
subsystem: clinical-ui

tags: [patients, appointments, fullcalendar, rhf, zod, tanstack-table, nuqs, aes256, lgpd, crud]

# Dependency graph
requires:
  - phase: 02-clinical-mvp
    plan: "01"
    provides: "public.patients, public.appointments tables with GIST constraint, RLS, TypeScript types"
provides:
  - "patientSchema + appointmentSchema Zod v3 validators with CPF format regex and end>start refine"
  - "mapAppointmentToEvent / filterEventsByDentist pure calendar utilities"
  - "createPatient/updatePatient/anonymizePatient/getPatientDecrypted Server Actions with AES-256"
  - "createAppointment/updateAppointment/cancelAppointment Server Actions with 23P01 capture"
  - "PatientForm (RHF + zodResolver + CPF mask + Calendar-in-Popover)"
  - "PatientTable (TanStack Table v8 + CPF/phone/email masking by role)"
  - "PatientDeleteDialog (requires typing full name to confirm — LGPD)"
  - "Pages: /clinica/pacientes, /clinica/pacientes/novo, /clinica/pacientes/[id]"
  - "AgendaCalendar (FullCalendar timeGridWeek, dentistId nuqs filter, drag-drop, double-booking error)"
  - "Page: /clinica/agenda"
  - "shadcn components: input, label, textarea, select, badge, card, table, separator, alert, skeleton, dialog, tabs, popover, calendar, tooltip, breadcrumb, form"
affects:
  - "02-03 (prontuário/odontograma adds to /clinica/pacientes/[id] tabs)"
  - "02-04 (anamneses adds to /clinica/pacientes/[id] tabs)"

# Tech tracking
tech-stack:
  added:
    - "@fullcalendar/react + daygrid + timegrid + interaction 6.x — free timeGridWeek view"
    - "date-fns + date-fns-tz — Brazilian date formatting"
    - "nuqs 2.x — URL-persistent dentist filter (useQueryState)"
    - "@tanstack/react-query 5.x — installed (used in future client-side fetches)"
    - "@tanstack/react-table 8.x — headless table for PatientTable"
    - "zustand 5.x — installed (used in future client-side state)"
  patterns:
    - "Server Action pattern: getUser() → actor from public.users → role gate → operate → logBusinessEvent (IDs only)"
    - "AES-256-GCM encrypt guard: health fields encrypted ONLY when non-empty string (Pitfall 2 prevention)"
    - "Decrypt guard: value ? decrypt(value) : '' prevents decrypt(null) crash (Pitfall 2)"
    - "23P01 exclusion_violation capture: createAppointment + updateAppointment both handle GIST conflict"
    - "@base-ui/react render prop pattern instead of asChild (Button, PopoverTrigger, DialogTrigger, BreadcrumbLink)"
    - "react-day-picker v9: month_grid classname instead of deprecated table"
    - "nuqs URL state: dentistId persisted as ?dentist={id} — shareable, browser history works"
    - "filterEventsByDentist applied in AgendaCalendar to prevent cross-tenant event display (Pitfall 3)"

key-files:
  created:
    - src/lib/validators/patient.ts
    - src/lib/validators/appointment.ts
    - src/actions/patients.ts
    - src/actions/appointments.ts
    - src/components/patients/PatientForm.tsx
    - src/components/patients/PatientTable.tsx
    - src/components/patients/PatientDeleteDialog.tsx
    - src/components/agenda/AgendaCalendar.tsx
    - src/app/(dashboard)/clinica/pacientes/page.tsx
    - src/app/(dashboard)/clinica/pacientes/novo/page.tsx
    - src/app/(dashboard)/clinica/pacientes/[id]/page.tsx
    - src/app/(dashboard)/clinica/agenda/page.tsx
    - src/components/ui/form.tsx
    - src/__tests__/actions/patients.test.ts
    - src/__tests__/agenda/calendar.test.ts
  modified:
    - src/components/ui/calendar.tsx (month_grid fix)
    - package.json (new dependencies)
    - package-lock.json

key-decisions:
  - "@base-ui/react render prop used everywhere instead of asChild — Button uses buttonVariants+Link for navigation CTAs"
  - "react-day-picker v9 uses month_grid not table classname — shadcn-generated calendar.tsx updated"
  - "AgendaCalendar receives events as Server Component props (no client-side React Query fetch) to avoid Pitfall 3 on initial load"
  - "PatientDeleteDialog: autoFocus on Cancel button (safe action first — Accessibility Contract)"

# Metrics
duration: 17 minutes
completed: 2026-06-05
---

# Phase 2 Plan 02: Patient CRUD + Weekly Agenda Summary

**Patient CRUD with AES-256 health field encryption, LGPD anonymization, CPF masking, and FullCalendar timeGridWeek agenda with 23P01 double-booking error handling — full vertical slice from Zod validators through Server Actions to React UI**

## Performance

- **Duration:** ~17 minutes
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 4 (0, 1, 2, 3)
- **Files modified/created:** 28

## Accomplishments

- Zod v3 validators: `patientSchema` (CPF regex, health fields optional) + `appointmentSchema` (uuid, datetime, end>start refine, status enum)
- Pure calendar utilities: `mapAppointmentToEvent` and `filterEventsByDentist` — 12 tests GREEN
- Patient Server Actions: `createPatient` (AES-256 encrypt guard + 23505 CPF duplicate), `updatePatient` (re-encrypt), `anonymizePatient` (admin-only LGPD soft-delete), `getPatientDecrypted` (decrypt guard)
- Appointment Server Actions: `createAppointment` + `updateAppointment` both capture PostgreSQL `23P01` exclusion_violation and return friendly message; `cancelAppointment` soft-deletes (status='cancelado')
- Patient UI: PatientForm (RHF + zodResolver + CPF blur mask + Calendar-in-Popover), PatientTable (TanStack Table v8 with CPF/phone/email masking for receptionist/patient roles), PatientDeleteDialog (must type full name to enable destructive button)
- Patient pages: `/clinica/pacientes` (list + empty state), `/clinica/pacientes/novo`, `/clinica/pacientes/[id]` (tabs with Prontuário/Odontograma/Anamneses placeholders for Plans 03/04)
- AgendaCalendar: FullCalendar `timeGridWeek`, `locale pt-br`, 07:00-20:00, no allDay slot, `useQueryState('dentist')` nuqs filter, `eventDrop` with `info.revert()` on 23P01, `select` opens NewAppointmentDialog, `eventClassNames` by status
- 17 shadcn components added; `@base-ui/react` render prop pattern applied throughout
- 87 tests GREEN (up from 59 baseline); `npx tsc --noEmit` exits 0

## Task Commits

1. **Task 0: Zod validators + RED/GREEN tests** — `13ba9a8` (test)
2. **Task 1: Patient Server Actions with AES-256** — `cf398e1` (feat)
3. **Task 2: Patient UI — PatientForm/Table/DeleteDialog + 3 pages** — `bc2ea32` (feat)
4. **Task 3: Appointments Server Actions + AgendaCalendar** — `6bbfdb2` (feat)

## Files Created/Modified

**Validators:**
- `src/lib/validators/patient.ts` — patientSchema (CPF regex, health fields optional)
- `src/lib/validators/appointment.ts` — appointmentSchema + mapAppointmentToEvent + filterEventsByDentist

**Server Actions:**
- `src/actions/patients.ts` — buildAnonymizedPatch + createPatient + updatePatient + anonymizePatient + getPatientDecrypted
- `src/actions/appointments.ts` — createAppointment + updateAppointment + cancelAppointment (23P01 captured in create+update)

**Components:**
- `src/components/patients/PatientForm.tsx` — RHF + zodResolver + CPF blur mask + Calendar-in-Popover
- `src/components/patients/PatientTable.tsx` — TanStack Table v8 + CPF/phone/email masking by role
- `src/components/patients/PatientDeleteDialog.tsx` — typing-name destructive confirmation
- `src/components/agenda/AgendaCalendar.tsx` — FullCalendar timeGridWeek + nuqs + filterEventsByDentist + drag-drop 23P01 revert

**Pages:**
- `src/app/(dashboard)/clinica/pacientes/page.tsx` — list + empty state
- `src/app/(dashboard)/clinica/pacientes/novo/page.tsx` — PatientForm create
- `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` — tabs (Dados live, 3 placeholders for Plans 03/04)
- `src/app/(dashboard)/clinica/agenda/page.tsx` — Server Component loads dentists + week events

**UI Components (shadcn):**
- form.tsx, input.tsx, label.tsx, textarea.tsx, select.tsx, badge.tsx, card.tsx, table.tsx, separator.tsx, alert.tsx, skeleton.tsx, dialog.tsx, tabs.tsx, popover.tsx, calendar.tsx, tooltip.tsx, breadcrumb.tsx (17 components)

**Tests:**
- `src/__tests__/actions/patients.test.ts` — 9 tests (encrypt roundtrip, buildAnonymizedPatch, patientSchema)
- `src/__tests__/agenda/calendar.test.ts` — 12 tests (mapAppointmentToEvent, filterEventsByDentist)

## Decisions Made

- `@base-ui/react` uses `render` prop (not `asChild`) — affects Button, PopoverTrigger, DialogTrigger, BreadcrumbLink throughout all components
- `react-day-picker` v9 renamed `table` classname to `month_grid` — shadcn-generated calendar.tsx updated accordingly
- AgendaCalendar receives initial events as Server Component props to avoid Pitfall 3 (cross-tenant React Query cache) on first render; nuqs `?dentist` state persists dentist filter in URL
- `cancelAppointment` sets `status='cancelado'` (soft delete) — no row deletion; GIST constraint WHERE excludes cancelled from double-booking check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @base-ui/react render prop vs asChild**
- **Found during:** Task 2
- **Issue:** `@base-ui/react/button` does not support `asChild` prop (it's a Radix UI pattern). All Button/PopoverTrigger/DialogTrigger/BreadcrumbLink usages with `asChild` produced TypeScript errors.
- **Fix:** Used `render={<Element />}` prop for `@base-ui/react` primitives; used `buttonVariants + Link` for navigation CTAs
- **Files modified:** PatientForm.tsx, PatientDeleteDialog.tsx, pages (novo, [id]), AgendaCalendar.tsx
- **Commit:** bc2ea32

**2. [Rule 1 - Bug] react-day-picker v9 deprecated `table` classname**
- **Found during:** Task 2 TypeScript check
- **Issue:** shadcn-generated `calendar.tsx` used `table: "w-full border-collapse"` in classNames, but react-day-picker v9 renamed it to `month_grid`
- **Fix:** Replaced `table` key with `month_grid` in classNames object
- **Files modified:** src/components/ui/calendar.tsx
- **Commit:** bc2ea32

**3. [Rule 2 - Missing critical functionality] PatientTable `renderCell` typo**
- **Found during:** Task 2 TypeScript check
- **Issue:** `cell.column.columnDef.renderCell` does not exist in TanStack Table v8 API
- **Fix:** Changed to `cell.column.columnDef.cell` (the correct property)
- **Files modified:** PatientTable.tsx
- **Commit:** bc2ea32

**4. [Rule 2 - Missing critical functionality] Calendar `initialFocus` removed**
- **Found during:** Task 2 TypeScript check
- **Issue:** `initialFocus` prop was removed from react-day-picker v9
- **Fix:** Removed the prop; focus management handled by `modifiers.focused` in CalendarDayButton (already in shadcn component)
- **Files modified:** PatientForm.tsx
- **Commit:** bc2ea32

**5. [Rule 1 - Bug] FullCalendar type imports from wrong package**
- **Found during:** Task 3 TypeScript check
- **Issue:** `EventDropArg` and `DateSelectArg` are exported from `@fullcalendar/core`, not `@fullcalendar/interaction`
- **Fix:** Changed import to `import type { EventDropArg, DateSelectArg } from '@fullcalendar/core'`
- **Files modified:** AgendaCalendar.tsx
- **Commit:** 6bbfdb2

## Known Stubs

The following tabs in `/clinica/pacientes/[id]/page.tsx` are intentional dependency-wave stubs (not missing functionality — waiting for Plans 03/04):

| Stub | File | Reason |
|------|------|--------|
| Prontuário tab content | `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` | Delivered in Plan 02-03 (medical records + PDF) |
| Odontograma tab content | `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` | Delivered in Plan 02-03 (SVG odontogram) |
| Anamneses tab content | `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` | Delivered in Plan 02-04 (digital anamnesis) |

These stubs display "Disponível após Plano 0X" messages — they do NOT prevent the plan's goal (patient CRUD + agenda) from being achieved.

## Threat Flags

No new security surface introduced beyond what was planned in the threat model.

---

## Self-Check: PASSED

Files exist:
- `src/lib/validators/patient.ts` ✓
- `src/lib/validators/appointment.ts` ✓
- `src/actions/patients.ts` ✓
- `src/actions/appointments.ts` ✓
- `src/components/patients/PatientForm.tsx` ✓
- `src/components/patients/PatientTable.tsx` ✓
- `src/components/patients/PatientDeleteDialog.tsx` ✓
- `src/components/agenda/AgendaCalendar.tsx` ✓
- `src/app/(dashboard)/clinica/pacientes/page.tsx` ✓
- `src/app/(dashboard)/clinica/pacientes/novo/page.tsx` ✓
- `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` ✓
- `src/app/(dashboard)/clinica/agenda/page.tsx` ✓
- `src/__tests__/actions/patients.test.ts` ✓
- `src/__tests__/agenda/calendar.test.ts` ✓

Commits exist:
- `13ba9a8` test(02-02): validators + RED/GREEN tests ✓
- `cf398e1` feat(02-02): patients Server Actions ✓
- `bc2ea32` feat(02-02): patient UI pages + components ✓
- `6bbfdb2` feat(02-02): appointments + AgendaCalendar ✓

*Phase: 02-clinical-mvp*
*Completed: 2026-06-05*
