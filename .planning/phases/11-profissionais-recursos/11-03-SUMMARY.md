---
phase: 11-profissionais-recursos
plan: "03"
subsystem: resources-scheduling
tags: [resources, waiting-room, realtime, checkin, migration, database, pure-lib]
dependency_graph:
  requires: [11-01]
  provides: [resources-table, appointment-extension, realtime-pub, isResourceAvailable, waitingMinutes, resourceSchema]
  affects: [11-04, 11-05, 11-08]
tech_stack:
  added: []
  patterns:
    - ADD COLUMN nullable (no backfill) for appointment extension
    - SEPARATE presence_status column (not folded into existing status — Pitfall 1 guard)
    - PURE lib pattern (no server-only, importable client/server/test)
    - Zod v3 no-.default() (D-133/D-158)
    - RLS USING+WITH CHECK with admin/superadmin write gate
key_files:
  created:
    - supabase/migrations/20260617000300_resources.sql
    - supabase/migrations/20260617000400_resources_rls.sql
    - supabase/migrations/20260617000500_appointment_resource_checkin.sql
    - supabase/migrations/20260617000600_appointments_realtime.sql
    - src/lib/scheduling/resources.ts
    - src/lib/scheduling/waiting.ts
    - src/lib/validators/resource.ts
  modified: []
decisions:
  - "presence_status added as SEPARATE column — not folded into existing status enum to preserve GIST WHERE clause (Pitfall 1)"
  - "All 5 new appointment columns are nullable with no backfill — resource/presence genuinely optional on existing rows"
  - "isResourceAvailable/waitingMinutes/isValidPresenceTransition are PURE fns (no server-only) so the TV panel can import client-side"
  - "Realtime migration is additive-only (ALTER PUBLICATION ADD TABLE) applied once via Plan 05 db push"
  - "Resource conflicts app-level only (no resource GIST) — research Pattern 3 / Open Question Q1 resolved"
metrics:
  duration_minutes: 4
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 11 Plan 03: Resources + Appointment Extension + Realtime — Summary

**One-liner:** resources table (tipo/status/patrimonio) + appointment extension (resource_id FK + presence_status SEPARATE column + 4 timestamps) + supabase_realtime publication + pure isResourceAvailable/waitingMinutes/isValidPresenceTransition libs + resourceSchema Zod v3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | resources + appointment-extension + realtime migrations (4 files) | ab90856 | 4 SQL migrations |
| 2 | isResourceAvailable + waitingMinutes pure libs + resource Zod schema (TDD) | 189c56d | 3 TS files |

## Tests Turned GREEN

### resources.test.ts (Plan 03 scope assertions)
- Phase 11 migration — resources table (RES-01): 10 assertions GREEN
- Phase 11 migration — resources RLS (Access Control): 6 assertions GREEN
- Phase 11 migration — appointment resource_id FK (RES-02): 2 assertions GREEN (GIST guard GREEN)
- Phase 11 — isResourceAvailable pure-unit (RES-01/RES-02): 5 assertions GREEN

### waiting-room.test.ts (Plan 03 scope assertions)
- Phase 11 migration — presence_status column (RES-03): 6 assertions GREEN
- Phase 11 migration — appointments Realtime publication (RES-03): 1 assertion GREEN
- Phase 11 — waitingMinutes pure-unit (RES-03): 3 assertions GREEN
- Phase 11 — presence transition ordering (RES-03): 5 assertions GREEN

### phase11.test.ts (regression guard)
- REGRESSION: appointments GIST + status CHECK unchanged: 6 assertions GREEN (no DROP CONSTRAINT no_overlap in any migration)
- Phase 11 migration — resources table (RES-01): 10 assertions GREEN
- Phase 11 migration — resources RLS (Access Control): 5 assertions GREEN
- Phase 11 migration — appointment resource + checkin columns (RES-02/RES-03): 9 assertions GREEN
- Phase 11 migration — appointments realtime publication (RES-03): 1 assertion GREEN

### Still RED (by design — other plans)
- `resources.ts action` (assertNotReadOnly + logBusinessEvent): Plan 04
- `appointments.ts resource_id` in createAppointment: Plan 04
- `checkin.ts action` (timestamps + presence_status): Plan 04
- `proxy.ts /painel` isPublicRoute: Plan 04
- `/painel page LGPD compliance` (presence_status + initials): Plan 08

## TypeScript
`npx tsc --noEmit`: exit 0 — clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text in migration triggered test regex**
- **Found during:** Task 1 verification
- **Issue:** The guard comment in `20260617000500_appointment_resource_checkin.sql` originally read "This file MUST NOT contain DROP CONSTRAINT no_overlap" — the test uses a case-insensitive regex `/DROP CONSTRAINT no_overlap/i` scanning all file content including comments, which matched.
- **Fix:** Reworded the comment to "This file must not drop the no_overlap constraint" — preserves intent without matching the forbidden regex.
- **Files modified:** supabase/migrations/20260617000500_appointment_resource_checkin.sql
- **Commit:** ab90856 (same commit — fix applied before commit)

## Threat Coverage (T-11-10/11/12)

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-11-10 | presence_status SEPARATE column; no DROP CONSTRAINT / ALTER COLUMN status; regression guard GREEN |
| T-11-11 | resources RLS: USING(clinic_id = get_my_tenant_id()) + WITH CHECK |
| T-11-12 | Write policy gated to admin/superadmin only |
| T-11-13 | Accepted — app-level overlap check deferred to Plan 04; dental clinic concurrency low |

## Known Stubs

None. This plan delivers migrations (not pushed yet — Plan 05) and pure libs. No UI stubs.

## Self-Check: PASSED

Files exist:
- supabase/migrations/20260617000300_resources.sql: FOUND
- supabase/migrations/20260617000400_resources_rls.sql: FOUND
- supabase/migrations/20260617000500_appointment_resource_checkin.sql: FOUND
- supabase/migrations/20260617000600_appointments_realtime.sql: FOUND
- src/lib/scheduling/resources.ts: FOUND
- src/lib/scheduling/waiting.ts: FOUND
- src/lib/validators/resource.ts: FOUND

Commits:
- ab90856: FOUND (migrations task 1)
- 189c56d: FOUND (pure libs task 2)
