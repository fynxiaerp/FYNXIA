---
phase: quick-260719-1wv
plan: 01
subsystem: ui
tags: [nextjs, zustand, fullcalendar, react, agenda]

# Dependency graph
requires:
  - phase: 11-profissionais-recursos
    provides: AgendaCalendar (FullCalendar-based week view) and createAppointment/updateAppointment Server Actions
provides:
  - Always-visible AgendaCalendar on /clinica/agenda regardless of appointment count
  - Functional "Nova Consulta" header button wired to the calendar's creation dialog via a Zustand trigger store
  - Dentist-independent creation dialog (dentist/date/time all editable inline)
affects: [agenda, clinica]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot Zustand trigger store (open/action/reset) to connect a Server Component-rendered button to a client component's local dialog state, without lifting all dialog state into global store"

key-files:
  created:
    - src/lib/stores/new-appointment-store.ts
    - src/components/agenda/NewAppointmentButton.tsx
  modified:
    - src/app/(dashboard)/clinica/agenda/page.tsx
    - src/components/agenda/AgendaCalendar.tsx

key-decisions:
  - "One-shot Zustand trigger store (open/openDialog/reset) connects the Server Component header button to AgendaCalendar's local dialog state — avoids moving all dialog state to global store"
  - "computeNextSlot() lives at module scope in AgendaCalendar.tsx (pure function, no props needed) — rounds up to next 15-min boundary, clamps into business hours 07:00-19:45, defaults to 30-min duration"
  - "NewAppointmentDialog upgraded from read-only dentist+time display to editable Select (dentist) + <input type=date/time> (date/start/end), matching the bug's requirement to pick dentist/date/time manually"

requirements-completed: [CLINIC-02]

# Metrics
duration: ~15min
completed: 2026-07-19
---

# Phase quick-260719-1wv: Fix Agenda "Nova Consulta" Bug Summary

**Always-visible AgendaCalendar + functional "Nova Consulta" header button wired via a Zustand trigger store to a dentist-independent creation dialog with editable date/time.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-19T04:20:00Z (approx)
- **Completed:** 2026-07-19T04:36:14Z
- **Tasks:** 2 of 3 (Task 3 is `checkpoint:human-verify`, handled separately by the orchestrator via Playwright against production)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `/clinica/agenda` now always renders the FullCalendar week grid — the `events.length === 0 ? EmptyState : AgendaCalendar` conditional (defect #1) was removed; the calendar is unconditional.
- The "Nova Consulta" header button (previously decorative, no `onClick`) now opens the creation dialog via a new `useNewAppointmentStore` trigger — matching what clicking an empty calendar slot already did.
- The creation dialog no longer requires a pre-selected dentist: `handleSelect`'s early-return-on-missing-dentist was removed, and the dialog gained an inline dentist `Select` plus editable date/start/end `Input` fields, so a brand-new clinic (zero appointments, no dentist filtered) can create its first consulta entirely from the dialog.
- Added a subtle muted-text hint ("Nenhuma consulta esta semana — clique em um horário ou em 'Nova Consulta' para agendar.") above the calendar when the current week has zero events, replacing the removed page-level `EmptyState` without hiding the calendar.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add trigger store + functional header button, and always render the calendar** - `65815e8` (feat)
2. **Task 2: Wire calendar to the store trigger + make dentist/date/time selectable in the dialog** - `4cbbde8` (feat)

_Task 3 (`checkpoint:human-verify`) intentionally not executed in this session — deferred to the orchestrator's post-deploy Playwright verification against production, per plan constraints._

## Files Created/Modified
- `src/lib/stores/new-appointment-store.ts` - Minimal Zustand trigger store (`open`/`openDialog`/`reset`), following the `copilot-store.ts` convention
- `src/components/agenda/NewAppointmentButton.tsx` - `'use client'` button that calls `openDialog()` on click; carries the exact visual markup previously inline in `page.tsx`
- `src/app/(dashboard)/clinica/agenda/page.tsx` - Header button replaced with `<NewAppointmentButton />`; `AgendaCalendar` now renders unconditionally (removed the `events.length === 0` gate and the `EmptyState`/`CalendarX`/`Button`/`Plus` imports that became unused)
- `src/components/agenda/AgendaCalendar.tsx` - Subscribes to `useNewAppointmentStore`; added module-scope `computeNextSlot()` helper; `handleSelect` no longer blocks on missing dentist filter; `NewAppointmentDialog` rewritten with a dentist `Select` + editable date/start/end time `Input`s (was read-only text + required `dentistId` prop); added empty-week hint text

## Decisions Made
- **Trigger store over global dialog state:** kept all dialog visibility/data local to `AgendaCalendar` (client component); the Zustand store only carries a one-shot `open` boolean that the calendar's `useEffect` consumes and immediately resets. This avoids threading full dialog state (open/startTime/endTime/dentist) through global state and keeps `AgendaCalendar` as the single owner of its dialog once triggered.
- **`computeNextSlot()` as a pure, prop-free helper:** since the header button has no "clicked slot" context (unlike a calendar slot click), a deterministic default (next 15-min boundary, clamped 07:00–19:45, 30-min duration, next business day if after hours) gives the dialog a sane starting point that the user can still edit before submitting.
- **Dialog fields switched from read-only display to `Select`/`Input type=date|time`:** required by the bug's stated need to let the user "escolher data/hora/dentista/paciente manualmente" when no dentist is pre-filtered — matches the plan's exact field/prop rename spec (`dentistId: string` → `initialDentistId: string | null`, plus `dentists` prop).

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2. `patient_id` was correctly kept out of the `createAppointment` payload (unlinked, title-only), matching current shipped behavior per plan instructions.

## Issues Encountered
None.

## Known Stubs
None — both defects are fully wired to the real `createAppointment` Server Action; no hardcoded/mock data was introduced.

## Threat Flags
None — no new network endpoints, auth paths, or schema changes were introduced. The dialog's expanded editable fields (dentist_id/date/time) route through the same `createAppointment` Server Action, which already enforces `appointmentSchema.safeParse`, role gating, tenant RLS, and the GIST exclusion constraint (see plan's `<threat_model>` T-1wv-01/T-1wv-02, both dispositioned `accept`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tasks 1 and 2 are complete, committed, and pass `npx tsc --noEmit` (no new errors in touched files — pre-existing unrelated test-file errors are out of scope) and `npm run build` (succeeds cleanly).
- **Task 3 (`checkpoint:human-verify`) is pending** — the orchestrator will run the manual/Playwright verification steps against production after this session's commits are pushed and deployed:
  1. Confirm the FullCalendar week grid is visible on a zero-appointment week.
  2. Confirm "Nova Consulta" opens a `[role=dialog]` with dentist Select + editable date/time.
  3. Confirm submitting creates the appointment and it renders on the calendar.
  4. Confirm clicking an empty slot with no dentist filtered still opens the same dialog.

---
*Phase: quick-260719-1wv*
*Completed: 2026-07-19*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (65815e8, 4cbbde8) verified present in git log.
