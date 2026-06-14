---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "05"
subsystem: ocr-extraction-review
tags: [ocr, ai, gateway, lgpd, zdr, multimodal, generateObject, FilePart]
dependency_graph:
  requires:
    - 10-02 (ocr_extractions migration + schema)
    - src/app/api/copilot/route.ts (AI Gateway ZDR pattern reference)
    - src/lib/ai/masking.ts (maskCPF — T-10-21)
    - src/actions/patients.ts (createPatient — reused by confirmOcrExtraction)
    - src/lib/auth/guards.ts (assertNotReadOnly)
    - src/lib/audit.ts (logBusinessEvent)
  provides:
    - src/lib/ai/ocr-confidence.ts (needsReview + minConfidence pure helpers)
    - src/app/api/ocr/route.ts (POST /api/ocr — multimodal extraction via Gateway)
    - src/actions/ocr-actions.ts (confirmOcrExtraction + rejectOcrExtraction)
  affects:
    - Plan 06 (db push — ocr_extractions table used at runtime)
    - Future OCR UI (upload form calls /api/ocr; review form calls ocr-actions)
tech_stack:
  added: []
  patterns:
    - generateObject with FilePart (AI SDK v6 multimodal — base64 + mediaType)
    - zeroDataRetention:true on Gateway call (LGPD — T-10-20)
    - Pure helper in non-'use server' file (unit-testable without route imports)
    - MIME allowlist + size guard (T-10-22: 415/413 responses)
    - maskCPF before any log (T-10-21: no raw CPF in server logs)
    - Reuse existing createPatient action (no duplicate patient insert logic — OCR-02)
    - Tenant scope on both read (RLS createClient) and write (.eq clinic_id) guards
key_files:
  created:
    - src/lib/ai/ocr-confidence.ts
    - src/app/api/ocr/route.ts
    - src/actions/ocr-actions.ts
  modified: []
decisions:
  - "FilePart uses 'mediaType' not 'mimeType' in AI SDK v6 @ai-sdk/provider-utils — auto-fixed at implementation"
  - "needsReview accepts optional threshold arg so tests can verify custom threshold behaviour without reimporting"
  - "confirmOcrExtraction maps OCR birth_date → PatientInput.date_of_birth to align with existing patient schema"
  - "logBusinessEvent logs extractionId + target_id only — never raw CPF field value (T-10-21)"
  - "Route uses createAdminClient for ocr_extractions insert (service-role needed to resolve clinic_id from users table)"
metrics:
  duration: "~3 minutes"
  completed: "2026-06-14T17:11:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 10 Plan 05: OCR Extract Route + Confidence Review/Commit Summary

**One-liner:** AI Gateway multimodal OCR route (generateObject + FilePart + ZDR) with pure needsReview threshold helper gating low-confidence extractions to pending_review, plus confirm/reject Server Actions that commit reviewed fields to the patient cadastro via the existing createPatient path.

## What Was Built

### ocr-confidence.ts (pure threshold helpers — OCR-02)

`src/lib/ai/ocr-confidence.ts`

Pure module (no `server-only`, no Supabase imports) so unit tests can import it directly without loading the route:

- `OCR_CONFIDENCE_THRESHOLD = 0.80` — exported constant
- `needsReview(fields, threshold?)` — returns true if ANY field's confidence is strictly below threshold (defaults to 0.80); false for empty fields map
- `minConfidence(fields)` — returns minimum confidence across fields; returns 1.0 for empty map
- Optional `threshold` parameter allows tests to verify custom threshold behaviour without separate module

### /api/ocr/route.ts (OCR-01 + OCR-02)

`src/app/api/ocr/route.ts`

POST endpoint with `export const runtime = 'nodejs'` (mirrors copilot/route.ts). Full security stack:

- **T-10-25**: `auth.getUser()` gate → 401 for unauthenticated requests
- **T-10-22**: MIME allowlist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) → 415 for unsupported types; 4 MB size guard → 413
- **API key at call-time**: reads `process.env.AI_GATEWAY_API_KEY` → 503 if absent (never module scope — Pitfall 2)
- **generateObject** with `PatientDocumentSchema` (Zod): per-field `{ value, confidence }` for `full_name`, `cpf`, `birth_date`, `address`
- **FilePart**: `{ type: 'file', data: base64, mediaType: mimeType }` — AI SDK v6 property (`mediaType` not `mimeType`)
- **ZDR**: `providerOptions: { gateway: { zeroDataRetention: true } satisfies GatewayProviderOptions }` on every call (T-10-20 — LGPD)
- **OCR-02**: `needsReview(object)` → `status = 'pending_review' | 'approved'`; `minConfidence(object)` stored as `min_confidence`
- **T-10-21**: `maskCPF(object.cpf.value)` applied before any console.log; raw extraction object never logged
- Inserts into `ocr_extractions` via `createAdminClient` (service-role needed to resolve `users.tenant_id`)
- Returns `{ extractionId, needsReview, fields: object }` to caller

### ocr-actions.ts (OCR-02 review → commit)

`src/actions/ocr-actions.ts`

`'use server'`, async-only exports:

**`confirmOcrExtraction(extractionId, editedFields)`**:
1. `assertNotReadOnly()` — blocks read-only roles
2. Zod validation on `editedFields` (same CPF format regex as patientSchema)
3. Loads extraction via `createClient` (RLS tenant-scoped) with explicit `.eq('clinic_id', actor.tenant_id)` guard
4. Guards: rejects deleted, already-committed, already-rejected extractions with descriptive errors
5. Maps OCR `birth_date` → `PatientInput.date_of_birth`; calls **existing `createPatient()`** — no duplicate patient insert logic
6. Updates `ocr_extractions` to `status='committed'`, `reviewed_by`, `reviewed_at`, `target_id=patientId`
7. `logBusinessEvent` with `{ extractionId, target_table: 'patients', target_id: patientId }` — IDs only, no raw CPF (T-10-21)

**`rejectOcrExtraction(extractionId, reason?)`**:
1. `assertNotReadOnly()` + actor
2. Guards: rejects deleted/already-committed/already-rejected extractions
3. Updates to `status='rejected'`, `reviewed_by`, `reviewed_at`
4. `logBusinessEvent` with `{ extractionId, reason }` — no patient data

## Verification

- `npx vitest run src/__tests__/ocr/extract.test.ts` — **12/12 GREEN**
- `npx vitest run` (full suite) — **910/910 GREEN** (no regressions)
- `npx tsc --noEmit` — **exit 0** (clean)
- Route source-inspection: runtime nodejs, generateObject, type:'file', zeroDataRetention:true, ocr_extractions, pending_review, maskCPF — all present

## Commits

| Hash | Message |
|------|---------|
| `dcab4ae` | feat(10-05): ocr-confidence.ts pure helper + /api/ocr route (OCR-01/02) |
| `cd36a36` | feat(10-05): ocr-actions.ts confirm/reject review actions (OCR-02) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FilePart.mediaType vs mimeType property name**
- **Found during:** Task 1 — `npx tsc --noEmit` after writing the route
- **Issue:** AI SDK v6 `FilePart` type in `@ai-sdk/provider-utils` uses `mediaType` (IANA media type property), not `mimeType`. The RESEARCH.md examples used `mimeType` which caused `TS2353: Object literal may only specify known properties`.
- **Fix:** Changed `{ type: 'file', data: base64, mimeType }` to `{ type: 'file', data: base64, mediaType: mimeType }` in the route. Added a comment noting the AI SDK v6 property name.
- **Files modified:** `src/app/api/ocr/route.ts`
- **Commit:** `dcab4ae`

## Known Stubs

None — the route and actions are fully wired to real data sources:
- `/api/ocr` calls `generateObject` with real FilePart (no mock model)
- `confirmOcrExtraction` calls `createPatient` which writes to the real `patients` table
- `ocr_extractions` insert uses `createAdminClient` writing to the real table (pending Plan 06 db push)

Note: the table does not yet exist in the remote DB (Plan 06 is the single db push), but the code writes correctly against the planned schema shape.

## Threat Flags

No new threat surface beyond what the plan's threat model documents:
- `/api/ocr` is a new network endpoint — guarded by auth gate (T-10-25), MIME allowlist (T-10-22), ZDR (T-10-20)
- All mitigations from the plan's STRIDE threat register (T-10-20 through T-10-25) are implemented

## Self-Check: PASSED

- [x] `src/lib/ai/ocr-confidence.ts` — exists, committed in dcab4ae
- [x] `src/app/api/ocr/route.ts` — exists, committed in dcab4ae
- [x] `src/actions/ocr-actions.ts` — exists, committed in cd36a36
- [x] 12/12 ocr/extract.test.ts GREEN
- [x] 910/910 full test suite GREEN (no regressions)
- [x] tsc exit 0
- [x] Route: `export const runtime = 'nodejs'` present
- [x] Route: `generateObject` present
- [x] Route: `type: 'file'` FilePart present
- [x] Route: `zeroDataRetention: true` present
- [x] Route: `ocr_extractions` present
- [x] Route: `pending_review` present
- [x] Route: `maskCPF` referenced before any log
- [x] confirmOcrExtraction reuses existing `createPatient()` — no duplicate patient insert
- [x] logBusinessEvent logs IDs only — no raw CPF
- [x] No db push (deferred to Plan 06 [BLOCKING])
