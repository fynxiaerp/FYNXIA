---
phase: 12-receitu-rio-teleodontologia
plan: "03"
subsystem: teleodontologia-data
tags: [teleodontologia, teleconsultations, soap, migration, prontuario, database, rls, zod]
dependency_graph:
  requires:
    - 12-01 (Wave 0 RED scaffolds)
    - 11-02 (professionals table — FK target for teleconsultations.professional_id)
    - Phase 2 clinical_tables (appointments, patients FK targets)
    - Phase 1 clinics/users (FK targets)
  provides:
    - teleconsultations table + indexes + RLS
    - soap_records table + indexes + RLS
    - teleconsultationSchema (Zod v3)
    - soapSchema (Zod v3)
  affects:
    - 12-04 (Server Actions consume teleconsultations + soap_records + schemas)
    - 12-05 (BLOCKING db push applies these migrations)
    - 12-07 (UI components use teleconsultationSchema + soapSchema)
tech_stack:
  added: []
  patterns:
    - PostgreSQL INET column for server-side consent_ip capture
    - Partial indexes (WHERE IS NOT NULL) for optional FK columns
    - Zod v3 z.string().url() for external link validation
    - RLS USING+WITH CHECK tenant+role gate (clinic_id + get_my_role)
key_files:
  created:
    - supabase/migrations/20260618000400_teleconsultations.sql
    - supabase/migrations/20260618000500_teleconsultations_rls.sql
    - src/lib/validators/teleconsultation.ts
  modified: []
decisions:
  - "soap_records as a separate table (not columns on medical_records) — keeps free-text prontuário clean; SOAP is structured S/O/A/P linked to teleconsultation sessions (Pitfall 5)"
  - "consent_ip INET column present in schema but populated server-side in Plan 04 — client schema (teleconsultationSchema) deliberately excludes it (T-12-14)"
  - "status CHECK values: agendada/em_andamento/concluida/cancelada — matches RESEARCH.md Pattern 4"
  - "external_link TEXT (nullable) in teleconsultations — Meet/Zoom/Jitsi URL; validated as z.string().url() in teleconsultationSchema (D-03)"
  - "deleted_at on both tables for LGPD soft delete (Lei 13.787/2018 — 20-year clinical record retention)"
metrics:
  duration_minutes: 10
  completed_date: "2026-06-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 12 Plan 03: Teleodontologia Data Foundation Summary

**One-liner:** PostgreSQL teleconsultations + soap_records tables with consent_ip/status-CHECK/partial-indexes + RLS USING+WITH CHECK + Zod v3 teleconsultationSchema (url validation) + soapSchema (no default).

---

## What Was Built

### Task 1: Teleconsultation migrations (529fa6c)

**`supabase/migrations/20260618000400_teleconsultations.sql`**

Creates two tables:

`public.teleconsultations` — session metadata for CFO-compliant teleodontologia (TEL-01, D-03):
- Core fields: `clinic_id` (NOT NULL FK → clinics), `patient_id` (NOT NULL FK → patients), `professional_id` (nullable FK → professionals/Phase 11), `appointment_id` (nullable FK → appointments), `unit_id` (nullable FK → units)
- Video: `external_link TEXT` — Meet/Zoom/Jitsi URL (D-03: no video hosting)
- CFO consent audit: `consent_given BOOLEAN NOT NULL DEFAULT false`, `consent_given_at TIMESTAMPTZ`, `consent_ip INET` (server-set in Plan 04 — never client-trusted, T-12-14)
- Lifecycle: `status TEXT CHECK (agendada|em_andamento|concluida|cancelada)`, `started_at`, `ended_at`
- LGPD: `deleted_at TIMESTAMPTZ` soft delete
- Indexes: `idx_teleconsultations_clinic` (clinic_id), `idx_teleconsultations_patient` (patient_id), partial indexes on appointment_id + unit_id (WHERE IS NOT NULL)

`public.soap_records` — structured SOAP clinical notes (TEL-02), separate from medical_records and dental_records (Pitfall 5):
- Core fields: `clinic_id` (NOT NULL FK → clinics), `patient_id` (NOT NULL FK → patients), `dentist_id` (NOT NULL FK → users), `appointment_id` (nullable FK), `teleconsultation_id` (nullable FK → teleconsultations)
- SOAP columns: `soap_subjective`, `soap_objective`, `soap_assessment`, `soap_plan` (all TEXT, nullable — partial saves supported)
- LGPD: `deleted_at TIMESTAMPTZ` soft delete
- Indexes: `idx_soap_records_clinic` (clinic_id), `idx_soap_records_patient` (patient_id, created_at DESC), partial indexes on teleconsultation_id + appointment_id (WHERE IS NOT NULL)

**`supabase/migrations/20260618000500_teleconsultations_rls.sql`**

RLS on both tables following the Phase 2 clinical_rls pattern:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- SELECT policy: `FOR SELECT USING (clinic_id = get_my_tenant_id())` — tenant read
- Write policy: `FOR ALL USING (...AND get_my_role() IN ('admin','superadmin','dentist')) WITH CHECK (same)` — clinical role gate (T-12-12, T-12-13 mitigations)

GIST/appointments/medical_records/dental_records untouched — regression guard (35/35) confirms.

### Task 2: Zod v3 schemas (97803ec)

**`src/lib/validators/teleconsultation.ts`**

`teleconsultationSchema` (TEL-01):
- `patient_id`: `z.string().uuid()`
- `appointment_id`: `z.string().uuid().optional()`
- `professional_id`: `z.string().uuid().optional()`
- `external_link`: `z.string().url().max(2000)` — URL-validated (D-03)
- `consent_given`: `z.boolean()` — client captures flag; server sets `consent_given_at` + `consent_ip`
- `notes`: `z.string().max(2000).optional()`

`soapSchema` (TEL-02):
- `patient_id`: `z.string().uuid()`
- `appointment_id`: `z.string().uuid().optional()`
- `teleconsultation_id`: `z.string().uuid().optional()`
- `soap_subjective/objective/assessment/plan`: `z.string().max(4000).optional()`

Both schemas: no `.default()` (D-133/D-158 — RHF v7 + resolvers v5 compatibility).
Exports: `TeleconsultationInput` + `SoapInput` inferred types.

---

## Test Results

### Assertions flipped GREEN by this plan

| Test file | Description | Before | After |
|-----------|-------------|--------|-------|
| `migrations-phase12-tel.test.ts` | teleconsultations table structure (18 assertions) | RED | GREEN |
| `migrations-phase12-tel.test.ts` | soap_records table structure (11 assertions) | RED | GREEN |
| `migrations-phase12-tel.test.ts` | RLS policies (5 assertions) | RED | GREEN |
| `migrations-phase12-tel.test.ts` | Regression re-asserts GIST/no_overlap (2 assertions) | GREEN | GREEN |
| `teleconsultations.test.ts` | teleconsultationSchema exported | RED | GREEN |
| `teleconsultations.test.ts` | soapSchema exported | RED | GREEN |
| `teleconsultations.test.ts` | external_link uses url() | RED | GREEN |
| `teleconsultations.test.ts` | no .default() | RED | GREEN |

**Total new GREEN: 39 assertions** (35 migration + 4 validator)

### Intentionally RED (Plan 04/07 scope)

`teleconsultations.test.ts` — 23 `actionSrc` assertions against `src/actions/teleconsultations.ts` (file absent — Plan 04 creates it).

### tsc --noEmit

Exit 0 — no TypeScript errors introduced.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `.default(` literal from validator JSDoc comment**
- **Found during:** Task 2 verification
- **Issue:** The validator file's JSDoc comment contained the literal text `.default()` to explain the forbidden pattern. The test assertion `expect(validatorSrc).not.toMatch(/\.default\(/)` does a full-file text scan including comments — the comment caused the assertion to fail.
- **Fix:** Rewrote comment to "No default values on any field" + "Zod default()" (no parenthesis in code position) to avoid the regex match.
- **Files modified:** `src/lib/validators/teleconsultation.ts`
- **Commit:** 97803ec (same task commit)

---

## Known Stubs

None. This plan produces migrations (SQL, no rendering) and Zod schemas (pure validation). No UI components, no data sources to wire.

---

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All three files are either SQL migrations (no network surface) or a Zod validator (no network surface). The consent_ip INET column is schema-only here; the server-side population from request headers is Plan 04's responsibility (T-12-14 mitigation).

---

## Self-Check

Files exist:
- `supabase/migrations/20260618000400_teleconsultations.sql` — FOUND
- `supabase/migrations/20260618000500_teleconsultations_rls.sql` — FOUND
- `src/lib/validators/teleconsultation.ts` — FOUND

Commits exist:
- `529fa6c` feat(12-03): teleconsultations + soap_records tables + RLS — FOUND
- `97803ec` feat(12-03): teleconsultationSchema + soapSchema (Zod v3, no default) — FOUND

## Self-Check: PASSED
