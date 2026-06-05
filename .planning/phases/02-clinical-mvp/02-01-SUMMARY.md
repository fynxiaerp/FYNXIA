---
phase: 02-clinical-mvp
plan: "01"
subsystem: database

tags: [supabase, postgresql, rls, gist, btree_gist, lgpd, audit, multi-tenant, typescript]

# Dependency graph
requires:
  - phase: 01-auth-tenant-onboarding
    provides: "clinics, users, patient_consents tables; audit_table_changes() SECURITY DEFINER trigger; get_my_tenant_id() + get_my_role() helpers; RLS patterns"
provides:
  - "public.patients table with CPF plaintext + AES-256 health fields + LGPD soft-delete/anonymization"
  - "public.appointments with EXCLUDE USING GIST anti-double-booking constraint per dentist"
  - "public.medical_records with diagnosis/treatment_plan/prescription and dentist_id"
  - "public.dental_records with FDI tooth_number CHECK (11-48) and 9 odontogram statuses"
  - "public.anamneses with signature_hash, single-use token, token_expires_at/token_used_at"
  - "btree_gist extension enabled"
  - "Audit triggers on patients/appointments/medical_records via audit_table_changes()"
  - "RLS policies on all 5 clinical tables; dental_records writes gated to admin/dentist"
  - "patient_consents.patient_id FK to patients(id) added (deferred from Phase 1)"
  - "audit_logs_2026_09 partition created proactively"
  - "database.types.ts regenerated with all 5 clinical tables"
affects:
  - "02-02 (patient CRUD UI depends on patients table + types)"
  - "02-03 (appointments UI depends on appointments + GIST constraint)"
  - "02-04 (anamnese flow depends on anamneses table + token pattern)"
  - "03-financial-mvp (billing references patients)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EXCLUDE USING GIST with btree_gist for atomic double-booking prevention at DB layer"
    - "AES-256 encryption applied in Server Action before INSERT — audit log captures ciphertext, never plaintext health data"
    - "LGPD soft-delete: deleted_at + is_anonymized — hard DELETE never used on patients"
    - "Service role pattern for public token flows (anamneses link_publico) — no RLS write policy; Server Action validates token"
    - "Proactive partition creation: audit_logs partition created before range fills (avoid runtime failures)"

key-files:
  created:
    - supabase/migrations/20260605000100_clinical_tables.sql
    - supabase/migrations/20260605000200_clinical_rls.sql
    - supabase/migrations/20260605000300_clinical_audit_partitions.sql
    - src/__tests__/migrations/clinical.test.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "CPF stored plaintext (not encrypted) for reception search performance — health fields (medical_history/allergies/medications) use AES-256 applied in Server Action"
  - "dental_records write policy INSERT-only (no UPDATE/DELETE policy) — prevents tampering with odontogram history without admin override"
  - "anamneses public-token flow uses service role in Server Action (no RLS write policy) — same pattern as patient_consents"
  - "btree_gist extension required before EXCLUDE constraint on mixed UUID/tstzrange — CREATE EXTENSION IF NOT EXISTS is idempotent"

patterns-established:
  - "EXCLUDE USING GIST pattern: CONSTRAINT no_overlap EXCLUDE USING GIST (tenant_id WITH =, dentist_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status NOT IN ('cancelado'))"
  - "Audit trigger attachment: CREATE TRIGGER audit_<table> AFTER INSERT OR UPDATE OR DELETE ON public.<table> FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes()"
  - "RLS write gate pattern: FOR ALL USING (tenant_id = get_my_tenant_id() AND get_my_role() IN (...)) WITH CHECK (same)"

requirements-completed: [CLINIC-02, CLINIC-03, CLINIC-05, CLINIC-06, CLINIC-08, CLINIC-09, SEC-03, SEC-04]

# Metrics
duration: multi-session (checkpoint at Task 3 for Supabase CLI re-auth)
completed: 2026-06-05
---

# Phase 2 Plan 01: Clinical Database Foundation Summary

**Five clinical tables (patients, appointments, medical_records, dental_records, anamneses) with GIST anti-double-booking, LGPD soft-delete, SECURITY DEFINER audit triggers, and role-gated RLS applied to live Supabase sa-east-1 project**

## Performance

- **Duration:** Multi-session (checkpoint for Supabase CLI re-authentication)
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 4 (0, 1, 2, 3)
- **Files modified:** 5

## Accomplishments

- Authored and applied 3 SQL migrations to live project (jqjwyqlbbuqnrffdnlpp, sa-east-1): clinical tables + GIST, RLS policies, audit partition
- Anti-double-booking enforced atomically at DB layer via `EXCLUDE USING GIST` on `tstzrange(start_time, end_time, '[)')` per dentist — race-condition-proof (T-2-01)
- All 7 Vitest assertions in `clinical.test.ts` pass GREEN after migrations applied
- LGPD compliance: `patients.deleted_at + is_anonymized` (SEC-04); medical/dental/anamneses records have no DELETE policy (tamper prevention T-2-06)
- `patient_consents.patient_id` FK to `patients(id)` added (deferred from Phase 1)
- TypeScript types regenerated (1003 lines); `npx tsc --noEmit` exits 0

## Task Commits

1. **Task 0: Clinical migration test scaffold (RED)** — `c23a14c` (test)
2. **Task 1: Clinical tables migration with GIST** — `6e9b42d` (feat)
3. **Task 2: Clinical RLS policies and 2026_09 audit partition** — `bf3dad0` (feat)
4. **Task 3: Regenerate database types after db push** — `a8cc324` (feat)

## Files Created/Modified

- `supabase/migrations/20260605000100_clinical_tables.sql` — patients, appointments (GIST), medical_records, dental_records (FDI), anamneses; audit triggers; patient_consents FK; btree_gist extension
- `supabase/migrations/20260605000200_clinical_rls.sql` — RLS on all 5 clinical tables; dental_records writes gated to admin/dentist (D-15)
- `supabase/migrations/20260605000300_clinical_audit_partitions.sql` — audit_logs_2026_09 partition for Sep 2026
- `src/__tests__/migrations/clinical.test.ts` — 7 Vitest assertions validating DDL content (static file reads, no live DB required)
- `src/types/database.types.ts` — Regenerated from live schema; all 5 clinical tables present

## Decisions Made

- CPF stored plaintext for reception search; AES-256 applied in Server Action before INSERT for `medical_history`, `allergies`, `medications` — audit log captures ciphertext, never plaintext health data (T-2-08)
- `dental_records` policy is INSERT-only (no UPDATE/DELETE policies) — preserves odontogram integrity; admin override requires service role
- Anamnese public-token flow will use service role in Server Action (Plan 04) — no RLS write policy on `anamneses` for unauthenticated inserts (T-2-09)
- `btree_gist` extension declared with `CREATE EXTENSION IF NOT EXISTS` — idempotent, safe to re-run

## Deviations from Plan

### Checkpoint Event: Supabase CLI Re-Authentication

- **Found during:** Task 3 (db push checkpoint)
- **Issue:** The blocking checkpoint required the human operator to re-authenticate the Supabase CLI to the account that owns the FYNXIA project (org `kczvihafddupruvsrrsc`) before `npx supabase db push` could run
- **Resolution:** Human re-authenticated to the FYNXIA-owning account; `npx supabase db push` applied all 3 migrations successfully; `supabase migration list` confirmed Local == Remote for all 3 timestamps
- **Impact:** No code changes; plan artifacts unchanged; only operator action required

**Total deviations:** 1 (checkpoint auth gate — expected for live DB push operations)
**Impact on plan:** No scope changes. Auth gate is a normal operational step for first live push per account.

## Issues Encountered

- Supabase CLI was linked to a different account than the one owning project `jqjwyqlbbuqnrffdnlpp`. Re-authentication to org `kczvihafddupruvsrrsc` resolved the push failure. This is a one-time setup issue for this workstation.

## User Setup Required

None — no new external service configuration required. Supabase project already provisioned.

## Next Phase Readiness

- **02-02 (Patient CRUD):** `public.patients` table live, types generated, RLS policies active — ready to build Server Actions and UI
- **02-03 (Scheduling):** `public.appointments` with GIST constraint live — ready for FullCalendar integration
- **02-04 (Anamnese):** `public.anamneses` with token fields live — ready for public-link flow (service role Server Action)
- **Concern:** FullCalendar Scheduler commercial license (~$500/yr) still open (STATE.md Open Question 1) — Plan 02-03 cannot ship without it
- **Concern:** D4Sign account provisioned? (Open Question 2) — needed for CLINIC-08 digital signature compliance

## Known Stubs

None — this plan is purely database/schema work; no UI components or data-display stubs.

---

*Phase: 02-clinical-mvp*
*Completed: 2026-06-05*
