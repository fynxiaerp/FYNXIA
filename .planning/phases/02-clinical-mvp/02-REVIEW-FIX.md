---
phase: 02-clinical-mvp
fixed_at: 2026-06-05T19:43:00Z
review_path: .planning/phases/02-clinical-mvp/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-06-05T19:43:00Z
**Source review:** .planning/phases/02-clinical-mvp/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 Critical + 7 Warning; Info findings out of scope)
- Fixed: 9
- Skipped: 0

**Post-fix verification (whole project):**
- `npx tsc --noEmit` → exit 0 (clean)
- `npx vitest run` → 10 test files, 154 tests, all passing

## Fixed Issues

### CR-01: Public booking accepts an unvalidated `dentist_id` — cross-tenant appointment injection

**Files modified:** `src/actions/public-booking.ts`
**Commit:** 192484c
**Applied fix:** Added a strict `publicBookingSchema` (Zod) validating `dentist_id` as UUID, `start_time`/`end_time` as ISO datetimes with offset, and length-bounding the free-text `requester_*` fields (which flow into `notes`). Before insert, the action now verifies the dentist exists, has role `dentist`, is not soft-deleted, and belongs to the resolved `clinic.id` (tenant), returning "Dentista inválido para esta clínica" on miss. All downstream references switched from raw `input.*` to validated `data.*`.

### CR-02: Public anamnesis submit writes unvalidated `responses` JSONB via service role

**Files modified:** `src/actions/anamneses.ts`, `src/lib/validators/anamnesis.ts`
**Commit:** 131f2b7
**Applied fix:** Exported `cfoResponsesSchema`, made it `.strict()` (rejects unknown keys), and bounded `observacoes` with `.max(2000)` (this also closes IN-01, an Info finding that the CR-02 fix note explicitly required). In `submitAnamnesisPublic`, the untrusted `responses` payload is now validated with `cfoResponsesSchema.safeParse` before the service-role UPDATE; on failure it returns "Respostas inválidas". The `as unknown as Record<string, unknown>` cast was replaced with the typed `parsed.data`.

### WR-01: Presencial anamnesis bypasses RLS with the service-role client unnecessarily

**Files modified:** `src/actions/anamneses.ts`
**Commit:** 2e70b98
**Applied fix:** `submitAnamnesisPresencial` now inserts via the RLS-aware authenticated `supabase` client (the flow has a session and a matching `anamneses_staff_insert` RLS policy), restoring DB-level tenant-isolation defense in depth. Also added `cfoResponsesSchema` validation of `responses` for parity with the public flow, removing the unchecked cast.

### WR-02: `dentist_id` on medical/dental records is not verified to belong to the tenant

**Files modified:** `src/actions/medical-records.ts`, `src/actions/dental-records.ts`
**Commit:** dd4a28f
**Applied fix:** Before insert in both `createMedicalRecord` and `updateDentalRecord`, added a tenant-scoped `select id` against `patients` (`.eq('id', patient_id).eq('tenant_id', actor.tenant_id)`). On miss, returns a friendly "Paciente não encontrado" instead of leaking a raw FK `23503`, and prevents orphaned/mismatched clinical records.

### WR-03: Client-supplied request headers are trusted for masking decisions

**Files modified:** `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx`, `src/app/(dashboard)/clinica/pacientes/page.tsx`, `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx`, `src/app/(dashboard)/clinica/pacientes/[id]/odontograma/page.tsx`
**Commit:** 329cd0b
**Applied fix:** All four Server Components now derive `userRole` from a fresh authoritative lookup (`supabase.auth.getUser()` → `users.role`) instead of the forwardable `x-user-role` (and `x-user-id`) header. The list page also derives `tenant_id` from the authenticated user rather than the `x-user-id` header. Masking (CPF) and edit-gating (D-15) no longer depend solely on a presentation-layer header.

### WR-04: `mapDentalRecordsToToothStatus` compares `created_at` as strings

**Files modified:** `src/components/odontogram/Tooth.tsx`
**Commit:** 9d43651
**Applied fix:** Replaced the lexicographic `record.created_at > existing.created_at` with a numeric timestamp comparison via `new Date(...).getTime()`, so "most recent status wins" is correct regardless of `timestamptz` serialization differences (`+00:00` vs `Z`, fractional-second precision).

### WR-05: Token validity is read non-atomically before render (TOCTOU window)

**Files modified:** `src/app/anamnese/[patient-id]/[token]/page.tsx`
**Commit:** d5e7fcc
**Applied fix:** Documentation/hardening only (the reviewer confirmed the security gate already holds via the atomic conditional UPDATE in `submitAnamnesisPublic`). Added a clear comment marking the page's read-then-render check as NON-authoritative and pointing to the atomic UPDATE as the true single-use gate, so a future change does not mistake the page check for the security boundary.

### WR-06: `updatePatient` re-encrypts/overwrites health fields, nulling them when omitted

**Files modified:** `src/actions/patients.ts`
**Commit:** 09d9319
**Applied fix:** `updatePatient` now builds the update payload conditionally — health fields (`medical_history`/`allergies`/`medications`) are only re-encrypted and written when a non-empty value is provided; otherwise the existing encrypted value is left untouched ("no change"). This removes the data-loss footgun where a partial submission silently erased encrypted clinical data.

**Note (requires human verification):** This is a deliberate semantic change. With the new behavior, a user who intentionally clears a health field to empty will no longer null it via this action (the field is treated as "no change"). The normal edit flow round-trips correctly because the edit form pre-fills decrypted values. Confirm this trade-off matches product intent (data-loss prevention prioritized over explicit clearing) before the phase proceeds.

### WR-07: Edit action route does not exist for the PatientTable edit button

**Files modified:** `src/components/patients/PatientTable.tsx`
**Commit:** d19dfc6
**Applied fix:** The edit button now routes to `/clinica/pacientes/${id}` (the detail page, whose "Dados" tab hosts the edit form) instead of the non-existent `/clinica/pacientes/${id}/editar` route, eliminating the 404 user path.

---

_Fixed: 2026-06-05T19:43:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
