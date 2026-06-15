---
phase: 11-profissionais-recursos
plan: 02
subsystem: professionals-registry
tags: [professionals, availability, scheduling, migration, database, rls, zod]
requirements_satisfied: [PRO-01, PRO-02, PRO-03]

dependency_graph:
  requires:
    - 11-01 (Wave 0 test scaffolds — phase11.test.ts, professionals.test.ts, availability.test.ts)
    - supabase/migrations/20260603000000_initial_schema.sql (get_my_tenant_id, get_my_role SECURITY DEFINER)
    - supabase/migrations/20260614000100_units_table.sql (units table for unit_id FK + is_default backfill)
  provides:
    - professionals table (clinic_id, unit_id, user_id NULLABLE, cro, specialidades, commission_rules JSONB)
    - professional_availability table (recurring weekly windows, flat row model)
    - professional_availability_exceptions table (folga/extra date overrides)
    - isSlotWithinAvailability() pure function — consumed by Plan 11-04 (createAppointment integration)
    - commissionRulesSchema — consumed by Plan 11-04 (Server Action) and Phase 16 (TRIB calc)
    - professionalSchema — consumed by Plan 11-06 (ProfessionalForm UI)
  affects:
    - 11-04: availability check injected into createAppointment + public-booking (consumes isSlotWithinAvailability)
    - 11-05: db push deploys all migrations including these two
    - 11-06: ProfessionalForm uses professionalSchema + availabilityWindowSchema + availabilityExceptionSchema
    - Phase 16: commission_rules JSONB shape consumed by TRIB module

tech_stack:
  added: []
  patterns:
    - dedicated audit trigger function per table using clinic_id (mirrors audit_units_changes pattern)
    - discriminatedUnion Zod v3 (no .default()) for JSONB shape validation
    - PURE availability function — no server imports, importable client-side + in tests
    - UTC-based date/time extraction for consistent weekday + time comparison in pure function

key_files:
  created:
    - supabase/migrations/20260617000100_professionals.sql
    - supabase/migrations/20260617000200_professionals_rls.sql
    - src/lib/scheduling/availability.ts
    - src/lib/validators/professional.ts
  modified: []

decisions:
  - "isSlotWithinAvailability uses getUTCDay() + UTC time extraction — callers constructing Dates from UTC ISO strings get consistent weekday results; Brazil-timezone callers must pass pre-zoned Dates"
  - "Backfill uses ON CONFLICT DO NOTHING relying on partial unique index idx_professionals_clinic_user — idempotent re-run safe"
  - "Dedicated audit_professionals_changes() trigger (not audit_table_changes()) — professionals uses clinic_id not tenant_id, matching units pattern (D-130)"
  - "commissionRulesSchema: Zod v3 discriminatedUnion, no .default() (D-133) — Phase 16 TRIB consumes this JSONB shape for commission calculation"

metrics:
  duration_minutes: 5
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 11 Plan 02: Professionals Registry Foundation — Summary

**One-liner:** Professionals registry with RLS + partial-unique index, isSlotWithinAvailability pure function, and Zod v3 commission_rules schema for JSONB storage.

---

## What Was Built

### Task 1: Professionals Migrations (tables, indexes, RLS, dentist backfill)

Two SQL migration files created (NOT pushed — db push happens in Plan 11-05):

**`supabase/migrations/20260617000100_professionals.sql`**
- `CREATE TABLE public.professionals`: id, clinic_id NOT NULL (FK clinics CASCADE), unit_id NULLABLE (FK units), user_id NULLABLE (FK users — professionals without login), full_name, cro, cro_uf CHAR(2), especialidades TEXT[], vinculo CHECK('clt','pj','autonomo'), commission_rules JSONB DEFAULT '[]', ativo, deleted_at, created_at, updated_at
- Indexes: idx_professionals_clinic_id, idx_professionals_unit_id, idx_professionals_user_id (partial WHERE user_id IS NOT NULL)
- Partial UNIQUE: idx_professionals_clinic_user ON (clinic_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL (T-11-07 soft-delete spoofing mitigation)
- Dedicated audit trigger: audit_professionals_changes() — uses clinic_id not tenant_id (mirrors audit_units_changes pattern)
- `CREATE TABLE public.professional_availability`: recurring weekly schedule (professional_id, clinic_id denormalized, weekday SMALLINT CHECK(0..6), start_time TIME, end_time TIME)
- `CREATE TABLE public.professional_availability_exceptions`: date overrides (professional_id, clinic_id, exception_date DATE, exception_type CHECK('folga','extra'), start_time/end_time nullable, reason)
- **Dentist backfill (PRO-01):** INSERT INTO professionals FROM users WHERE role='dentist' AND deleted_at IS NULL with ON CONFLICT DO NOTHING; resolves unit_id via default unit subquery; cro/cro_uf left as empty/placeholder for admin to fill in Plan 06 UI

**`supabase/migrations/20260617000200_professionals_rls.sql`**
- ENABLE ROW LEVEL SECURITY on all three tables
- SELECT policy: `FOR SELECT USING (clinic_id = get_my_tenant_id())` on each table (tenant read)
- Write policy: `FOR ALL USING (... AND get_my_role() IN ('admin','superadmin')) WITH CHECK (... AND get_my_role() IN ('admin','superadmin'))` on each table (T-11-05, T-11-06)
- appointments table NOT touched; GIST constraint NOT touched; status NOT touched

### Task 2: isSlotWithinAvailability + Professional Zod Schema (TDD)

**`src/lib/scheduling/availability.ts`** (PURE — no 'use server', no server-only imports)
- Exports: `isSlotWithinAvailability(grade, exceptions, slot): boolean`
- Exports types: `AvailabilityWindow`, `AvailabilityException`, `Slot`
- Algorithm (mirror 11-RESEARCH Pattern 2):
  1. Folga exception on dateStr → false (day blocked)
  2. Recurring window on matching weekday covers [slot.start, slot.end] → true
  3. Extra exception on dateStr covers [slot.start, slot.end] → true
  4. Else → false
- Uses UTC-based date/time helpers (getUTCDay(), getUTCHours(), getUTCMinutes()) for consistent results from ISO strings
- TIME normalization: `.slice(0, 5)` normalizes 'HH:MM:SS' to 'HH:MM' for safe string comparison

**`src/lib/validators/professional.ts`** (Zod v3, no .default())
- `commissionRulesSchema`: z.array(z.discriminatedUnion('type', [flat_pct{pct 0..100}, service_pct{service_id uuid, pct 0..100}]))
- `professionalSchema`: full_name(min2,max120), cro(min1), cro_uf(len2,uppercase), especialidades, vinculo enum, unit_id(uuid optional), user_id(uuid optional nullable), commission_rules, ativo(boolean optional)
- `availabilityWindowSchema`: weekday(0..6), start_time/end_time(HH:MM regex)
- `availabilityExceptionSchema`: exception_date, exception_type enum, start_time/end_time, reason; refine: extra requires start+end
- Exported types: CommissionRules, AvailabilityWindowInput, AvailabilityExceptionInput, ProfessionalInput

---

## Test Results

### Tests Flipped GREEN by This Plan

**availability.test.ts — pure-unit (5/5 GREEN):**
- recurring window covering slot returns true
- slot outside all windows returns false
- folga exception on slot date returns false even if recurring window covers it
- extra exception covering slot on day with no recurring window returns true
- empty grade + no exceptions returns false

**professionals.test.ts — commission Zod (4/4 GREEN):**
- flat_pct rule { type: flat_pct, pct: 40 } parses OK
- service_pct rule { type: service_pct, service_id: uuid, pct: 35 } parses OK
- pct: 150 (out of 0–100 range) FAILS validation
- missing type field FAILS validation

**professionals.test.ts — backfill (1/1 GREEN):**
- _professionals.sql includes INSERT INTO professionals FROM users WHERE role=dentist

**phase11.test.ts — professionals schema + RLS (all GREEN):**
- creates public.professionals table
- has clinic_id, unit_id, user_id NULLABLE FK, cro, cro_uf, especialidades TEXT[], vinculo CHECK, commission_rules JSONB, deleted_at columns
- has idx_professionals_clinic_id index
- has partial unique index on clinic_id + user_id WHERE user_id IS NOT NULL (+ deleted_at IS NULL)
- creates professional_availability with weekday, start_time, end_time
- creates professional_availability_exceptions with exception_type CHECK IN folga, extra
- REGRESSION guards (6 tests): GIST EXCLUDE USING GIST + tenant_id WITH = + dentist_id WITH = + status NOT IN cancelado + 5 status values + no DROP CONSTRAINT no_overlap — all GREEN

### Tests Correctly Staying RED (Plan 04 targets)
- availability.test.ts: createAppointment references isSlotWithinAvailability (2 tests)
- availability.test.ts: public-booking.ts availability source-inspection (2 tests)
- availability.test.ts: appointment validator gains resource_id (2 tests)
- professionals.test.ts: professionals.ts action source-inspection (3 tests)
- phase11.test.ts: proxy.ts /painel public route (1 test — Plan 11-03/08)

### No Regressions
- src/__tests__/agenda/: 71/71 passed
- src/__tests__/actions/: 71/71 passed

### TypeScript
- `npx tsc --noEmit` → exit 0 (clean)

---

## Deviations from Plan

None — plan executed exactly as written.

The plan mentioned "Also export an `availabilityWindowSchema` + `availabilityExceptionSchema`" and these were implemented in professional.ts. No deviations from the SQL schema, RLS patterns, or algorithm were required.

---

## Threat Surface Scan

No new network endpoints introduced. All new tables are RLS-protected with clinic_id tenant scoping. No new trust boundaries created. The commission_rules JSONB is write-validated by Zod before storage (T-11-08). The partial unique index guards soft-deleted row bypass (T-11-07). All mitigations from the plan's threat register are implemented.

## Known Stubs

- `cro` and `cro_uf` are empty string placeholders in the dentist backfill (`''` and `'SP'`). These are intentional — the plan explicitly documents that "admin fills CRO via the cadastro UI (Plan 06)". These stubs are noted and will be filled via the Plan 06 ProfessionalForm UI. They do not prevent this plan's goal (establishing the registry foundation).

## Self-Check: PASSED

Files verified:
- [FOUND] supabase/migrations/20260617000100_professionals.sql
- [FOUND] supabase/migrations/20260617000200_professionals_rls.sql
- [FOUND] src/lib/scheduling/availability.ts
- [FOUND] src/lib/validators/professional.ts

Commits verified:
- bb2a0aa: feat(11-02): professionals + availability + exceptions migrations with RLS and dentist backfill
- 3b1f293: feat(11-02): isSlotWithinAvailability pure lib + professional Zod schema with commission_rules
