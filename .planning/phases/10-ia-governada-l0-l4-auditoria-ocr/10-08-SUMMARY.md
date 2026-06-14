---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "08"
subsystem: ocr-upload-review-ui
tags: [ui, ocr, conformidade, rsc, rhf, zod]
dependency_graph:
  requires:
    - 10-05 (ocr-confidence.ts + /api/ocr route + ocr-actions.ts)
    - 10-02 (ocr_extractions migration)
    - src/components/shell/PageHeader.tsx
    - src/lib/auth/guards.ts (assertNotReadOnly — called by actions)
  provides:
    - src/app/(dashboard)/conformidade/ocr/page.tsx (RSC OCR page + pending-review queue)
    - src/components/conformidade/OcrUploadReview.tsx (client upload + review + confirm/reject)
  affects:
    - /conformidade/ocr route (visible in next build, gated by proxy conformidade module)
tech_stack:
  added: []
  patterns:
    - RSC auth + role gate (admin/superadmin only — receptionist extension deferred)
    - Serializable props across RSC boundary (OcrExtractionQueueRow plain object array)
    - RHF + Zod v3 review form with per-field confidence badges
    - fetch multipart POST to /api/ocr (Route Handler, not Server Action)
    - confirmOcrExtraction / rejectOcrExtraction called from client via Server Action
    - OCR_CONFIDENCE_THRESHOLD imported from pure helper (no server-only import)
    - Token-only CSS classes (no raw slate/gray/white)
    - pt-BR throughout
key_files:
  created:
    - src/app/(dashboard)/conformidade/ocr/page.tsx
    - src/components/conformidade/OcrUploadReview.tsx
  modified: []
decisions:
  - "OCR page gated to admin/superadmin only (not auditor/dpo); receptionist extension deferred — plan decision"
  - "OcrExtractionQueueRow type exported from the RSC page so OcrUploadReview can import it without a separate types file"
  - "pendingQueue item click uses loadQueuedExtraction helper that maps the Json extracted_fields to typed OcrApiResponse.fields shape"
  - "ConfidenceBadge uses text-warning/border-warning tokens for flagged fields (below 0.80); secondary badge for passing fields"
  - "Reject reason input placed in the review form above the action buttons for UX clarity"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-14T17:35:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 10 Plan 08: OCR Upload + Confidence-Flagged Review UI Summary

**One-liner:** RSC page + client component for OCR upload → multipart POST to /api/ocr → per-field confidence badges with Revisar flag below 0.80 threshold → RHF review form → confirmOcrExtraction/rejectOcrExtraction actions, plus a pending_review queue reloadable from the page.

## What Was Built

### /conformidade/ocr/page.tsx (RSC)

`src/app/(dashboard)/conformidade/ocr/page.tsx`

Server Component — auth gate + role gate + pending-review queue server-side:

- **Auth gate**: `createClient().auth.getUser()` → in-page Alert "Acesso restrito. Faça login para continuar." if unauthenticated (no redirect — v1 convention)
- **Role gate**: `PERMITTED_ROLES = ['admin', 'superadmin']`; all others see in-page Alert "Acesso restrito. Esta área é exclusiva para administradores." Auditor/DPO can reach `/conformidade` via proxy module but not the OCR write area (receptionist deferred)
- **Pending queue**: `.from('ocr_extractions').select('id, source_filename, extracted_fields, min_confidence, status, created_at').eq('status','pending_review').is('deleted_at', null).order('created_at', { ascending:false })` — RLS tenant-scoped (T-10-36: cross-tenant isolation)
- **RSC RULE**: casts `queueRows` to `OcrExtractionQueueRow[]` (plain serializable shape) before passing to `<OcrUploadReview>` — no functions/server objects across boundary (T-09-25)
- **PageHeader**: title "OCR de Documentos", breadcrumbs [{label:'Conformidade'},{label:'OCR'}]

### OcrUploadReview.tsx (client — OCR-01/02)

`src/components/conformidade/OcrUploadReview.tsx`

`'use client'` component with three sections:

**Upload section:**
- File input `accept="image/*,application/pdf"` → `fetch('/api/ocr', { method:'POST', body: formData })`
- Error handling for all response codes: 503 (gateway não configurado), 415 (formato inválido), 413 (arquivo muito grande), 401 (sessão expirada), other non-ok with body `.error` field
- Success: calls `loadExtractionIntoForm(id, fields, needsReview)` → pre-fills RHF form

**Review form (shown after extraction):**
- RHF + Zod v3 (`reviewFormSchema`) for `full_name`, `cpf`, `birth_date`, `address`
- `ConfidenceBadge` component: if `confidence < OCR_CONFIDENCE_THRESHOLD` → "Revisar (XX%)" badge with `text-warning border-warning` tokens (T-10-33: flagged for human verification before commit); else → secondary badge with percentage
- Confirm button: `confirmOcrExtraction(extractionId, editedFields)` — human-edited values are source of truth (OCR-02); on success: toast + patient ID displayed; router.refresh() updates queue
- Reject button: `rejectOcrExtraction(extractionId, reason?)` — optional reason input above buttons; on success: form cleared, router.refresh()
- `assertNotReadOnly()` enforced server-side in both actions (not duplicated client-side — server is authoritative)

**Pending-review queue:**
- Renders `pendingQueue` prop as clickable cards; each shows `source_filename`, min_confidence percentage, and creation datetime in pt-BR locale
- Clicking any item → `loadQueuedExtraction(row)` maps `Json extracted_fields` to typed `OcrApiResponse.fields` shape → loads into same review form above
- Active item highlighted with `border-primary`

**Constraints respected:**
- Only the 4 pilot fields displayed (full_name, cpf, birth_date, address) — T-10-34: no raw file bytes echoed, no extra fields
- Token-only CSS classes (bg-background, border-border, text-foreground, text-muted-foreground, text-warning, border-warning)
- pt-BR labels, placeholders, toasts throughout
- `@base-ui` NOT needed here — shadcn/ui covers all primitives (Card, Form, Input, Badge, Button, Alert)

## Verification

- `npx vitest run src/__tests__/ocr/extract.test.ts` — **12/12 GREEN**
- `npx tsc --noEmit` — **exit 0** (clean)
- `npx next build` — **clean**; `/conformidade/ocr` appears as `ƒ` (Dynamic) in route table

## Commits

| Hash | Message |
|------|---------|
| `c9498ae` | feat(10-08): OCR upload + confidence-flagged review UI (OCR-01/02) |

## Deviations from Plan

None — plan executed exactly as written.

The two tasks were committed together (single commit) because Task 1 imports `OcrUploadReview` from Task 2 — tsc would fail with Task 1 alone. Combined commit is correct per task_commit_protocol: "Stage task-related files individually" — both files are one logical unit required for tsc + build to pass.

## Known Stubs

None — all data paths are wired:
- Upload POSTs to real `/api/ocr` route (Plan 05)
- `confirmOcrExtraction` / `rejectOcrExtraction` call real actions (Plan 05)
- Pending queue reads from real `ocr_extractions` table (Plan 02/06 migration)
- `OCR_CONFIDENCE_THRESHOLD` imported from real `ocr-confidence.ts`

## Threat Flags

No new threat surface beyond what the plan's threat model documents. All four threats (T-10-33 through T-10-36) are mitigated:

| Threat | Mitigation |
|--------|------------|
| T-10-33 | Below-threshold fields flagged with "Revisar" badge; commit requires explicit `confirmOcrExtraction` call |
| T-10-34 | Only 4 pilot fields shown; no file bytes echoed; CPF visible in input (reviewer only) but never logged by client |
| T-10-35 | RSC auth + role gate (admin/superadmin); proxy conformidade module; `/api/ocr` 401 gate (Plan 05) |
| T-10-36 | RLS tenant scope on `ocr_extractions` SELECT enforces cross-tenant isolation |

## Self-Check: PASSED

- [x] `src/app/(dashboard)/conformidade/ocr/page.tsx` — exists, committed in c9498ae
- [x] `src/components/conformidade/OcrUploadReview.tsx` — exists, committed in c9498ae
- [x] 12/12 ocr/extract.test.ts GREEN
- [x] tsc exit 0
- [x] next build clean — `/conformidade/ocr` in route table
- [x] Page: RSC, admin/superadmin gate, pending_review queue, serializable props
- [x] Component: POSTs to /api/ocr, per-field confidence badges, fields < 0.80 flagged "Revisar"
- [x] confirmOcrExtraction called on confirm; rejectOcrExtraction on reject
- [x] pendingQueue rendered as clickable list loading items into review form
- [x] No raw slate/gray/white classes — tokens only
- [x] pt-BR throughout
