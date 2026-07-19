---
phase: quick-260719-goi
plan: 01
subsystem: api
tags: [supabase, appointments, multi-unit, bugfix, critical]

requires:
  - phase: 07-sistema-multiunidade-papeis
    provides: "appointments.unit_id NOT NULL (SYS-05) + units table with is_default"
provides:
  - "createAppointment resolves and inserts unit_id (professional's unit, falling back to clinic default unit)"
  - "createPublicAppointment resolves and inserts unit_id (same fallback logic, via admin/service-role client)"
affects: [appointments, agenda, public-booking, os-01-auto-invoicing]

tech-stack:
  added: []
  patterns:
    - "resolveAppointmentUnitId(client, clinicId, professionalUnitId) local helper — prefer professional.unit_id, else query units ORDER BY is_default DESC, name LIMIT 1 (mirrors resolveDefaultUnitId in leads.ts, D-246)"

key-files:
  created: []
  modified:
    - src/actions/appointments.ts
    - src/actions/public-booking.ts

key-decisions:
  - "resolveAppointmentUnitId duplicated locally in both files (not extracted to a shared lib) — mirrors the existing convention where leads.ts already keeps its own local copy of the same logic; CLAUDE.md discourages abstractions beyond what's needed"
  - "Guard returns friendly error 'Nenhuma unidade cadastrada para esta clínica.' when no unit resolves, instead of letting the NOT NULL constraint raise a raw DB error"

patterns-established:
  - "Any future appointments insert path must resolve unit_id via resolveAppointmentUnitId before writing — do not add unit_id: null or omit the field"

requirements-completed: [BUGFIX-appointments-unit_id]

duration: ~15min
completed: 2026-07-19
---

# Quick Task 260719-goi: Corrigir bug crítico — appointments.unit_id NOT NULL Summary

**Ambos os pontos de criação de consulta (interno e público) agora resolvem `unit_id` (unidade do profissional, ou unidade padrão da clínica) antes do insert, corrigindo a falha NOT NULL que bloqueava 100% da criação de consultas em produção.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (Task 3 is a checkpoint:human-verify — deferred to orchestrator/Playwright against production)
- **Files modified:** 2

## Accomplishments
- `createAppointment` (src/actions/appointments.ts): query de `professional` agora seleciona `unit_id`; novo helper `resolveAppointmentUnitId` resolve o `unit_id` a inserir (profissional → unidade padrão da clínica); guard amigável se nenhuma unidade existir; insert inclui `unit_id: resolvedUnitId`.
- `createPublicAppointment` (src/actions/public-booking.ts): mesmo padrão aplicado via `admin` (service-role) client — cópia local do helper, mesma lógica de fallback e guard.
- `npx tsc --noEmit` e `npx next build` limpos para ambos os arquivos alterados (erros pré-existentes em arquivos de teste `__tests__/**` não relacionados a este bugfix, fora de escopo).

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolver e inserir unit_id em createAppointment (fluxo interno)** - `1e8c69f` (fix)
2. **Task 2: Resolver e inserir unit_id em createPublicAppointment (agendamento público)** - `acd5286` (fix)

_Task 3 (`checkpoint:human-verify`) was intentionally NOT executed by this agent — the orchestrator runs it via Playwright against production after deploy, confirming a real DB insert succeeds for both flows._

## Files Created/Modified
- `src/actions/appointments.ts` - Added `resolveAppointmentUnitId` helper; `professional` query now selects `unit_id`; insert now includes `unit_id: resolvedUnitId`; guard returns friendly error when no unit exists.
- `src/actions/public-booking.ts` - Added local copy of `resolveAppointmentUnitId` (admin-client typed); `professional` query now selects `unit_id`; insert now includes `unit_id: resolvedUnitId`; same guard.

## Decisions Made
- Duplicated the unit-resolution helper locally in each file rather than creating a new shared module — mirrors the existing `leads.ts` convention (`resolveDefaultUnitId`, D-246) and avoids introducing a new shared abstraction per CLAUDE.md guidance.
- Verified schema assumption before writing any code: `professionals.unit_id` is a nullable FK to `units(id)` (confirmed in `supabase/migrations/20260617000100_professionals.sql`), and `appointments.unit_id` is NOT NULL with an index (confirmed in `supabase/migrations/20260614000700_operational_unit_id.sql`) — matches the plan's assumed shape exactly, no schema drift.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2.

## Issues Encountered

None. Pre-existing `tsc` errors were found in unrelated test files (`src/__tests__/faturamento/tiss.test.ts`, `src/__tests__/financeiro/*.test.ts`, `src/lib/financeiro/__tests__/*.test.ts`) — confirmed via `grep` that none reference `appointments.ts` or `public-booking.ts`. These are out of scope per the deviation rules' scope boundary (not caused by this task's changes) and were left untouched.

## User Setup Required

None - no external service configuration required. This is a pure code fix against an already-existing, already-migrated schema.

## Next Phase Readiness

- Code fix complete and committed; `tsc`/`build` green.
- **Blocking for full resolution:** deploy to production, then run the Task 3 `checkpoint:human-verify` — confirm a real internal appointment insert AND a real public appointment insert both write successfully with non-null `unit_id` (via Playwright against production, per plan's `<how-to-verify>` steps 1-5).
- No architectural changes; no new dependencies; no migration needed (schema was already correct — only the application code was missing the field).

---
*Quick task: 260719-goi*
*Completed: 2026-07-19*

## Self-Check: PASSED

All claimed files exist (`src/actions/appointments.ts`, `src/actions/public-booking.ts`, this SUMMARY.md) and both task commits (`1e8c69f`, `acd5286`) are present in git history.
