---
phase: 02-clinical-mvp
verified: 2026-06-05T20:00:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Complete the full clinical workflow end-to-end in one session"
    expected: "Dentist books appointment, registers patient, writes prontuario entry with diagnosis+treatment_plan, updates odontogram tooth status, patient signs anamnesis via public link — all successful"
    why_human: "Multi-step cross-component flow requiring a live Supabase session, authenticated UI, and a touch-capable canvas for signature"
  - test: "Verify the 23P01 double-booking rejection is surfaced to the user"
    expected: "Creating two overlapping appointments for the same dentist shows 'Horário indisponível...' alert in the calendar and reverts the drag event"
    why_human: "Requires live DB with GIST constraint applied and two concurrent client sessions; can't simulate race condition with file inspection alone"
  - test: "Verify anamnesis immutability after signing"
    expected: "Reusing a spent token (same URL) returns the 'expirou ou já foi utilizado' error; no second write is accepted"
    why_human: "Requires live DB transaction verification of the atomic UPDATE gate"
  - test: "Confirm public booking slot generation matches actual availability"
    expected: "Slots already booked by other appointments do NOT appear as selectable in PublicBookingForm (or are greyed out)"
    why_human: "Known documented stub: slot grid is generated client-side (30-min intervals 08:00-18:00) without querying the appointments table. Slots that are already booked are still shown as selectable. This is a known MVP deferral documented in 02-04-SUMMARY.md. Needs human to confirm whether this is acceptable for the initial release."
  - test: "Anamneses tab in patient detail page (/clinica/pacientes/[id])"
    expected: "After Plan 04 is complete, the Anamneses tab should display existing anamneses and a 'Gerar Link' button; currently shows 'Disponível após Plano 04' stub"
    why_human: "The stub text is still present in /clinica/pacientes/[id]/page.tsx even after Plan 04 shipped. Plan 04 SUMMARY acknowledges this as deferred to Phase 3 polish. Human must decide if this blocks release or is acceptable."
  - test: "Verify PDF generation of prontuário with Latin Extended characters"
    expected: "Download prontuário.pdf for a patient named 'João Ângelo'; verify ã/ç/ê appear correctly (not as '?')"
    why_human: "Font.register with Roboto woff2 requires actual HTTP fetch of the Google Font at PDF render time; can't verify font loading without running the server"
  - test: "Audit log entries created for patients/appointments/medical_records writes"
    expected: "After creating a patient, appointment, and medical record, audit_logs table contains corresponding rows with correct table_name, action, actor_id, new_values"
    why_human: "Requires live DB session to verify trigger fires and inserts into audit_logs; migration and trigger DDL are verified but execution requires runtime"
---

# Phase 2: Clinical MVP Verification Report

**Phase Goal:** A dentist can complete the full clinical workflow in one session — book an appointment, register the patient, document the visit in the prontuario, update the odontogram, and have the patient sign the anamnesis digitally.
**Verified:** 2026-06-05T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Receptionist can view weekly calendar by dentist and create an appointment in an available slot (SC-1 / CLINIC-01) | VERIFIED | `AgendaCalendar.tsx` uses FullCalendar `timeGridWeek`, `useQueryState('dentist')` for nuqs filter, `filterEventsByDentist` applied. `agenda/page.tsx` fetches dentists + week events from DB via `createClient()`. |
| 2 | System rejects double-booking at DB level — EXCLUDE USING GIST constraint fires → 23P01 handled (SC-1 / CLINIC-02) | VERIFIED | Migration `20260605000100` contains `CONSTRAINT no_overlap EXCLUDE USING GIST (tenant_id WITH =, dentist_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status NOT IN ('cancelado'))`. `createAppointment` and `updateAppointment` both capture `error.code === '23P01'` and return friendly message. `eventDrop` handler calls `info.revert()` on conflict. |
| 3 | Dentist can open patient chart, write prontuario entry with diagnosis + treatment_plan, and update the interactive odontogram with tooth-level status — changes appear in chronological history (SC-2 / CLINIC-05, CLINIC-06, CLINIC-07) | VERIFIED | `createMedicalRecord` inserts with `dentist_id=actor.id`; `listMedicalRecords` orders by `created_at DESC` without dentist_id filter (D-10). `Odontogram.tsx` renders 32 FDI teeth, edit Dialog calls `updateDentalRecord`. `prontuario/page.tsx` renders history cards. `odontograma/page.tsx` derives `editable` from authenticated user role. |
| 4 | Patient completes digital anamnesis and signs electronically — timestamp, IP, and consent version recorded; record immutable (SC-3 / CLINIC-08) | VERIFIED | `submitAnamnesisPublic` stores `signature_hash` (SHA-256), `ip_address`, `user_agent`, `signed_at=now()`, `token_used_at`. Atomic conditional UPDATE gate: `token_used_at IS NULL AND token_expires_at > now() AND signature_hash='PENDING'`. After signing, no further UPDATE passes. `submitAnamnesisPresencial` uses INSERT-only. |
| 5 | Any write to patients, appointments, medical_records triggers audit log (SC-4 / SEC-03) | VERIFIED | Migration `20260605000100` attaches `audit_patients`, `audit_appointments`, `audit_medical_records` triggers via `EXECUTE FUNCTION public.audit_table_changes()`. DB confirmed applied via `supabase migration list` (Local==Remote). |
| 6 | Patient can use public booking link to request appointment without logging in (SC-5 / CLINIC-09) | VERIFIED | `/agendar/[clinic-slug]/page.tsx` is Server Component using `createAdminClient()` (no session required). `proxy.ts` line 38-39: `/agendar` is in `isPublicRoute`. `createPublicAppointment` resolves clinic by slug, validates dentist belongs to that clinic (CR-01 fix), captures `23P01`, inserts with `source='publico'`. |
| 7 | AES-256 encryption on health fields before INSERT; decrypt guard on read (CLINIC-03, D-07) | VERIFIED | `createPatient` encrypts `medical_history/allergies/medications` only when non-empty. `getPatientDecrypted` uses `value ? decrypt(value) : ''` guard. `updatePatient` (WR-06 fix) only re-encrypts fields that are provided, preventing silent erasure. |
| 8 | Soft delete / LGPD anonymization: deleted_at + is_anonymized, no hard DELETE, prontuarios preserved (SC-3 / SEC-04) | VERIFIED | `anonymizePatient` sets `buildAnonymizedPatch()` (full_name='Paciente Excluído', cpf='000.000.000-00', etc.) via UPDATE only — no DELETE. RLS has no DELETE policy on `medical_records`, `dental_records`, `anamneses`. `patients` table has `deleted_at TIMESTAMPTZ` and `is_anonymized BOOLEAN`. |
| 9 | dental_records writes gated to admin/dentist at both app and DB layer (D-15) | VERIFIED | `updateDentalRecord` checks `actor.role !== 'admin' && actor.role !== 'dentist'` before insert. RLS policy `dental_records_clinical_write` FOR INSERT WITH CHECK `get_my_role() IN ('admin','dentist')`. |
| 10 | Public anamnesis via token is single-use and expires in 72h (D-20) | VERIFIED | `createAnamnesisToken` inserts with `token_expires_at=now()+72h`, `signature_hash='PENDING'`. `submitAnamnesisPublic` atomic UPDATE gate includes `signature_hash='PENDING'`. Generic error message for expired/used (Pitfall 5 / T-2-07). |
| 11 | PDF generated server-side with nodejs runtime, Latin Extended font, tenant-isolated (D-11) | VERIFIED | Route has `export const runtime = 'nodejs'`. `ProntuarioPDF.tsx` calls `Font.register({ family: 'Roboto', fonts: [{ src: woff2-400 }, { src: woff2-700, fontWeight: 700 }] })`. Layout uses Flexbox only (no CSS Grid). Route uses `createClient()` (RLS) — cross-tenant patient query returns null → 404. |
| 12 | CR-01 fix: public booking validates dentist belongs to clinic (security) | VERIFIED | `createPublicAppointment` uses Zod `publicBookingSchema` + DB check `.eq('tenant_id', clinic.id).eq('role', 'dentist').is('deleted_at', null)` before insert. |
| 13 | CR-02 fix: public anamnesis responses validated against cfoResponsesSchema before service-role write | VERIFIED | `submitAnamnesisPublic` calls `cfoResponsesSchema.safeParse(responses)` and returns `'Respostas inválidas'` on failure. `cfoResponsesSchema` is `.strict()` with `observacoes.max(2000)`. |
| 14 | Public booking slot availability queries actual DB availability | FAILED | `PublicBookingForm.tsx` generates slots via `generateSlots()` — 30-min intervals 08:00-18:00 client-side, with NO query to the `appointments` table to exclude booked slots. A patient can select and attempt to book a slot already taken; the GIST constraint blocks the actual insert and returns a 23P01 error, but the UX shows already-booked slots as selectable. Documented as known MVP deferral in 02-04-SUMMARY.md. |

**Score:** 13/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260605000100_clinical_tables.sql` | 5 tables + GIST + audit triggers | VERIFIED | All 5 tables, `EXCLUDE USING GIST`, 3 audit triggers, btree_gist extension, patient_consents FK |
| `supabase/migrations/20260605000200_clinical_rls.sql` | RLS on 5 tables, dental_records role gate | VERIFIED | RLS enabled on all 5; dental_records `WITH CHECK get_my_role() IN ('admin','dentist')` |
| `supabase/migrations/20260605000300_clinical_audit_partitions.sql` | 2026_09 partition | VERIFIED | `audit_logs_2026_09` partition created |
| `src/types/database.types.ts` | All 5 clinical tables present | VERIFIED | 31 occurrences of clinical table names; 1003-line file regenerated from live schema |
| `src/actions/patients.ts` | createPatient/updatePatient/anonymizePatient/getPatientDecrypted with AES-256 | VERIFIED | `encrypt(` called on health fields; `buildAnonymizedPatch()` exported; `? decrypt(` guard present; `23505` captured |
| `src/actions/appointments.ts` | createAppointment/updateAppointment/cancelAppointment with 23P01 | VERIFIED | `error.code === '23P01'` handled in create and update; `status='cancelado'` soft delete |
| `src/components/agenda/AgendaCalendar.tsx` | FullCalendar timeGridWeek + nuqs dentist filter | VERIFIED | `timeGridWeek`, `useQueryState('dentist')`, `filterEventsByDentist`, `info.revert()` on 23P01, eventClassNames by status |
| `src/components/patients/PatientForm.tsx` | RHF + zodResolver + CPF mask | VERIFIED | `zodResolver`, CPF blur mask, Calendar-in-Popover, `createPatient`/`updatePatient` called on submit |
| `src/actions/medical-records.ts` | createMedicalRecord (dentist_id=actor) + listMedicalRecords (ORDER BY created_at no dentist filter) | VERIFIED | `dentist_id: actor.id`; query orders by `created_at` descending without dentist_id filter |
| `src/actions/dental-records.ts` | updateDentalRecord gated admin/dentist | VERIFIED | `actor.role !== 'admin' && actor.role !== 'dentist'` role gate before insert |
| `src/components/odontogram/Tooth.tsx` | STATUS_COLORS (9 statuses), FDI_TEETH (32), mapDentalRecordsToToothStatus | VERIFIED | All 9 statuses with exact hex colors; 32 FDI teeth; timestamp comparison (WR-04 fix applied) |
| `src/components/odontogram/Odontogram.tsx` | 32 FDI teeth, edit Dialog → updateDentalRecord | VERIFIED | 4 FDI groups rendered; edit Dialog with Select (9 statuses) + Textarea; calls `updateDentalRecord` |
| `src/components/pdf/ProntuarioPDF.tsx` | Font.register Roboto + Flexbox-only A4 | VERIFIED | `Font.register({ family: 'Roboto', ... })` present; styles use `flexDirection` only (no `display: 'grid'`) |
| `src/app/api/patients/[id]/prontuario.pdf/route.ts` | runtime=nodejs + tenant check + decrypt guard | VERIFIED | `export const runtime = 'nodejs'`; `maxDuration = 30`; RLS-gated query; `? decrypt(` guard |
| `src/actions/anamneses.ts` | submitAnamnesisPublic (SHA-256, atomic token gate, generic error) | VERIFIED | `sha256OfPngDataUrl` called; atomic UPDATE with `token_used_at IS NULL AND token_expires_at > now() AND signature_hash='PENDING'`; generic error message |
| `src/components/anamnesis/SignatureCanvas.tsx` | signature_pad v5, cleanup, aria-label | VERIFIED | `new SignaturePad(canvas, ...)`, `pad.off()` on unmount (M-8), `aria-label="Área de assinatura"`, `touchAction: 'none'` |
| `src/actions/public-booking.ts` | createPublicAppointment with dentist validation + 23P01 | VERIFIED | Zod schema validates input; dentist-belongs-to-clinic check; `23P01` captured |
| `src/app/anamnese/[patient-id]/[token]/page.tsx` | Token validation before form render | VERIFIED | `isTokenValid` + `signature_hash === 'PENDING'` checked server-side; full-page error on invalid |
| `src/proxy.ts` | /anamnese in isPublicRoute | VERIFIED | Line 38-39: `pathname.startsWith('/anamnese')` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| appointments GIST constraint | DB-level double-booking rejection | `EXCLUDE USING GIST` in migration | VERIFIED | DDL confirmed in migration; applied to live DB per SUMMARY |
| `createAppointment` / `updateAppointment` | 23P01 friendly error | `error.code === '23P01'` capture | VERIFIED | Both actions capture the code and return user-facing message |
| `AgendaCalendar` eventDrop | `updateAppointment` | `handleEventDrop` calls action, `info.revert()` on failure | VERIFIED | Full handler present with revert on non-success |
| `patients.ts` health fields | `crypto.ts encrypt()` | `encrypt(medical_history)` guard before INSERT | VERIFIED | `medical_history ? encrypt(medical_history) : null` pattern |
| `submitAnamnesisPublic` | `anamneses.token_used_at` | Atomic conditional UPDATE single-use gate | VERIFIED | `.is('token_used_at', null).gt('token_expires_at', now).eq('signature_hash', 'PENDING')` |
| `AnamnesisForm` submit button | signature state | `disabled={!signature}` (D-19) | VERIFIED | `handleSubmit` checks `!signature` guard; button is enabled only after `onSign` callback from SignatureCanvas |
| `createPublicAppointment` | `users.tenant_id = clinic.id` | dentist validation query | VERIFIED | `.eq('id', data.dentist_id).eq('tenant_id', clinic.id).eq('role', 'dentist')` (CR-01 fix) |
| `prontuario.pdf` route | `patients` (tenant-scoped) | `createClient()` RLS | VERIFIED | Uses `createClient()` not `createAdminClient()`; cross-tenant query returns null → 404 |
| Audit triggers | `audit_logs` | `EXECUTE FUNCTION public.audit_table_changes()` | VERIFIED | 3 triggers in migration DDL; function pre-exists from Phase 1 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AgendaCalendar.tsx` | `events` (initial) | `agenda/page.tsx` Server Component → Supabase `appointments` query | Yes — fetched from DB via `createClient()` (RLS) | FLOWING |
| `prontuario/page.tsx` | `records` | `listMedicalRecords(id)` → `medical_records` table ORDER BY `created_at DESC` | Yes — real DB query, no dentist filter | FLOWING |
| `odontograma/page.tsx` | `dentalRecords` | Supabase `dental_records` query for patient | Yes — real DB query | FLOWING |
| `PublicBookingForm.tsx` | `slots` | `generateSlots(selectedDate)` — client-side 30-min interval math | No — static generation, does NOT query `appointments` for real availability | STATIC (known MVP deferral) |

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| `sha256OfPngDataUrl` determinism | 154 Vitest tests all passing per 02-04-SUMMARY (includes signature.test.ts — 18 tests) | PASS |
| `isTokenValid` logic | Covered by signature.test.ts (used=false, expired=false, valid=true) | PASS |
| `mapDentalRecordsToToothStatus` WR-04 fix | 22 odontogram tests including timestamp comparison | PASS |
| Zod schemas (patientSchema, appointmentSchema, medicalRecordSchema, cfoResponsesSchema) | Covered by patients.test.ts (9), calendar.test.ts (12), medical-records.test.ts (26), signature.test.ts (18) | PASS |
| proxy.ts `/anamnese` isPublicRoute | rbac.test.ts covers this assertion (was RED until Task 3, now GREEN) | PASS |
| TypeScript clean build | `npx tsc --noEmit` exits 0 per 02-REVIEW-FIX.md post-fix verification | PASS |
| Total test count | 154/154 passing per 02-04-SUMMARY.md and 02-REVIEW-FIX.md | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLINIC-01 | 02-02 | Weekly calendar view by dentist | SATISFIED | `AgendaCalendar` timeGridWeek + nuqs dentist dropdown |
| CLINIC-02 | 02-01, 02-02 | Create/edit/cancel appointments without slot conflict (GIST) | SATISFIED | GIST DDL + 23P01 capture in 3 booking paths |
| CLINIC-03 | 02-01, 02-02 | Register patient with all fields + AES-256 health encryption | SATISFIED | `createPatient` + `patientSchema` + encrypt guard |
| CLINIC-04 | 02-02 | Edit patient record | SATISFIED | `updatePatient` (WR-06 fix: no silent erasure of health fields) |
| CLINIC-05 | 02-01, 02-03 | Dentist registers prontuario with diagnosis/treatment/prescription | SATISFIED | `createMedicalRecord` + `ProntuarioForm` + prontuario page |
| CLINIC-06 | 02-01, 02-03 | Odontogram with tooth-level status (9 statuses, FDI) | SATISFIED | `dental_records` table + `Tooth.tsx` STATUS_COLORS + `Odontogram.tsx` |
| CLINIC-07 | 02-01, 02-03 | Chronological history of all dentists' prontuarios | SATISFIED | `listMedicalRecords` orders by `created_at DESC` without dentist_id filter |
| CLINIC-08 | 02-01, 02-04 | Digital anamnesis with SHA-256 + timestamp + IP + CFO questions | SATISFIED | `submitAnamnesisPublic/Presencial` + `SignatureCanvas` + `sha256OfPngDataUrl` |
| CLINIC-09 | 02-01, 02-04 | Public booking link without login + GIST slot lock | SATISFIED | `/agendar/[slug]` page + `createPublicAppointment` + 23P01 capture |
| SEC-03 | 02-01 | Audit trigger on patients/appointments/medical_records | SATISFIED | 3 triggers in migration DDL applied to live DB |
| SEC-04 | 02-01, 02-02 | LGPD soft delete: deleted_at + is_anonymized, no hard delete of prontuario | SATISFIED | `anonymizePatient` UPDATE-only; no DELETE policies on clinical tables |

**Note on REQUIREMENTS.md traceability discrepancy:** REQUIREMENTS.md marks CLINIC-05, CLINIC-06, CLINIC-07, and SEC-03 as "Pending" in the traceability table. This is a documentation inconsistency — the implementations are fully present in the codebase. The checkbox markings in REQUIREMENTS.md for these items also remain unchecked (`[ ]`). The code is complete; REQUIREMENTS.md traceability table needs updating.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/booking/PublicBookingForm.tsx` | `generateSlots()` generates all 30-min slots client-side without querying `appointments` table — booked slots appear as selectable | Warning | Public patients can try to book already-taken slots; GIST rejects at DB level but UX shows a false selection grid. Explicitly documented as MVP deferral in 02-04-SUMMARY. |
| `src/components/odontogram/Odontogram.tsx:125` | `window.location.reload()` after `updateDentalRecord` success | Info | Works but conflicts with TanStack Query / `router.refresh()` pattern documented in CLAUDE.md. Noted in 02-REVIEW.md IN-04. Low impact. |
| `src/components/prontuario/ProntuarioForm.tsx:71` | `window.location.reload()` after `createMedicalRecord` success | Info | Same as above — heavier UX than `router.refresh()`. Low impact. |
| `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx:181` | Anamneses tab content shows "Disponível após Plano 04" stub text even after Plan 04 shipped | Warning | The functional anamnesis flow exists at `/anamnese/[patient-id]/[token]`, but the tab in the patient detail dashboard does not link to it or display existing anamneses. Wire-up deferred to Phase 3 per Plan 04 SUMMARY. |

### Human Verification Required

#### 1. Full Clinical Workflow End-to-End

**Test:** Log in as a dentist. Navigate to /clinica/agenda, select yourself from the dentist dropdown, click an empty slot, create an appointment. Then navigate to /clinica/pacientes/novo, create a patient. Navigate to /clinica/pacientes/[id]/prontuario, click "Registrar Atendimento", fill in diagnosis + treatment_plan, save. Navigate to /clinica/pacientes/[id]/odontograma, click tooth 16, set status "cariado", save. Generate an anamnesis link from the patient page, open the link in a new tab, complete the CFO questionnaire, draw a signature, click "Assinar e Enviar".

**Expected:** Each step succeeds. The prontuario appears in the chronological history list. The odontogram tooth 16 shows red. The anamnesis page shows success state.

**Why human:** Multi-step cross-component flow requiring live authentication, Supabase RLS, signature canvas in browser, and font loading for PDF.

#### 2. Double-Booking Rejection (23P01 UX)

**Test:** Create an appointment for dentist X at 09:00-10:00. Then attempt to create another appointment for the same dentist at 09:30-10:30.

**Expected:** Second creation shows "Horário indisponível. Este horário foi reservado enquanto você preenchia. Selecione outro horário." inline in the AgendaCalendar dialog or event drop.

**Why human:** Requires live DB with GIST constraint and two calendar interactions.

#### 3. Anamnesis Token Immutability

**Test:** Generate an anamnesis token for a patient. Complete the anamnesis and sign. Reload the same URL.

**Expected:** Page shows "Link de Anamnese Inválido — Este link de anamnese expirou ou já foi utilizado." full-page error state.

**Why human:** Requires live DB and verifying the atomic UPDATE gate fired correctly.

#### 4. Audit Log Population (SEC-03)

**Test:** Create a patient, create an appointment, create a medical record. Query `SELECT table_name, action, new_values FROM audit_logs ORDER BY created_at DESC LIMIT 5` in Supabase.

**Expected:** Three rows with `table_name IN ('patients', 'appointments', 'medical_records')` and populated `new_values` JSONB.

**Why human:** Requires live DB runtime verification that triggers are firing and inserting into audit_logs partitions.

#### 5. PDF Latin Extended Characters

**Test:** Create a patient named "João Ângelo Ferrão" with allergy note "reação à amoxicilina". Download the prontuário PDF.

**Expected:** PDF displays "João Ângelo Ferrão" with correct ã/â/ç characters (not "?" or missing glyphs).

**Why human:** Requires Roboto woff2 fetch to succeed at PDF render time; verifiable only by running the server and opening the PDF.

#### 6. Public Booking Slot Availability Gap

**Test:** Book an appointment for dentist X at 09:00-09:30 via the authenticated agenda. Then open /agendar/[clinic-slug] in a new incognito tab and select dentist X for the same date.

**Expected (current behavior):** The 09:00–09:30 slot still appears as selectable in the grid. Selecting it and submitting returns "Este horário acabou de ser reservado." (23P01).

**Expected (ideal):** Booked slots should not appear or should be greyed out.

**Why human:** Business decision on whether the current MVP deferral (client-side slots, GIST as last guard) is acceptable for initial release or requires a blocking fix before shipping CLINIC-09.

#### 7. Anamneses Tab in Patient Detail

**Test:** After completing an anamnesis for a patient, navigate to /clinica/pacientes/[id] and click the "Anamneses" tab.

**Expected (current behavior):** Tab shows "Disponível após Plano 04" stub text.

**Expected (ideal):** Tab lists existing anamneses with signed_at date, and a "Gerar Link de Anamnese" button.

**Why human:** Business decision on whether this stub is a release blocker (CLINIC-08 anamneses exist but are not surfaced in the patient dashboard) or acceptable Phase 3 UI polish.

### Gaps Summary

**14th truth (public booking slot availability)** is the only programmatically-failed item, but it is a documented and intentional MVP deferral — the GIST constraint provides the actual safety net (no double booking can succeed at the DB level even if the UI shows booked slots as selectable). The 23P01 error is handled with a friendly message. This is a UX gap, not a security or data integrity gap.

**REQUIREMENTS.md traceability table** has a documentation inconsistency: CLINIC-05, CLINIC-06, CLINIC-07, and SEC-03 are marked as status "Pending" and their checkboxes remain unchecked despite full implementation being present. This does not reflect a code gap — it reflects a documentation maintenance gap in REQUIREMENTS.md.

**Anamneses tab stub** in `/clinica/pacientes/[id]/page.tsx` is the only remaining UI wire-up gap from Phase 2. The anamnesis functional flow (`/anamnese/[patient-id]/[token]`, `createAnamnesisToken`, `submitAnamnesisPublic`) is complete and working; only the dashboard tab that would list/trigger anamneses from the patient detail page is unlinked. This is explicitly deferred to Phase 3 in the Plan 04 SUMMARY.

**All security-critical items from 02-REVIEW.md are fixed:** CR-01 (dentist validation in public booking), CR-02 (CFO response validation), WR-01 (presencial anamnesis uses RLS client), WR-02 (patient-belongs-to-tenant validation in medical/dental records), WR-03 (role derived from auth not header), WR-04 (timestamp comparison), WR-06 (no silent health-field erasure), WR-07 (edit button routing).

---

_Verified: 2026-06-05T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
