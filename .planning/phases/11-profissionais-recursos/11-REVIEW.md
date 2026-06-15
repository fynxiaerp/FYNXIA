---
phase: 11-profissionais-recursos
reviewed: 2026-06-15T01:12:07Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - supabase/migrations/20260617000100_professionals.sql
  - supabase/migrations/20260617000200_professionals_rls.sql
  - supabase/migrations/20260617000300_resources.sql
  - supabase/migrations/20260617000400_resources_rls.sql
  - supabase/migrations/20260617000500_appointment_resource_checkin.sql
  - supabase/migrations/20260617000600_appointments_realtime.sql
  - src/lib/scheduling/availability.ts
  - src/lib/scheduling/resources.ts
  - src/lib/scheduling/waiting.ts
  - src/lib/scheduling/panel.ts
  - src/lib/validators/professional.ts
  - src/lib/validators/resource.ts
  - src/lib/validators/appointment.ts
  - src/actions/professionals.ts
  - src/actions/resources.ts
  - src/actions/checkin.ts
  - src/actions/appointments.ts
  - src/actions/public-booking.ts
  - src/components/professionals/ProfessionalForm.tsx
  - src/components/professionals/AvailabilityGrid.tsx
  - src/components/resources/ResourceForm.tsx
  - src/components/agenda/CheckinControls.tsx
  - src/components/painel/WaitingPanel.tsx
  - src/app/painel/[clinic-slug]/page.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-15T01:12:07Z
**Depth:** deep
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 11 (Profissionais & Recursos) is a strong, security-conscious implementation. The
focus-area audit passed on the highest-stakes points:

- **SACRED GIST — CLEAN.** No Phase 11 migration touches `CONSTRAINT no_overlap` or
  `ALTER COLUMN status`. `20260617000500` adds `presence_status` as a genuinely separate
  column with its own CHECK, plus `resource_id` and four nullable `*_at` timestamps. The
  GIST remains the atomic backstop; the resource overlap check is purely additive at the
  app layer (verified in `appointments.ts:121-132` and `public-booking.ts`). Both internal
  and public insert paths still capture `23P01`.
- **LGPD on /painel — CLEAN on the leakage axis.** `PanelRow` (panel.ts:16-22) contains only
  `id`, `presence_status`, `initials`, `arrived_at`, `called_at`. Both the SSR page and
  `getPanelRows` compute `toInitials()` server-side and never forward `full_name`; `cpf` is
  never selected. The Realtime channel is tenant-filtered (`tenant_id=eq.<clinicId>`).
- **RLS — CLEAN.** All three professional tables + resources pair `USING` with `WITH CHECK`,
  gate writes to `admin/superadmin`, scope by `clinic_id = get_my_tenant_id()`, and index
  `clinic_id` (+ `unit_id`). `professionals.user_id` is nullable with a correct partial unique
  index (`clinic_id, user_id WHERE user_id IS NOT NULL AND deleted_at IS NULL`).
- **Server-action hygiene — CLEAN.** All `'use server'` files export only async functions
  (no re-export trap). Every mutation runs `assertNotReadOnly` + role gate + tenant scope
  + `logBusinessEvent`. Check-in transitions validated via `isValidPresenceTransition`.

The issues below are correctness/robustness concerns, not data leaks or GIST regressions.
The two most material are WR-01 (public-panel Realtime will not actually fire under anon RLS)
and WR-02 (the public-booking audit event silently never writes due to a bad `actorId`).

## Warnings

### WR-01: Public /painel Realtime subscription receives zero events under anon RLS — panel is not actually live

**File:** `src/components/painel/WaitingPanel.tsx:78-101` (subscription) and `src/app/painel/[clinic-slug]/page.tsx` (public route)
**Issue:** The panel is a public, sessionless route (`proxy.ts:139-143` marks `/painel` public).
`WaitingPanel` subscribes to `postgres_changes` on `appointments` using the browser anon
client (`@/lib/supabase/client`, line 79). Supabase Realtime `postgres_changes` enforces the
table's RLS against the subscribing connection. The `appointments` SELECT policy is
`tenant_id = get_my_tenant_id()` (`20260605000200_clinical_rls.sql:16-17`); for an
unauthenticated anon connection `get_my_tenant_id()` is NULL, so the policy matches no rows
and **no change events are delivered**. Result: after the initial SSR render the panel never
auto-refreshes on check-in transitions — the 30s `setTick` only re-renders existing
`waitingMinutes` counters (line 71-75); it does not refetch. The "atualizado em tempo real"
footer is misleading. This is a functional break of RES-03's core promise, not a security
hole (RLS is correctly closing the door).
**Fix:** Decouple refresh from Realtime delivery on the public route. Simplest robust fix —
add a polling refetch alongside the tick, e.g.:
```ts
// in useQuery options
refetchInterval: 15_000, // public panel: poll getPanelRows (admin-client) every 15s
```
Then the `getPanelRows` server action (which already uses the admin client and is tenant-
isolated by slug) drives updates regardless of anon RLS. Optionally keep the Realtime channel
for authenticated reception screens, but do not rely on it for the public TV. Alternatively,
add a narrowly-scoped Realtime authorization (Supabase Realtime RLS / a public read policy
restricted to non-PII columns) — heavier and riskier than polling for this use case.

### WR-02: `createPublicAppointment` audit event is silently dropped (`actorId: 'system'` is not a UUID)

**File:** `src/actions/public-booking.ts:233-238`
**Issue:** `logBusinessEvent` inserts `actor_id` into `audit_logs.actor_id`, which is typed
`UUID` and is nullable specifically "NULL for system events"
(`20260603000000_initial_schema.sql:58`). The call passes the literal string `'system'`.
Postgres will reject it with `22P02 invalid_input_syntax for type uuid`; `logBusinessEvent`
swallows the error (`audit.ts:17-23`, no throw). Net effect: **every public appointment is
created with no audit record**, which is an LGPD/traceability gap for the public booking flow.
(Note: `src/actions/anamneses.ts:178` has the identical pre-existing bug — same fix applies,
out of strict Phase 11 scope but worth a follow-up.)
**Fix:** Pass `null` for system/sessionless events, matching the column contract:
```ts
await logBusinessEvent({
  tenantId: clinic.id,
  actorId: null, // public/sessionless action — audit_logs.actor_id is nullable for system events
  action: 'appointment.public_created',
  details: { appointment_id: appointment!.id, clinic_id: clinic.id },
})
```

### WR-03: Availability slot generation/checking uses UTC wall-clock while windows are entered as Brazil local time — silent off-by-3h mismatch

**File:** `src/actions/public-booking.ts:311-328` (`getAvailableSlots`), `src/lib/scheduling/availability.ts:66-71,114-120`
**Issue:** `AvailabilityGrid` collects window times via `<input type="time">` (e.g. `08:00`),
which an admin enters as **Brazil local** working hours. But `isSlotWithinAvailability`
extracts the slot's hour with `getUTCHours()` (availability.ts:67), and `getAvailableSlots`
generates candidate slots as `${date}T${hh}:${mm}:00Z` (UTC, line 318). So a window stored as
`08:00–18:00` is compared against UTC slot times. With Brazil at UTC-3, a real 08:00 BRT
appointment arrives as `11:00Z` and is checked against the `08:00` window string — it will be
treated as outside the morning window (or inside an unintended one). This also disagrees with
the sibling action `getBookedSlots`, which correctly anchors the day range in `-03:00`
(public-booking.ts:56-58). The two helpers use different timezone conventions for the same
calendar day. Because the guard is "additive" (no professional row → no gate), this won't
hard-fail bookings, but it will offer/accept the wrong slots whenever a professional row with
availability exists.
**Fix:** Standardize on Brazil wall-clock for availability math. Either (a) convert slot
boundaries with `date-fns-tz` (`toZonedTime(..., 'America/Sao_Paulo')`) before extracting
weekday/HH:MM in `availability.ts`, or (b) generate candidate slots in `getAvailableSlots`
using the `-03:00` offset (mirroring `getBookedSlots`) and have `isSlotWithinAvailability`
read local components consistently. Pick one convention and document it; the current mix of
`getUTCDay/getUTCHours` (lib) and `Z` slots (action) vs `-03:00` (getBookedSlots) is the root
problem. Add a test that an 08:00 BRT slot matches an `08:00–18:00` window.

### WR-04: `updateAppointment` skips the availability AND resource guards on drag-to-reschedule (no `dentist_id` in payload)

**File:** `src/actions/appointments.ts:208-248` (availability), and absence of a resource guard in the update path
**Issue:** Two gaps versus `createAppointment`:
1. The availability pre-flight only runs when `effectiveDentistId = input.dentist_id` is
   present (line 214-216). The common drag-to-reschedule path sends `start_time`/`end_time`
   only (no `dentist_id`), so `effectiveDentistId` is undefined and the whole availability
   check is skipped — a reschedule can move an appointment outside the professional's working
   hours / onto a `folga`. The inline comment acknowledges this ("we only gate when the caller
   provides a dentist_id").
2. There is **no resource-availability or resource-overlap guard** in `updateAppointment` at
   all, even though `resource_id` can be changed (line 204). A reschedule/resource swap can
   place two appointments on the same resource at overlapping times, or onto a `manutencao`
   resource — `createAppointment` blocks both (lines 105-133) but the update path does not.
   (The GIST still protects dentist double-booking; resources have no GIST this phase, so the
   app check is the only protection.)
**Fix:** Resolve the effective dentist when not supplied, and replicate the resource guard:
```ts
// when start/end change, resolve dentist from the existing row if not in the payload
let effectiveDentistId = input.dentist_id
if (!effectiveDentistId) {
  const { data: existing } = await supabase
    .from('appointments').select('dentist_id, resource_id')
    .eq('id', id).eq('tenant_id', actor.tenant_id).single()
  effectiveDentistId = existing?.dentist_id
}
// ...run the same availability check with effectiveDentistId...
// and, when resource_id is being set or times change, re-run the
// isResourceAvailable() + overlap check from createAppointment (excluding this appointment id)
```
For the resource overlap query in the update path, exclude the current row with `.neq('id', id)`
so it doesn't conflict with itself.

## Info

### IN-01: `appointmentSchema` still uses `.default('agendado')` (pre-existing; conflicts with the stated no-`.default()` rule)

**File:** `src/lib/validators/appointment.ts:24-26`
**Issue:** Phase 11's new field `resource_id` correctly avoids `.default()` (line 32, with a
comment noting Zod-v3/RHF compatibility). But the pre-existing `status` field retains
`.default('agendado')`, which is exactly the pattern CLAUDE.md (D-133/D-158) flags as risky
with `@hookform/resolvers` input/output typing. Not introduced by Phase 11, but it sits in a
file Phase 11 edited and contradicts the convention the new code follows.
**Fix:** Drop `.default('agendado')` and supply the default via form `defaultValues` / the
server action fallback (`status: status ?? 'agendado'` already exists at `appointments.ts:143`,
so the schema default is redundant there anyway).

### IN-02: `getActor` is duplicated verbatim across four server-action files

**File:** `src/actions/checkin.ts:17-39`, `src/actions/professionals.ts:22-44`, `src/actions/resources.ts:30-52`, plus the existing copy in `appointments.ts`
**Issue:** The identical `getActor()` helper (auth.getUser + users row lookup) is copy-pasted.
Drift risk: a future change to the auth/tenant-resolution rule must be made in 4+ places.
**Fix:** Extract to a shared non-`'use server'` module (e.g. `src/lib/auth/actor.ts`) and import
it. Keep it out of a `'use server'` file so it isn't forced to be an exported async action.

### IN-03: `markArrived` cannot recover a mistakenly-skipped state; transition model is strictly one-step-forward with no undo

**File:** `src/lib/scheduling/waiting.ts:54-65`, consumed in `checkin.ts:74-83`
**Issue:** `isValidPresenceTransition` only allows `from → from+1`. There is no path to correct
an operator mistake (e.g. accidental "Finalizar") — no backward transition and no reset. For a
reception desk this will generate support friction. Not a bug per se (the strictness is
intentional and documented), but worth a product note.
**Fix:** Consider allowing a single-step backward transition for `admin`/`receptionist`, or an
explicit `resetPresence` action gated to admin, audited via `logBusinessEvent`.

### IN-04: `getAvailableSlots` generates 48 slots/day across the full 00:00–23:30 range

**File:** `src/actions/public-booking.ts:312-328`
**Issue:** Every call iterates all 48 half-hour slots and runs `isSlotWithinAvailability` on
each, regardless of clinic hours. Functionally fine (filtered down by windows), just wasteful
and produces midnight-range candidates that only get discarded. Combined with WR-03's timezone
issue, the discarded set is also computed against the wrong wall-clock.
**Fix:** Bound the loop to the union of the professional's window hours for that weekday before
generating candidates; minor.

### IN-05: Panel join uses `as unknown as any` + array/object branch in two places

**File:** `src/actions/checkin.ts:260-279`, `src/app/painel/[clinic-slug]/page.tsx:83-100`
**Issue:** The Supabase embedded-join shape is coerced via `as unknown as any` and a runtime
array/object check. The earlier-flagged TS2352 cast at `checkin.ts:261` is sound here — the
double cast through `unknown` is the correct escape hatch given Supabase's join-cardinality
inference, and the runtime guard handles both shapes safely. Logic is duplicated between the
SSR page and the server action.
**Fix:** Extract the `extractFullName(rawPatient): string | null` shaping into `panel.ts`
(pure) and reuse in both call sites; reduces the `any` surface to one audited spot.

---

_Reviewed: 2026-06-15T01:12:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
