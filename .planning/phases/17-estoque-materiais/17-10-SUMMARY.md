---
phase: 17-estoque-materiais
plan: 10
subsystem: ui
tags: [prontuario, estoque, materiais, base-ui-select, gap-closure]

# Dependency graph
requires:
  - phase: 17-estoque-materiais (Plan 09)
    provides: MaterialsUsedSection.tsx (D-22) fully implemented but dormant; ProntuarioForm serviceId prop unwired
provides:
  - "Serviço realizado" selector inside ProntuarioForm, populated by listServices() (active services only)
  - selectedServiceId local state driving MaterialsUsedSection, closing the last Phase 17 verification gap
affects: [17-VERIFICATION.md (gap resolution), future prontuário procedure-selection work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@base-ui Select onValueChange(v ?? undefined) null-handling reused verbatim from MaterialsTemplateTab.tsx"
    - "Fetch-on-mount useEffect([]) client pattern for Server Action-backed option lists in client components"

key-files:
  created: []
  modified:
    - src/components/prontuario/ProntuarioForm.tsx

key-decisions:
  - "selectedServiceId state initialized from the existing serviceId prop (not replaced) — preserves backward compatibility for any future caller that passes serviceId directly"
  - "Service selector is UI-only, not an RHF field — kept out of the Zod schema/submit payload since D-22 material draw already happens server-side via appointments.ts, independent of this display"

patterns-established: []

requirements-completed: [EST-02]

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 17 Plan 10: Prontuário Service Selector (Gap Closure) Summary

**Added a "Serviço realizado" Select to ProntuarioForm, wired to local state that now feeds the previously-dormant MaterialsUsedSection component, making D-22 observable in the live app.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T19:41:00Z
- **Completed:** 2026-07-11T19:54:53Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments
- ProntuarioForm now fetches active services via `listServices()` on mount and renders a "Serviço realizado (opcional)" Select using the established @base-ui Select pattern (`onValueChange(v ?? undefined)`, matching `MaterialsTemplateTab.tsx`).
- `MaterialsUsedSection` is now wired to `selectedServiceId` (local state) instead of the dormant `serviceId` prop, so selecting a service with configured `service_material_templates` reveals the materials list with editable qty and estimated cost — closing the Phase 17 verification gap.
- Zero regressions: `createMedicalRecord` submit flow, the "Ao menos um campo deve ser preenchido" refine, and `window.location.reload()` behavior are all untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Seletor "Serviço realizado" + estado selectedServiceId em ProntuarioForm** - `5a4dd62` (feat)

**Plan metadata:** (this commit, see final_commit step)

## Files Created/Modified
- `src/components/prontuario/ProntuarioForm.tsx` - Added `listServices` import, `@base-ui` Select imports, `ServiceOption` type, `services`/`selectedServiceId` state, fetch-on-mount `useEffect`, the service Select UI block, and rewired `<MaterialsUsedSection serviceId={selectedServiceId} />`

## Decisions Made
- `selectedServiceId` initializes from the existing `serviceId` prop rather than discarding it, preserving compatibility with any future caller that supplies it directly.
- The service selector is deliberately kept outside the RHF-managed `prontuarioFormSchema` / `createMedicalRecord` payload — it is purely a UI-level trigger for the informative `MaterialsUsedSection` display; the real stock draw already happens server-side in `appointments.ts → drawMaterialsForProcedures` regardless of this UI (SC #2, verified in Plan 09/17-VERIFICATION.md).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 17 verification gap closed: the "Materiais Utilizados" prontuário section (D-22) is now reachable by dentists — selecting a service with configured templates reveals editable materials with estimated cost.
- No DB/schema/migration changes; this was a single-file additive frontend change.
- A future phase may wire a formal procedure/appointment-selection step into ProntuarioForm (replacing the standalone service Select with an actual appointment_procedures-linked flow) — not required for this gap closure, and no blocker exists today.

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: src/components/prontuario/ProntuarioForm.tsx
- FOUND: .planning/phases/17-estoque-materiais/17-10-SUMMARY.md
- FOUND commit: 5a4dd62
