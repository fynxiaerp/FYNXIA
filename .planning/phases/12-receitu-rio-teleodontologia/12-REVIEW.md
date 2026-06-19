---
phase: 12-receitu-rio-teleodontologia
reviewed: 2026-06-19T00:00:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - supabase/migrations/20260618000100_clinical_documents.sql
  - supabase/migrations/20260618000200_clinical_documents_rls.sql
  - supabase/migrations/20260618000300_clinical_documents_bucket.sql
  - supabase/migrations/20260618000400_teleconsultations.sql
  - supabase/migrations/20260618000500_teleconsultations_rls.sql
  - src/lib/clinical/allergy-check.ts
  - src/lib/clinical/doc-number.ts
  - src/lib/validators/clinical-document.ts
  - src/lib/validators/teleconsultation.ts
  - src/lib/crypto.ts
  - src/actions/clinical-documents.ts
  - src/actions/teleconsultations.ts
  - src/components/pdf/ReceituarioPDF.tsx
  - src/components/pdf/AtestadoPDF.tsx
  - src/components/pdf/ExamePDF.tsx
  - src/components/receituario/ClinicalDocumentForm.tsx
  - src/components/receituario/AllergyAlert.tsx
  - src/components/teleconsultation/TeleconsultationForm.tsx
  - src/components/teleconsultation/SoapEditor.tsx
  - src/app/(dashboard)/clinica/receituario/page.tsx
  - src/app/(dashboard)/clinica/receituario/[id]/page.tsx
  - src/app/(dashboard)/clinica/teleodontologia/[id]/page.tsx
  - src/proxy.ts
  - src/components/shell/nav-config.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** deep
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 12 (Receituário & Teleodontologia) is well-architected and most security-critical
focus areas pass: the allergy decrypt happens server-side before the pure
`checkMedicationAllergy` (never against ciphertext), the alert is correctly non-blocking,
`signPdfBuffer` is reused unmodified (not in the diff), the `.is('signature', null)` atomic
re-sign guard is present with storage rollback, `doc_number` comes from the atomic
`next_doc_number()` RPC, `content_json` is AES-256-GCM encrypted at rest, `consent_ip` /
`consent_given_at` are set server-side from headers and omitted from the audit log, RLS pairs
USING + WITH CHECK with `clinic_id` scope on all three new tables, `medications` is a coherent
global read-only table, and no Phase 12 migration touches the appointments GIST / status.

However, there are **two CRITICAL tenant-column bugs** that defeat the headline RX-02 allergy
requirement and open a cross-tenant health-data read. Both stem from the same root cause: the
`patients`, `appointments`, and `anamneses` tables use the column name **`tenant_id`**, but the
new Phase 12 code queries them with **`clinic_id`** (the column name used by the *new* tables).
Because PostgREST returns an error (or no row) instead of crashing, these failures are silent —
the allergy check degrades to "no alert" and patient lookups quietly return nothing.

## Critical Issues

### CR-01: Allergy check silently disabled — `patients` queried by non-existent `clinic_id` column

**File:** `src/actions/clinical-documents.ts:143-149`
**Issue:** The RX-02 allergy fetch reads the patient's encrypted `allergies` with
`.eq('clinic_id', actor.tenant_id)`. The `patients` table has **no `clinic_id` column** — its
tenant column is `tenant_id` (`supabase/migrations/20260605000100_clinical_tables.sql:10`, and
the canonical pattern in `src/actions/patients.ts:181` is `.eq('tenant_id', actor.tenant_id)`).
PostgREST returns an error for the unknown column, so `patient` is `null`, `allergiesPlain`
becomes `null`, and the entire free-text allergy match path (allergen tags + medication name vs
the patient's decrypted allergies field) **never fires**. Only the two anamnesis booleans could
ever trigger an alert — and those are also broken (see CR-02). This defeats the primary
safety feature of the phase: a patient with "alergia a penicilina" recorded in `patients.allergies`
will receive an Amoxicilina prescription with no warning.

**Fix:**
```ts
const { data: patient } = await admin
  .from('patients')
  .select('allergies')
  .eq('id', validated.patient_id)
  .eq('tenant_id', actor.tenant_id) // patients uses tenant_id, not clinic_id
  .is('deleted_at', null)
  .single()
```

### CR-02: Cross-tenant health-data read — anamnese fetch has NO tenant scope

**File:** `src/actions/clinical-documents.ts:158-164`
**Issue:** The latest-anamnese lookup runs on the **admin (service-role) client**, which bypasses
RLS, and filters only by `patient_id` with no tenant predicate at all:
```ts
const { data: latestAnamnese } = await admin
  .from('anamneses')
  .select('responses')
  .eq('patient_id', validated.patient_id)   // no tenant filter — RLS bypassed by admin client
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
`anamneses` is tenant-scoped via `tenant_id` (`20260605000100_clinical_tables.sql:101`). Although
`patient_id` is normally unique to one clinic, relying on that is an LGPD violation:
a `patient_id` from another tenant (e.g. a guessed/leaked UUID) would return that patient's
anamnesis `responses` (health PII) with zero isolation. Defense-in-depth requires an explicit
tenant guard whenever the admin client is used.

**Fix:**
```ts
const { data: latestAnamnese } = await admin
  .from('anamneses')
  .select('responses')
  .eq('patient_id', validated.patient_id)
  .eq('tenant_id', actor.tenant_id)   // explicit tenant scope on admin-client read
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
(Combine with CR-01: validate the patient belongs to `actor.tenant_id` once, then reuse.)

## Warnings

### WR-01: Teleodontologia page queries `appointments` by non-existent `clinic_id`

**File:** `src/app/(dashboard)/clinica/teleodontologia/[id]/page.tsx:88-95`
**Issue:** `appointments` is tenant-scoped via `tenant_id`
(`20260605000100_clinical_tables.sql:34`), but the appointments fetch uses `.eq('clinic_id', tenantId)`.
The query errors / returns no rows, so the "Atendimento vinculado" selector in
`TeleconsultationForm` is always empty and SOAP records can never be linked to an appointment via
this page. (Note: line 102's `professionals` query correctly uses `clinic_id` — that table really
does use `clinic_id` per `20260617000100_professionals.sql:19`. Only the appointments line is wrong.)

**Fix:**
```ts
.from('appointments')
.select('id, start_time, patient_id')
.eq('tenant_id', tenantId) // appointments uses tenant_id, not clinic_id
```

### WR-02: `as never` cast still present on the sign update — masks type errors

**File:** `src/actions/clinical-documents.ts:527`
**Issue:** The signing UPDATE payload is cast `as never`:
```ts
.update({ /* content_hash, signature, storage_path, cert_pem, ... */ } as never)
```
The review brief explicitly requires all `as never` casts to be removed. `as never` suppresses
all type-checking on the update object, so a future typo in a column name (e.g. another
`clinic_id`/`tenant_id` slip, or a renamed signature field) would compile silently and fail only
at runtime. Regenerate `database.types.ts` to include the new `clinical_documents` columns and
remove the cast so the typed Supabase client validates the payload.

**Fix:** After `supabase gen types typescript` includes `clinical_documents`, drop the cast:
```ts
.update({
  content_hash: sigResult.sha256Hex,
  signature: sigResult.signatureB64,
  // ...
  status: 'signed',
})
.eq('id', documentId)
.is('signature', null)
.select('id')
```

### WR-03: Medication metadata fetch swallows errors — bad/foreign `medication_id` yields empty allergen tags

**File:** `src/actions/clinical-documents.ts:179-191`
**Issue:** For each prescription line the action fetches `therapeutic_class` + `allergen_tags`:
```ts
const { data: medRow } = await admin.from('medications')
  .select('therapeutic_class, allergen_tags')
  .eq('id', med.medication_id)
  .single()
// ...
allergenTags: (medRow?.allergen_tags as string[] | null) ?? [],
```
The `error` is discarded and a missing row falls through to `allergenTags: []` /
`therapeuticClass: ''`. A client can submit any UUID in `medication_id` (Zod only checks `.uuid()`,
not existence), and the form's `medication_name` is also client-supplied — so a tampered request
can prescribe an arbitrary drug while neutering the allergen-tag match (only the name-substring
match would remain). Combined with CR-01 this means a maliciously-crafted request bypasses the
allergy check entirely. Validate that each `medication_id` resolves to an active medication and
treat a lookup miss as a hard error.

**Fix:**
```ts
const { data: medRow, error: medErr } = await admin.from('medications')
  .select('therapeutic_class, allergen_tags')
  .eq('id', med.medication_id)
  .eq('active', true)
  .single()
if (medErr || !medRow) {
  return { success: false, error: 'Medicamento inválido ou inativo' }
}
```

### WR-04: `next_doc_number` counter increments even when the document insert fails

**File:** `src/actions/clinical-documents.ts:206-290`
**Issue:** `next_doc_number()` atomically bumps `document_seq_counters.last_seq` and returns the
number, but the `clinical_documents` insert happens afterward (lines 271-290). If the insert fails
(e.g. the silent column bugs above, or any constraint error) the function returns an error while
the counter has already advanced — leaving permanent gaps in the per-clinic sequence (REC-2026-0041,
then 0043). For prescription/atestado numbering this is usually acceptable, but if regulatory
audits expect gapless sequences it is a correctness issue. Document the decision, or wrap
numbering + insert so a failed insert does not consume a number (e.g. issue the number inside a DB
function that also inserts the row).

**Fix:** Acceptable to keep gap-tolerant numbering (simplest, race-safe). If gapless is required,
move both the counter bump and the row insert into a single SECURITY DEFINER function so they share
one transaction. Add a comment recording the chosen guarantee.

## Info

### IN-01: `medications_read` RLS hides inactive rows from superadmin reads

**File:** `supabase/migrations/20260618000200_clinical_documents_rls.sql:71-78`
**Issue:** `medications_read` uses `USING (active = true)` for all authenticated users, including
superadmin. A superadmin curating the catalog (the `medications_superadmin_write` policy exists)
cannot SELECT an `active = false` row they just deactivated, which complicates an admin UI. Minor;
the SELECT filter is fine for clinicians.

**Fix:** Optionally OR in the superadmin role:
`USING (active = true OR get_my_role() = 'superadmin')`.

### IN-02: Signing re-renders the PDF from `created_at` — deterministic but allergy/anamnese drift not re-checked

**File:** `src/actions/clinical-documents.ts:429-487`
**Issue:** Signing re-decrypts `content_json` and re-renders the PDF using `generatedAt = row.created_at`
(correctly deterministic for re-sign idempotency, Pitfall 1). Note this means the allergy alert is
only evaluated at issue time; if the patient's allergies change between draft and signing no new
warning is surfaced. This matches the non-blocking design (D-02) but is worth a one-line comment so
future maintainers don't assume signing re-validates safety.

**Fix:** Add a comment at the sign entry point noting allergy evaluation is issue-time only.

### IN-03: `consent_ip` parsing trusts `x-forwarded-for` first hop

**File:** `src/actions/teleconsultations.ts:101-105`
**Issue:** `consent_ip` is taken from the first `x-forwarded-for` entry, falling back to `x-real-ip`.
On Vercel this is the client IP, but `x-forwarded-for` is client-spoofable upstream of a trusted
proxy. Since `consent_ip` is an audit artifact (not an authz decision) the risk is low, and it is
correctly server-set and never logged. No action required beyond awareness; if stricter provenance
is ever needed, prefer the platform-provided IP (`request.ip` / trusted proxy header).

**Fix:** None required; documented for awareness.

### IN-04: `listClinicDocuments` / `listTeleconsultations` rely solely on RLS for tenant scope

**File:** `src/actions/clinical-documents.ts:592-603`, `src/actions/teleconsultations.ts:363-374`
**Issue:** Both list actions use the RLS-backed `createClient()` with only an optional `patient_id`
filter and no explicit `.eq('clinic_id', actor.tenant_id)`. RLS does enforce isolation correctly
here, but the codebase convention elsewhere adds an explicit tenant predicate as defense-in-depth
(and the `issueClinicDocument` insert does). Adding it would also guard against an accidental future
RLS regression.

**Fix:** Add `.eq('clinic_id', actor.tenant_id)` to both list queries for defense-in-depth.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
