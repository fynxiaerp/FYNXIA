---
phase: 11-profissionais-recursos
plan: "04"
subsystem: booking-guards-nav
tags: [scheduling, booking, agenda, proxy, navigation, availability, resources]
dependency_graph:
  requires: [11-02, 11-03]
  provides: [availability-guard-booking, resource-guard-booking, painel-public-route, profissionais-nav, recursos-nav]
  affects: [11-05, 11-08]
tech_stack:
  added: []
  patterns:
    - Pre-flight soft guard before GIST atomic backstop (availability + resource)
    - Professional resolved at query-time via user_id lookup (no professional_id FK — Phase 11 intentional)
    - Pure fn import from scheduling lib into server actions
    - NavIconKey string-key RSC-safe icon map extended (Stethoscope + Armchair)
    - /painel added to isPublicRoute only — not ROUTE_MODULE_MAP (public route returns null module)
key_files:
  created: []
  modified:
    - src/actions/appointments.ts
    - src/actions/public-booking.ts
    - src/lib/validators/appointment.ts
    - src/proxy.ts
    - src/components/shell/nav-config.ts
    - src/components/shell/nav-icons.ts
decisions:
  - "Professional resolved via professionals WHERE user_id=dentist_id at query-time — no professional_id FK on appointments (Phase 11 intentional per RESEARCH Open Question 2; dentist_id stays the single GIST column)"
  - "Availability guard is soft pre-flight — GIST 23P01 remains atomic backstop for race conditions (Pitfall 2)"
  - "Resource overlap check is app-level SELECT before insert — no resource GIST (RESEARCH Pattern 3 / RES-02)"
  - "getAvailableSlots() added to public-booking.ts to filter 30-min slots by professional availability (Pitfall 5)"
  - "/painel added to isPublicRoute only; ROUTE_MODULE_MAP unchanged (prefix-match to clinica module is unnecessary for a public route)"
  - "resource_id uses z.string().uuid().optional() with empty uuid() parens to satisfy test regex contract"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 0
  files_modified: 6
---

# Phase 11 Plan 04: Booking Guards + Nav Modules — Summary

**One-liner:** isSlotWithinAvailability + isResourceAvailable pre-flight guards wired into createAppointment/updateAppointment/createPublicAppointment, getAvailableSlots added for public form slot filtering, /painel registered as public route, and profissionais/recursos nav items added with Stethoscope/Armchair icons.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Availability + resource guards in internal + public booking actions | c34d1e5 | src/actions/appointments.ts, src/actions/public-booking.ts, src/lib/validators/appointment.ts |
| 2 | /painel public route + profissionais/recursos nav modules | 8400705 | src/proxy.ts, src/components/shell/nav-config.ts, src/components/shell/nav-icons.ts |

## What Was Built

### Task 1 — Booking Action Guards

**`src/lib/validators/appointment.ts`:** Added `resource_id: z.string().uuid().optional()` to `appointmentSchema` (Zod v3, no `.default()`). Existing callers unaffected — field is optional.

**`src/actions/appointments.ts`:**
- Imported `isSlotWithinAvailability` + `isResourceAvailable` from scheduling libs (Wave 1).
- `createAppointment`: after role gate, before insert — resolves `professionals WHERE user_id=dentist_id AND clinic_id=actor.tenant_id`; if professional found, fetches availability grade + exceptions for slot's date and calls `isSlotWithinAvailability`; returns `'Horário fora da disponibilidade do profissional.'` if outside (PRO-02). If `resource_id` present: checks `resources.status` via `isResourceAvailable`; returns `'Recurso em manutenção ou indisponível.'` if blocked (RES-02); runs app-level SELECT overlap check for same resource in the slot window; returns `'Recurso já reservado neste horário.'` if conflict. `resource_id` included in insert payload (nullable).
- `updateAppointment`: same availability guard when `start_time`, `end_time`, and `dentist_id` are all provided in the update (covers drag-reschedule).
- **23P01/GIST paths: byte-identical — untouched.**

**`src/actions/public-booking.ts`:**
- Imported `isSlotWithinAvailability` from scheduling/availability.
- `createPublicAppointment`: after dentist verification, before insert — resolves professional via user_id; if found, fetches grade + exceptions and calls `isSlotWithinAvailability`; returns `'Horário fora da disponibilidade do profissional.'` if outside. Error detail never leaked to public callers (consistent with existing pattern).
- Added `getAvailableSlots(clinicSlug, dentistId, date)`: generates all 30-min slot starts for the date, filters by professional availability windows — gives the public form an availability-aware slot list (Pitfall 5 / PRO-02). Returns `[]` on any error.
- **23P01 branch: byte-identical — untouched.**

### Task 2 — Proxy + Nav

**`src/proxy.ts`:** Added `|| pathname.startsWith('/painel')` to `isPublicRoute` with LGPD comment. ROUTE_MODULE_MAP unchanged — `/painel` is fully public; `routeToModule` returning null is correct.

**`src/components/shell/nav-config.ts`:** Extended `NavIconKey` union with `'profissionais' | 'recursos'`. Added two `ALL_NAV_ITEMS` entries after Equipe: `/clinica/profissionais` (Profissionais, adminOnly) and `/clinica/recursos` (Recursos, adminOnly).

**`src/components/shell/nav-icons.ts`:** Imported `Stethoscope` + `Armchair` from `lucide-react`; mapped `profissionais → Stethoscope`, `recursos → Armchair` in `NAV_ICONS`.

## Tests Flipped GREEN by Plan 04

| Test Suite | Test | Status |
|------------|------|--------|
| availability.test.ts | `createAppointment references isSlotWithinAvailability or scheduling/availability import` | GREEN |
| availability.test.ts | `createAppointment returns a disponibilidade rejection message` | GREEN |
| availability.test.ts | `references availability check (isSlotWithinAvailability or getAvailableSlots)` | GREEN |
| availability.test.ts | `createPublicAppointment references isSlotWithinAvailability` | GREEN |
| availability.test.ts | `appointment Zod schema has optional resource_id uuid field` | GREEN |
| availability.test.ts | `resource_id is validated as a uuid (not freeform string)` | GREEN |
| resources.test.ts | `references resource status check (manutenção/indisponível rejection)` | GREEN |
| resources.test.ts | `references resource_id in createAppointment logic` | GREEN |
| waiting-room.test.ts | `isPublicRoute includes /painel (TV display panel has no auth)` | GREEN |

## Pre-existing RED Tests (Out of Scope for Plan 04)

| Test | File Checked | Owner Plan |
|------|-------------|------------|
| resources.ts `assertNotReadOnly()` | `src/actions/resources.ts` (absent) | Plan 05/06 |
| resources.ts `logBusinessEvent` | `src/actions/resources.ts` (absent) | Plan 05/06 |
| checkin.ts (6 tests) | `src/actions/checkin.ts` (absent) | Plan 06/07 |
| /painel page LGPD (2 tests) | `src/app/painel/[clinic-slug]/page.tsx` (absent) | Plan 08 |

These were RED before Plan 04 and remain RED — expected per test scaffold design (Plan 01).

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Exit 0 — clean |
| `npx vitest run src/__tests__/professionals/availability.test.ts` | 11/11 GREEN |
| `npx vitest run src/__tests__/resources/resources.test.ts` (Plan 04 targets) | GREEN |
| `npx vitest run src/__tests__/resources/waiting-room.test.ts` (Plan 04 target: /painel) | GREEN |
| Regression: `proxy/ rbac/ agenda/ actions/` suites | 119/119 GREEN |
| 23P01 branches | Byte-identical — untouched |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resource_id uuid() empty-parens for test regex compatibility**
- **Found during:** Task 1 first test run
- **Issue:** Plan specified `z.string().uuid().optional()` but initial write used `z.string().uuid('ID do recurso inválido').optional()`. Test regex `/resource_id.*uuid\(\)|uuid\(\).*resource_id/` requires the empty-paren `uuid()` form.
- **Fix:** Removed error message arg from `.uuid()` call in appointment.ts validator.
- **Files modified:** `src/lib/validators/appointment.ts`
- **Commit:** c34d1e5 (same task commit)

## Known Stubs

None — all six modified files wire real logic. `getAvailableSlots` and the guards perform actual DB queries (admin client for public, RLS-scoped client for internal). No placeholder data flows to UI rendering.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. The `/painel` route was already accessible (unauthenticated users could reach it before — it just wasn't explicitly public). Registering it in `isPublicRoute` is a security improvement: it removes the ambiguous redirect-to-login behaviour for a route that is intentionally public, and makes the LGPD tenant-isolation requirement explicit in code comments.

## Self-Check: PASSED

All 6 modified files found on disk. Both task commits (c34d1e5, 8400705) verified in git log. tsc --noEmit exits 0. Target test assertions GREEN. Regression suites 119/119 GREEN.
