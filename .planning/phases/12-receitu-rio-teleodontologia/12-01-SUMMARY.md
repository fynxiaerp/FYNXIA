---
phase: 12-receitu-rio-teleodontologia
plan: 01
subsystem: testing/scaffold
tags: [receituario, teleodontologia, scaffold, tdd, wave-0, regression-guard]
dependency_graph:
  requires:
    - 11-01 (GIST + phase8 engine read)
    - supabase/migrations/20260605000100_clinical_tables.sql
    - src/lib/icp/sign-document.ts
  provides:
    - Wave 0 RED test contracts for RX-01..03, TEL-01..02
    - REGRESSION GUARD locking appointments GIST + Phase 8 signing engine
  affects:
    - supabase/migrations/ (read-only, regression guard)
    - src/lib/icp/sign-document.ts (read-only, regression guard)
tech_stack:
  added: []
  patterns:
    - source-inspection (readFileSync/MM/SRC helpers)
    - pure-unit (checkMedicationAllergy guard pattern)
    - absolute-path dynamic import (D-144/D-168 pattern)
    - existsSync guard + early-return for Wave 0 RED state
key_files:
  created:
    - src/__tests__/receituario/allergy-check.test.ts
    - src/__tests__/receituario/clinical-documents.test.ts
    - src/__tests__/receituario/migrations-phase12-rx.test.ts
    - src/__tests__/teleodontologia/teleconsultations.test.ts
    - src/__tests__/teleodontologia/migrations-phase12-tel.test.ts
  modified: []
decisions:
  - "Wave 0 pure-unit tests for checkMedicationAllergy use if(!fn) return guard so they pass vacuously when file absent — the source-inspection assertion (exports checkMedicationAllergy) is the RED gate"
  - "REGRESSION GUARD placed in migrations-phase12-rx.test.ts (not a separate file) to colocate with the Phase 12 RX migration assertions"
  - "medications RLS assertion uses two-part test: (1) policy references public.medications, (2) policy block does NOT use get_my_tenant_id — implements Pitfall 4 guard"
metrics:
  duration_minutes: 9
  completed_date: "2026-06-18"
  tasks_total: 2
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 12 Plan 01: RED Test Scaffolds (Wave 0) Summary

5 test scaffold files with 162 test assertions covering all Phase 12 requirements (RX-01..03, TEL-01..02), plus a REGRESSION GUARD that locks the appointments GIST + status CHECK and the Phase 8 ICP signing engine as immutable.

---

## What Was Built

### Task 1: Receituário scaffolds (3 files)

**`src/__tests__/receituario/allergy-check.test.ts`** (RX-02)
- Pure-unit cases for `checkMedicationAllergy` via absolute-path dynamic import + existsSync guard
- Covers: allergen tag match (exact, UPPERCASE, accented/NFD), anamnese `alergia_medicamento` flag, anestesia flag (class-restricted), null safety (never throws)
- Architecture assertion: file must NOT contain `'use server'` or import `server-only` (PURE function contract)

**`src/__tests__/receituario/clinical-documents.test.ts`** (RX-01/RX-03)
- Source-inspection on `src/actions/clinical-documents.ts`: decrypt wiring (`@/lib/crypto`), `checkMedicationAllergy` call, `next_doc_number` via `.rpc(`, no `MAX(`, `signPdfBuffer` import from `@/lib/icp/sign-document`, `.is('signature', null)` race guard, `clinical-documents-pdf` bucket, `portal_visible`, both action exports
- PDF component assertions (ReceituarioPDF/AtestadoPDF/ExamePDF): `@react-pdf/renderer`, no `display: grid`, `generatedAt` deterministic timestamp
- Pure unit: `formatDocNumber` prefix-per-type (REC/RCC/ATE/EXM) + zero-padded format

**`src/__tests__/receituario/migrations-phase12-rx.test.ts`** (RX-01/RX-03 + REGRESSION GUARD)
- `_clinical_documents.sql`: medications table (name/generic_name/therapeutic_class/allergen_tags TEXT[]/requires_special_control/seed INSERT), clinical_documents (doc_type 4-value CHECK, status draft/signed, content_json TEXT encrypted, portal_visible, REVOKE on storage_path), document_seq_counters (UNIQUE clinic_id+doc_type), next_doc_number (ON CONFLICT/last_seq, no MAX)
- `_clinical_documents_rls.sql`: ENABLE RLS, SELECT clinic_id=get_my_tenant_id(), USING+WITH CHECK write policy, role gate (admin/dentist/superadmin), medications global SELECT (no tenant filter — Pitfall 4)
- **REGRESSION GUARD** (13 tests, must stay GREEN): `no_overlap EXCLUDE USING GIST`, `tenant_id WITH =`, `dentist_id WITH =`, `WHERE (status NOT IN ('cancelado'))`, all 5 status values, no `DROP CONSTRAINT no_overlap` in any migration, no `ALTER COLUMN status` on appointments, `signPdfBuffer` and `verifyPdfSignature` still exported from `src/lib/icp/sign-document.ts`

### Task 2: Teleodontologia scaffolds (2 files)

**`src/__tests__/teleodontologia/teleconsultations.test.ts`** (TEL-01/TEL-02)
- Source-inspection on `src/actions/teleconsultations.ts`: server action fundamentals (createClient/server, assertNotReadOnly, logBusinessEvent, dentist role gate), `createTeleconsultation` exports + external_link/consent_given/consent_given_at/consent_ip fields, server-side IP from headers (T-12-04 forgery mitigation), `startTeleconsultation`/`endTeleconsultation` exports with started_at/ended_at, `createSoapRecord` with teleconsultation_id+appointment_id and all 4 SOAP fields
- Validator assertions: `teleconsultationSchema`/`soapSchema` exported, `url(` validation on external_link, no `.default(` (D-133/D-158)

**`src/__tests__/teleodontologia/migrations-phase12-tel.test.ts`** (TEL-01/TEL-02)
- `_teleconsultations.sql`: teleconsultations table (clinic_id/patient_id/professional_id/appointment_id/external_link/consent_given BOOLEAN/consent_given_at/consent_ip/started_at/ended_at/status 4-value CHECK/deleted_at/idx), soap_records table (clinic_id/patient_id/appointment_id/teleconsultation_id/soap_subjective/soap_objective/soap_assessment/soap_plan/deleted_at/idx)
- `_teleconsultations_rls.sql`: ENABLE RLS on teleconsultations + soap_records, SELECT clinic_id=get_my_tenant_id(), USING+WITH CHECK write policy
- Regression re-assert: ALL() no DROP CONSTRAINT no_overlap, tel migration no EXCLUDE USING GIST

---

## Test Status (Wave 0)

| File | Total | Passed | Failed | Notes |
|------|-------|--------|--------|-------|
| allergy-check.test.ts | 12 | 11 | 1 | 1 RED (exports assertion); pure-unit guards pass vacuously |
| clinical-documents.test.ts | 30 | 8 | 22 | 22 RED (action/PDF absent) |
| migrations-phase12-rx.test.ts | 58 | 15 | 43 | **13 REGRESSION GREEN**; 2 vacuous; 43 RED |
| teleconsultations.test.ts | 27 | 1 | 26 | 1 GREEN (no .default guard passes vacuously) |
| migrations-phase12-tel.test.ts | 35 | 2 | 33 | **2 REGRESSION re-asserts GREEN**; 33 RED |
| **Total** | **162** | **37** | **125** | No crash; tsc clean |

**REGRESSION GUARD: 15/15 GREEN** (13 in rx-test + 2 in tel-test)

---

## Deviations from Plan

None — plan executed exactly as written.

Minor implementation notes (within-spec choices):
- `allergy-check.test.ts` pure-unit tests use `if (!checkMedicationAllergy) return` guard — these pass vacuously in Wave 0, but the source-inspection assertion (`exports checkMedicationAllergy`) is the deliberate RED gate that turns GREEN in Wave 2 when the file is created. This satisfies the plan's "fail on content, NOT crash" requirement.
- medications-RLS test uses a two-branch check (`if sql.includes('medications')`) for the "no get_my_tenant_id" assertion — the else branch produces the RED signal when the file is absent.

---

## Known Stubs

None. These are test scaffold files; they contain no application code stubs.

---

## Threat Flags

None. These are read-only test files that introduce no new network endpoints, auth paths, or schema changes.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/__tests__/receituario/allergy-check.test.ts | FOUND |
| src/__tests__/receituario/clinical-documents.test.ts | FOUND |
| src/__tests__/receituario/migrations-phase12-rx.test.ts | FOUND |
| src/__tests__/teleodontologia/teleconsultations.test.ts | FOUND |
| src/__tests__/teleodontologia/migrations-phase12-tel.test.ts | FOUND |
| Commit 2dc5b0f (receituario scaffolds) | FOUND |
| Commit ddd48c3 (teleodontologia scaffolds) | FOUND |
| REGRESSION GUARD 15/15 GREEN | VERIFIED |
| npx tsc --noEmit | EXIT 0 |
| Existing suites 259/259 | UNCHANGED |
