---
phase: 02-clinical-mvp
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - supabase/migrations/20260605000100_clinical_tables.sql
  - supabase/migrations/20260605000200_clinical_rls.sql
  - supabase/migrations/20260605000300_clinical_audit_partitions.sql
  - src/lib/validators/anamnesis.ts
  - src/lib/validators/appointment.ts
  - src/lib/validators/medical-record.ts
  - src/lib/validators/patient.ts
  - src/actions/anamneses.ts
  - src/actions/appointments.ts
  - src/actions/dental-records.ts
  - src/actions/medical-records.ts
  - src/actions/patients.ts
  - src/actions/public-booking.ts
  - src/app/(dashboard)/clinica/agenda/page.tsx
  - src/app/(dashboard)/clinica/pacientes/[id]/odontograma/page.tsx
  - src/app/(dashboard)/clinica/pacientes/[id]/page.tsx
  - src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx
  - src/app/(dashboard)/clinica/pacientes/novo/page.tsx
  - src/app/(dashboard)/clinica/pacientes/page.tsx
  - src/app/agendar/[clinic-slug]/page.tsx
  - src/app/anamnese/[patient-id]/[token]/page.tsx
  - src/app/api/patients/[id]/prontuario.pdf/route.ts
  - src/components/agenda/AgendaCalendar.tsx
  - src/components/anamnesis/AnamnesisForm.tsx
  - src/components/anamnesis/SignatureCanvas.tsx
  - src/components/booking/PublicBookingForm.tsx
  - src/components/odontogram/Odontogram.tsx
  - src/components/odontogram/Tooth.tsx
  - src/components/patients/PatientDeleteDialog.tsx
  - src/components/patients/PatientForm.tsx
  - src/components/patients/PatientTable.tsx
  - src/components/pdf/ProntuarioPDF.tsx
  - src/components/prontuario/ProntuarioForm.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/form.tsx
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Phase 2 delivers the clinical MVP: patients, appointments, medical/dental records, and digital
anamnesis, with a strong overall security posture. The team consistently derives `tenant_id` and
`dentist_id` from the authenticated actor (never client input), pairs every RLS `USING` with a
`WITH CHECK`, indexes every `tenant_id`, uses AES-256-GCM with integrity tags, handles the GIST
`23P01` exclusion violation in all three booking paths, and gates the single-use anamnesis token
with an atomic conditional UPDATE. The PDF route correctly relies on RLS (not service role) and
streams with no-cache headers. This is high-quality, security-aware work.

The most important gaps are in the two **service-role public flows** (public booking and public
anamnesis), where input that bypasses RLS is not validated as strictly as the authenticated paths.
Two of these rise to Critical because they allow cross-tenant data injection / unvalidated
service-role writes. The remaining findings are correctness and hardening improvements.

## Critical Issues

### CR-01: Public booking accepts an unvalidated `dentist_id` — cross-tenant appointment injection

**File:** `src/actions/public-booking.ts:67-80`
**Issue:** `createPublicAppointment` runs under the service-role client (RLS bypassed) and inserts
`dentist_id: input.dentist_id` directly from untrusted public input. The clinic is resolved by
slug, but the `dentist_id` is never verified to (a) exist, (b) have role `dentist`, or (c) belong
to the resolved `clinic.id`. The `appointments.dentist_id` FK references `users(id)` globally, not
scoped to the tenant. A malicious caller hitting the public endpoint can pass **any** user UUID —
including a dentist from a different clinic — and create an `appointments` row that mixes
`tenant_id = clinic.id` with a foreign `dentist_id`. This corrupts the agenda, can silently
consume another tenant's GIST anti-double-booking window, and breaks tenant isolation invariants.
**Fix:** Validate the dentist against the resolved clinic before inserting:
```ts
const { data: dentist } = await admin
  .from('users')
  .select('id')
  .eq('id', input.dentist_id)
  .eq('tenant_id', clinic.id)
  .eq('role', 'dentist')
  .is('deleted_at', null)
  .single()

if (!dentist) {
  return { success: false, error: 'Dentista inválido para esta clínica' }
}
```
Also validate the input shape with a Zod schema (UUID for `dentist_id`, ISO datetimes, max-length
on `requester_name`/`requester_phone`/`requester_email`) so the unauthenticated payload cannot
inject oversized or malformed data into `notes`.

### CR-02: Public anamnesis submit writes unvalidated `responses` JSONB via service role

**File:** `src/actions/anamneses.ts:114-149`
**Issue:** `submitAnamnesisPublic` is unauthenticated and uses the service-role client (RLS
bypassed). The `responses` argument is cast `as unknown as Record<string, unknown>` and written
straight into the `anamneses.responses` JSONB column with **no schema validation**. A caller who
holds a valid (un-used, un-expired) token — or who can reach the action with a guessed/leaked
token — can persist arbitrary, unbounded JSON into a clinical record. There is no size limit and
no key whitelist, so this is both a data-integrity hole (non-CFO keys, junk payloads in a legal
health document) and a storage/abuse vector. The same unchecked cast exists in the presencial
flow at line 229, but that path is at least authenticated and role-gated.
**Fix:** Validate `responses` against the existing `cfoResponsesSchema` before persisting, and
reject on failure:
```ts
import { cfoResponsesSchema } from '@/lib/validators/anamnesis'
// ...
const parsed = cfoResponsesSchema.safeParse(responses)
if (!parsed.success) {
  return { success: false, error: 'Respostas inválidas' }
}
// use parsed.data (no `as unknown` cast) in the update
```
Note: `cfoResponsesSchema` (anamnesis.ts:30) is currently strict on the 12 CFO keys but allows an
optional `observacoes` string with no max length; add `.max(...)` and `.strict()` to fully close
the injection surface.

## Warnings

### WR-01: Presencial anamnesis bypasses RLS with the service-role client unnecessarily

**File:** `src/actions/anamneses.ts:220-235`
**Issue:** `submitAnamnesisPresencial` already authenticates the staff user and there is a matching
RLS insert policy (`anamneses_staff_insert`, clinical_rls.sql:47). Yet it inserts via
`createAdminClient()` (comment: "same rationale as public flow"). This rationale is incorrect — the
presencial flow *has* a session and *has* an RLS write policy, so it should use the RLS-aware
`createClient()`. Using service role here removes the database-level tenant-isolation safety net
(defense in depth) for no reason.
**Fix:** Use the authenticated `supabase` (RLS) client for the presencial insert instead of `admin`.
The `tenant_id`/role `WITH CHECK` in `anamneses_staff_insert` will then enforce isolation at the
DB layer.

### WR-02: `dentist_id` on medical/dental records is not verified to belong to the tenant

**File:** `src/actions/medical-records.ts:75-88`, `src/actions/dental-records.ts:78-89`
**Issue:** `dentist_id` is correctly set to `actor.id` (good — T-2-12), but `patient_id` comes from
client input and is only validated as a UUID. The RLS `WITH CHECK` enforces `tenant_id =
get_my_tenant_id()`, so an attacker cannot write into another tenant. However, within their own
tenant they can attach a record to *any* `patient_id` UUID they supply, even one that does not
exist or belongs to a patient they should not access — the FK only checks existence, not tenant.
Because `patients` and the record share `tenant_id`, cross-tenant is blocked, but a non-existent or
mismatched patient is not caught with a friendly error (raw FK `23503` leaks through).
**Fix:** Before insert, confirm the patient exists in the actor's tenant (a tenant-scoped
`select id`), and return a friendly error on miss. This also hardens against orphaned records.

### WR-03: Client-supplied request headers are trusted for masking decisions

**File:** `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx:31-43`, `src/app/(dashboard)/clinica/pacientes/page.tsx:10-12`, `prontuario/page.tsx:37-38`, `odontograma/page.tsx:23-24`
**Issue:** These Server Components read `headers().get('x-user-role')` to decide CPF/PII masking and
edit permissions. `proxy.ts:88-91` overwrites `x-user-role` on the request only in the
authenticated branch, so a directly-injected header is normally clobbered — but the defense depends
entirely on the middleware always running and always overwriting. The role used for **masking** and
**edit gating** is therefore presentation-layer trust derived from a forwardable header, not from
a fresh authoritative lookup in the component. Note also `getPatientDecrypted` returns the full CPF
regardless of role; masking is applied only in the page (page.tsx:44-46), so any path that forgets
to mask exposes full CPF.
**Fix:** Do not rely solely on the forwarded header for security decisions. Either derive the role
from the authenticated user inside the action/component (as the Server Actions already do via
`getActor`), or mask sensitive fields server-side at the data layer (a `patients_masked` view or
masking inside `getPatientDecrypted`) so presentation code cannot accidentally leak.

### WR-04: `mapDentalRecordsToToothStatus` compares `created_at` as strings

**File:** `src/components/odontogram/Tooth.tsx:80-88`
**Issue:** "Most recent status wins" is computed with `record.created_at > existing.created_at`
using lexicographic string comparison. This is correct only while all timestamps share an identical
ISO-8601 format and timezone offset. Supabase `timestamptz` values serialized with differing
fractional-second precision or offset representation (e.g. `+00:00` vs `Z`) will sort incorrectly,
silently showing a stale tooth status on the odontogram — a clinical-correctness risk.
**Fix:** Compare as timestamps: `new Date(record.created_at).getTime() > new Date(existing.created_at).getTime()`.

### WR-05: Token validity is read non-atomically before render (TOCTOU window)

**File:** `src/app/anamnese/[patient-id]/[token]/page.tsx:25-41`
**Issue:** The page fetches the row and evaluates `isTokenValid` to decide whether to render the
form. This read-then-render is not atomic with the later submit. The submit (`submitAnamnesisPublic`)
*is* atomic (conditional UPDATE), so the security gate holds — but the page can render the form for
a token that is concurrently consumed, producing a confusing "valid form then generic failure"
experience. This is acceptable for security but worth a comment/UX note so a future change does not
mistake the page check for the authoritative gate.
**Fix:** Keep the atomic UPDATE as the source of truth (already correct). Optionally re-check and
show the same generic expired/used message on submit failure (the action already returns it).

### WR-06: `updatePatient` re-encrypts/overwrites health fields, nulling them when omitted

**File:** `src/actions/patients.ts:176-190`
**Issue:** `updatePatient` always writes `medical_history/allergies/medications`, setting them to
`null` whenever the corresponding input field is empty. Combined with the edit form pre-filling
decrypted values (patient/[id]/page.tsx:131-133 passes decrypted values into the form), a normal
edit round-trips fine — but any caller that submits a partial `PatientInput` without the health
fields will silently erase encrypted clinical data. Since `updatePatient` takes a full
`PatientInput` (not Partial), this is latent rather than active, but it is a data-loss footgun.
**Fix:** Treat empty/undefined health fields as "no change" (fetch-merge or only set fields that are
present), or document that `updatePatient` requires the full record every time and guard callers
accordingly.

### WR-07: Edit action route does not exist for the PatientTable edit button

**File:** `src/components/patients/PatientTable.tsx:162-164`
**Issue:** The edit button routes to `/clinica/pacientes/${id}/editar`, but no `editar` route was
delivered in this phase (editing happens in the `[id]` detail "Dados" tab). Clicking edit will
navigate to a 404. This is a broken user path rather than a security issue.
**Fix:** Point the edit button at `/clinica/pacientes/${id}` (the detail page hosts the edit form),
or add the `editar` route.

## Info

### IN-01: `responses` and `observacoes` lack length bounds

**File:** `src/lib/validators/anamnesis.ts:43`
**Issue:** `observacoes: z.string().optional()` has no max length, and `cfoResponsesSchema` is not
`.strict()`, so extra keys may pass depending on how it is invoked. Combined with CR-02 this widens
the public write surface.
**Fix:** Add `.max(2000)` to `observacoes` and call `.strict()` on the object.

### IN-02: Age calculation uses year subtraction only

**File:** `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx:48-50`
**Issue:** `age = currentYear - birthYear` overstates age for patients whose birthday has not yet
occurred this year (off-by-one). Minor display inaccuracy.
**Fix:** Subtract one when the current month/day precedes the birth month/day.

### IN-03: `generateSlots` does not exclude past times for "today"

**File:** `src/components/booking/PublicBookingForm.tsx:38-64`
**Issue:** When the selected date is today, slots earlier than the current time are still rendered
and selectable. The server has no business-hours/past-time guard either, so a public user can
request a slot in the past. Low impact (staff confirms manually) but worth tightening.
**Fix:** Filter out slots earlier than `now` when `dateStr === todayString()`, and reject past
`start_time` server-side in `createPublicAppointment`.

### IN-04: `window.location.reload()` used to refresh after mutations

**File:** `src/components/odontogram/Odontogram.tsx:125`, `src/components/prontuario/ProntuarioForm.tsx:71`
**Issue:** Full-page reloads to reflect new data discard client state and conflict with the
project's stated TanStack Query + `router.refresh()` pattern (CLAUDE.md State Management). Works,
but is a heavier UX than necessary.
**Fix:** Use `router.refresh()` (already used elsewhere, e.g. PatientDeleteDialog) to re-run the
Server Component and revalidate.

### IN-05: `getRequestMeta` trusts `x-forwarded-for` first hop

**File:** `src/actions/anamneses.ts:18-26`
**Issue:** IP is taken from the first `x-forwarded-for` entry, which is client-spoofable unless the
platform overwrites it. Since this IP is stored as LGPD/CFO signing evidence, a spoofed value
weakens that evidence. On Vercel the platform sets a trustworthy `x-real-ip`/`x-vercel-forwarded-for`;
prefer those.
**Fix:** Prefer the platform-provided trusted header (e.g. `x-real-ip` / Vercel's forwarded header)
over the raw first `x-forwarded-for` hop, and document the trust assumption.

### IN-06: AnamnesisForm uses a raw `<input type="checkbox">` instead of the project Checkbox primitive

**File:** `src/components/anamnesis/AnamnesisForm.tsx:135-140`
**Issue:** The form hand-rolls a native checkbox while the codebase provides `components/ui/checkbox.tsx`
(`@base-ui/react`). This is inconsistent with the documented UI primitive convention (CLAUDE.md)
and misses the shared a11y/styling behavior. Functional, but a consistency drift.
**Fix:** Use the shared `Checkbox` component for the CFO questions.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
