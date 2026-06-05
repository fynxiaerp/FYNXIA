---
phase: 02-clinical-mvp
plan: "04"
subsystem: anamnesis-public-booking

tags: [anamnesis, signature, sha256, single-use-token, public-booking, gist, 23p01, lgpd, cfo, signature_pad]

# Dependency graph
requires:
  - phase: 02-clinical-mvp
    plan: "01"
    provides: "public.anamneses with token + token_expires_at + token_used_at; public.appointments with GIST no_overlap constraint; public.clinics with slug"
  - phase: 02-clinical-mvp
    plan: "02"
    provides: "createAdminClient pattern, Server Action structure, 23P01 capture pattern, AES-256 helpers"
provides:
  - "anamnesisSchema (Zod v3): 12 CFO bool fields + signature required; rejects empty signature"
  - "sha256OfPngDataUrl: deterministic SHA-256 of PNG data URL (node:crypto)"
  - "isTokenValid: single-use + expiry guard (token_used_at IS NULL AND token_expires_at > now)"
  - "CFO_QUESTIONS: 12 pt-BR questions exported for UI rendering"
  - "createAnamnesisToken: staff inserts PENDING row with 72h expiry; returns public URL"
  - "submitAnamnesisPublic: atomic UPDATE gate (single-use T-2-07); SHA-256+IP+UA; generic error message"
  - "submitAnamnesisPresencial: INSERT-only flow; SHA-256+IP+UA; admin client bypass"
  - "SignatureCanvas: signature_pad v5 wrapper; HiDPI; touchAction:none; pad.off() cleanup (M-8)"
  - "AnamnesisForm: CFO checkboxes + SignatureCanvas; disabled={!signature} (D-19); useTransition"
  - "Public anamnesis page /anamnese/[patient-id]/[token]: Server Component token validation; full-page error on invalid"
  - "createPublicAppointment: service-role; 23P01 capture; source='publico'; patient_id=null"
  - "PublicBookingForm: 4-step flow; slot grid; conflict Alert + Recarregar button"
  - "Public booking page /agendar/[clinic-slug]: Server Component; notFound on bad slug; fetches dentists"
  - "/anamnese added to isPublicRoute in proxy.ts (CLINIC-08)"
affects:
  - "proxy.ts: /anamnese now bypasses auth"
  - "/clinica/pacientes/[id] Anamneses tab stub — still present (to be wired in Phase 3 or post-MVP)"

# Tech tracking
tech-stack:
  added:
    - "signature_pad ^5.1.3 — headless canvas signature library"
  patterns:
    - "Single-use token gate: atomic UPDATE WHERE token_used_at IS NULL AND token_expires_at > now() AND signature_hash='PENDING'"
    - "PENDING sentinel: signature_hash='PENDING' satisfies NOT NULL while marking pre-signature state; single UPDATE transitions to signed"
    - "SHA-256 of PNG DataURL: strip data URI prefix → Buffer.from(base64,'base64') → createHash('sha256').update(buf).digest('hex')"
    - "Public flow auth bypass: createAdminClient() in Server Actions for flows without JWT session (same as invitations acceptInvitation)"
    - "Generic error message: expirado/usado → same string (T-2-07 Pitfall 5 security — no side-channel)"
    - "23P01 capture in public booking: same pattern as createAppointment from Plan 02-02"
    - "patient_id=null in public booking: no CPF placeholder; receptionist links after (avoids unique constraint violation)"
    - "pad.off() on unmount: signature_pad v5 cleanup (M-8 / RESEARCH Padrão 6)"
    - "HiDPI canvas resize: devicePixelRatio scale in useEffect to prevent blurry signatures"

key-files:
  created:
    - src/lib/validators/anamnesis.ts
    - src/actions/anamneses.ts
    - src/actions/public-booking.ts
    - src/components/anamnesis/SignatureCanvas.tsx
    - src/components/anamnesis/AnamnesisForm.tsx
    - src/app/anamnese/[patient-id]/[token]/page.tsx
    - src/app/agendar/[clinic-slug]/page.tsx
    - src/components/booking/PublicBookingForm.tsx
    - src/components/ui/checkbox.tsx
    - src/__tests__/anamnesis/signature.test.ts
  modified:
    - src/__tests__/proxy/rbac.test.ts (added /anamnese public route assertion)
    - src/proxy.ts (added /anamnese to isPublicRoute)
    - package.json (signature_pad added)
    - package-lock.json

key-decisions:
  - "PENDING sentinel for signature_hash: schema requires NOT NULL; 'PENDING' is the only pre-signature state that satisfies this without a schema change; the UPDATE gate includes signature_hash='PENDING' so a re-signed attempt after completion cannot overwrite"
  - "patient_id=null in public booking: avoids CPF placeholder (unique constraint + PII concern); receptionist links patient at reception; contact info in appointment notes"
  - "createAdminClient() for all public flows: no RLS write policy exists for unauthenticated inserts on anamneses; follows acceptInvitation pattern"
  - "Slot generation in PublicBookingForm: 30-min intervals 08:00-18:00; MVP placeholder — production will query actual availability from appointments table"
  - "AnamnesisForm uses native <input type=checkbox> instead of @base-ui/react Checkbox: avoids CfoResponses type complexity with controlled state; functionally equivalent for MVP"

# Metrics
duration: 20 minutes
completed: 2026-06-05
---

# Phase 2 Plan 04: Digital Anamnesis + Public Booking Summary

**Digital anamnesis with handwritten signature (signature_pad v5), SHA-256 PNG hash, single-use token (72h expiry), and public booking link with GIST-atomic slot locking and 23P01 race-condition handling — closes the clinical MVP vertical slice**

## Performance

- **Duration:** ~20 minutes
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 4 (Task 0, 1, 2, 3)
- **Files modified/created:** 14

## Accomplishments

- Zod v3 `anamnesisSchema`: 12 CFO boolean fields + required signature field; rejects empty signature (D-19 gate at schema level)
- Pure functions: `sha256OfPngDataUrl` (node:crypto, deterministic, 64-char hex) + `isTokenValid` (single-use + expiry: T-2-07)
- `CFO_QUESTIONS`: 12 pt-BR questions exported for UI rendering (D-18)
- 18 new Vitest tests for hash determinism, token validity, schema validation, CFO export — all GREEN
- `createAnamnesisToken`: staff-authenticated action; inserts PENDING anamnesis row with `signature_hash='PENDING'` and 72h `token_expires_at`; returns `/anamnese/{patientId}/{token}` URL
- `submitAnamnesisPublic`: atomic conditional UPDATE (`token_used_at IS NULL AND token_expires_at > now() AND signature_hash='PENDING'`); 0 rows → generic message (T-2-07, Pitfall 5); stores SHA-256 + IP + UA; uses `createAdminClient()`
- `submitAnamnesisPresencial`: staff-authenticated INSERT-only; SHA-256 + IP + UA; `flow='presencial'`; `createAdminClient()` for RLS bypass
- `SignatureCanvas`: `signature_pad v5`, `penColor:'#111827'`, `touchAction:'none'`, HiDPI `devicePixelRatio` resize, `pad.off()` cleanup on unmount (M-8), `aria-label="Área de assinatura"`
- `AnamnesisForm`: 12 CFO checkboxes, SignatureCanvas integration, `disabled={!signature}` on submit (D-19), `useTransition` for async, success/error states
- Public anamnesis page `/anamnese/[patient-id]/[token]`: Server Component validates token BEFORE rendering form; full-page error state with `AlertCircle` when invalid/expired/used (never exposes the form)
- `createPublicAppointment`: `createAdminClient()`; resolves clinic by slug; `patient_id=null`; `source='publico'`; captures `23P01` exclusion_violation → friendly message (Pitfall 7 / T-2-01)
- `PublicBookingForm`: 4-step UI (dentista → data → horário → dados); 30-min slot grid; conflict Alert with "Recarregar horários" button; "Confirmar Agendamento" CTA; all touch targets ≥ 44px
- Public booking page `/agendar/[clinic-slug]`: `notFound()` on bad slug; fetches dentists via service role
- `proxy.ts`: `/anamnese` added to `isPublicRoute` (CLINIC-08)
- 154/154 tests GREEN; `npx tsc --noEmit` exits 0

## Task Commits

1. **Task 0: CFO validator + SHA-256/token/schema tests** — `4703184`
2. **Task 1: Anamneses Server Actions** — `9d1cf9d`
3. **Task 2: SignatureCanvas + AnamnesisForm + public anamnesis page** — `1a4d8ac`
4. **Task 3: Public booking + proxy update** — `581f825`

## Files Created/Modified

**Validators:**
- `src/lib/validators/anamnesis.ts` — anamnesisSchema, sha256OfPngDataUrl, isTokenValid, CFO_QUESTIONS, AnamnesisInput, CfoResponses

**Server Actions:**
- `src/actions/anamneses.ts` — createAnamnesisToken + submitAnamnesisPublic (single-use gate) + submitAnamnesisPresencial
- `src/actions/public-booking.ts` — createPublicAppointment (23P01 capture, source='publico', patient_id=null)

**Components:**
- `src/components/anamnesis/SignatureCanvas.tsx` — signature_pad v5 wrapper, HiDPI, cleanup
- `src/components/anamnesis/AnamnesisForm.tsx` — CFO form + SignatureCanvas + disabled gate
- `src/components/booking/PublicBookingForm.tsx` — 4-step booking flow + slot grid + 23P01 UI

**Pages:**
- `src/app/anamnese/[patient-id]/[token]/page.tsx` — public token-validated anamnesis page
- `src/app/agendar/[clinic-slug]/page.tsx` — public booking page with clinic resolution

**UI Components:**
- `src/components/ui/checkbox.tsx` — via shadcn (base-ui/react/checkbox primitive)

**Tests:**
- `src/__tests__/anamnesis/signature.test.ts` — 18 tests (hash determinism, token validity, schema, CFO_QUESTIONS)

**Modified:**
- `src/proxy.ts` — /anamnese added to isPublicRoute
- `src/__tests__/proxy/rbac.test.ts` — /anamnese assertion added (was RED, now GREEN after Task 3)
- `package.json` — signature_pad ^5.1.3

## Decisions Made

- **PENDING sentinel**: `signature_hash='PENDING'` satisfies NOT NULL while marking pre-signature state; the UPDATE gate's `AND signature_hash='PENDING'` prevents any re-write after signing — this is the D-20 immutability contract for the public flow
- **patient_id=null in public booking**: avoids CPF placeholder (unique constraint violation + PII risk); staff links the patient at the reception desk; contact info stored in `notes` field
- **Slot generation in client**: 30-min slots 08:00–18:00 generated client-side for MVP; production should query actual `appointments` availability from the DB (deferred — no real-time availability API in scope for this wave)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AnamnesisForm buildInitialResponses TypeScript cast**
- **Found during:** Task 2 TypeScript check
- **Issue:** `Record<string, boolean>` cast to `CfoResponses` (strict Zod inferred type with named keys) produced TS2352 — neither type sufficiently overlaps
- **Fix:** Replaced generic `Record<string, boolean>` initializer with explicit object literal matching `CfoResponses` shape
- **Files modified:** `src/components/anamnesis/AnamnesisForm.tsx`
- **Commit:** `1a4d8ac`

**2. [Rule 2 - Missing critical] AnamnesisForm uses native checkbox vs @base-ui/react Checkbox**
- **Found during:** Task 2 implementation
- **Issue:** `@base-ui/react/checkbox` Checkbox primitive uses `data-checked` state; integrating it with controlled `CfoResponses` state required additional wiring and the `checked`/`onCheckedChange` prop naming differs from HTML `checked`/`onChange`
- **Fix:** Used native `<input type="checkbox">` with `checked`/`onChange` for the CFO question list — functionally equivalent, avoids prop mismatch, consistent with Plan 02-02 pattern of using native inputs for simple controlled forms
- **Files modified:** `src/components/anamnesis/AnamnesisForm.tsx`
- **Commit:** `1a4d8ac`

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Anamneses tab in patient detail | `src/app/(dashboard)/clinica/pacientes/[id]/page.tsx` | Stub from Plan 02-02 — wiring the tab to the anamnesis list/create flow is a Phase 3 task (post-MVP UI polish) |
| Slot availability (client-side only) | `src/components/booking/PublicBookingForm.tsx` | 30-min slots generated client-side; production requires querying `appointments` table to exclude booked slots — deferred |

## Threat Flags

No new security surface beyond what was planned in the threat model (T-2-07, T-2-01, T-2-14, T-2-16, T-2-08 — all mitigated as designed).

| Mitigated | File | Description |
|-----------|------|-------------|
| T-2-07 (Spoofing — token reuse) | `src/actions/anamneses.ts` | Atomic UPDATE gate: token_used_at IS NULL AND token_expires_at>now() AND signature_hash='PENDING'; generic error message (no side-channel) |
| T-2-01 (Tampering — double-booking race) | `src/actions/public-booking.ts` | 23P01 exclusion_violation captured; GIST constraint atomic |
| T-2-14 (Tampering — anamnesis mutability) | `src/actions/anamneses.ts` | PENDING→signed transition is single-use; no UPDATE path after token_used_at set |
| T-2-08 (Privacy — IP in logs) | `src/actions/anamneses.ts`, `src/actions/public-booking.ts` | Only IDs in audit log details; IP/UA stored only in anamneses row |

---

## Self-Check: PASSED

Files exist:
- `src/lib/validators/anamnesis.ts` ✓
- `src/actions/anamneses.ts` ✓
- `src/actions/public-booking.ts` ✓
- `src/components/anamnesis/SignatureCanvas.tsx` ✓
- `src/components/anamnesis/AnamnesisForm.tsx` ✓
- `src/app/anamnese/[patient-id]/[token]/page.tsx` ✓
- `src/app/agendar/[clinic-slug]/page.tsx` ✓
- `src/components/booking/PublicBookingForm.tsx` ✓
- `src/__tests__/anamnesis/signature.test.ts` ✓

Commits exist:
- `4703184` test(02-04): CFO validator + SHA-256/token/schema tests GREEN ✓
- `9d1cf9d` feat(02-04): anamneses Server Actions ✓
- `1a4d8ac` feat(02-04): SignatureCanvas + AnamnesisForm + public anamnesis page ✓
- `581f825` feat(02-04): public booking action + /agendar page + /anamnese proxy route ✓

*Phase: 02-clinical-mvp*
*Completed: 2026-06-05*
