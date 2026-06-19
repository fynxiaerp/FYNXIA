---
phase: 12-receitu-rio-teleodontologia
plan: 06
subsystem: receituario
tags: [receituario, ui, forms, allergy, signing, proxy, navigation]
requires:
  - "src/actions/clinical-documents.ts (issueClinicDocument/signClinicDocument/listClinicDocuments — Plan 04)"
  - "src/lib/validators/clinical-document.ts (clinicalDocumentSchema — Plan 02)"
  - "src/lib/crypto.ts (decrypt — content_json AES-256-GCM)"
provides:
  - "receituario + teleodontologia ModuleKeys registered in proxy.ts (MODULE_PERMISSIONS + ROUTE_MODULE_MAP most-specific-first) + nav-config + nav-icons (RSC string-key)"
  - "ClinicalDocumentForm (RHF + Zod v3 issue form + existingDocument read/sign view)"
  - "AllergyAlert (non-blocking amber warning)"
  - "/clinica/receituario list + /clinica/receituario/[id] issue/read/sign RSC pages (nodejs runtime)"
affects:
  - "src/proxy.ts (shared shell — owned by this plan so Plan 07 stays parallel-safe)"
  - "src/components/shell/nav-config.ts + nav-icons.ts (shared nav)"
tech-stack:
  patterns:
    - "RHF v7 + zodResolver(clinicalDocumentSchema) Zod v3, no .default() (D-133)"
    - "@base-ui Button render-prop (render={<Link/>}), NEVER asChild"
    - "RSC string-key icons (NAV_ICONS client-only map), nodejs runtime on PDF/sign routes"
    - "server-side decrypt of content_json — only display-safe content reaches client (T-12-19/T-12-21)"
key-files:
  created:
    - "src/components/receituario/AllergyAlert.tsx"
    - "src/components/receituario/ClinicalDocumentForm.tsx"
    - "src/app/(dashboard)/clinica/receituario/page.tsx"
    - "src/app/(dashboard)/clinica/receituario/[id]/page.tsx"
  modified:
    - "src/proxy.ts"
    - "src/components/shell/nav-config.ts"
    - "src/components/shell/nav-icons.ts"
decisions:
  - "Extended ClinicalDocumentForm with an optional existingDocument prop (mirrors TeleconsultationForm's existingSession) to render the [id] read/sign view, keeping Task 2 at 4 files instead of adding a separate sign-button island."
metrics:
  duration: ~25m
  completed: 2026-06-19
  tasks: 2
  files: 7
---

# Phase 12 Plan 06: Receituário UI + Module Registration Summary

RHF+Zod v3 clinical-document emission UI (receita/atestado/exame) with a non-blocking allergy alert and ICP-Brasil signing, plus registration of the `receituario` + `teleodontologia` modules across proxy + nav (this plan owns the shared shell so Plan 07 stayed parallel-safe).

## What Was Built

### Task 1 — Module registration (proxy + nav-config + nav-icons) — commit 6d0fdb2
- `ModuleKey` extended with `'receituario' | 'teleodontologia'`.
- `MODULE_PERMISSIONS` mirrors the `documentos` access set on both modules: superadmin/admin/dentist write; auditor/dpo/socio readOnly; receptionist/ti/implantacao/aluno excluded (clinical authorship is dentist-scoped).
- `ROUTE_MODULE_MAP` inserts `/clinica/receituario` + `/clinica/teleodontologia` BEFORE the generic `/clinica` entry (Pitfall 6 — most-specific-first).
- The derived read-only branch (`mod === 'financeiro' || 'documentos' || 'receituario' || 'teleodontologia'`) sets `x-read-only` for readOnly roles.
- `nav-config.ts`: `NavIconKey` union + two `ALL_NAV_ITEMS` entries (not adminOnly — dentists need them).
- `nav-icons.ts`: imported `FileHeart` + `Video`; `NAV_ICONS` maps `receituario: FileHeart`, `teleodontologia: Video` (RSC string-key — no component crosses the server/client boundary).

### Task 2 — ClinicalDocumentForm + AllergyAlert + pages — commit 04d8a02
- **AllergyAlert** (`'use client'`): amber non-blocking warning; returns null when `reasons` is empty; never disables submit (D-02).
- **ClinicalDocumentForm** (`'use client'`): RHF + `zodResolver(clinicalDocumentSchema)`; `doc_type` Select drives conditional fields — receita rows (medication combobox filtered to `requires_special_control` for controle-especial + `common_dosages` quick-pick + posologia + quantidade), atestado (motivo + dias), solicitação de exame; shared observações + portal_visible. On submit → `issueClinicDocument`; renders `<AllergyAlert>` non-blocking when `allergyAlert.reasons` returns; draft → "Assinar (ICP-Brasil)" → `signClinicDocument` → immutable signed stamp. Extended with an optional `existingDocument` prop that renders the read/sign view for a loaded document (signed = immutable, draft = sign CTA).
- **/clinica/receituario** (RSC, `runtime = 'nodejs'`): `listClinicDocuments` (never returns storage_path), patient-name lookup, table (número/tipo/paciente/status/data) + EmptyState + issue CTA; x-read-only hides the CTA.
- **/clinica/receituario/[id]** (RSC, `runtime = 'nodejs'`): `novo` → create form (fetches active `medications` + clinic patients); uuid → tenant-scoped fetch (no storage_path/cert_pem), server-side `decrypt(content_json)`, read/sign view via `existingDocument`.

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run src/__tests__/receituario/ src/__tests__/proxy/ src/__tests__/rbac/` → 5 files, 148 tests GREEN.
- `npx next build` → Compiled successfully; `/clinica/receituario` + `/clinica/receituario/[id]` registered as dynamic (ƒ) routes; no 'use server' sync-export or RSC-across-boundary errors. (Only a pre-existing workspace-root lockfile warning, unrelated.)

## Threat Model Coverage

- T-12-26 (EoP, non-clinical role): MODULE_PERMISSIONS gates receituario to dentist/admin/superadmin (write) + auditor/dpo/socio (readOnly); ROUTE_MODULE_MAP resolves the module before /clinica. Mitigated.
- T-12-27 (Info disclosure, storage_path/cert_pem): list page uses listClinicDocuments (explicit columns, no storage_path); [id] read select excludes storage_path/cert_pem. Mitigated.
- T-12-28 (Tampering, edit signed doc): existingDocument read view renders signed docs immutable (no sign CTA); action `.is('signature', null)` backstop. Mitigated.
- T-12-29 (Tampering, suppress allergy alert): alert is informative-only; server runs checkMedicationAllergy regardless of UI. Mitigated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generalized handleSign + onClick to support existing-document signing**
- **Found during:** Task 2
- **Issue:** The plan's [id] read view needs to sign an existing draft, but the form's `handleSign` was hardcoded to `issuedDocId` (only set after a fresh issue). The pre-existing `onClick={handleSign}` would also have passed a MouseEvent as the doc id.
- **Fix:** `handleSign(docId?)` now accepts an optional id (defaults to `issuedDocId`); the draft-branch call is `onClick={() => handleSign()}`; the existing-document branch calls `handleSign(existingDocument.id)`. Added an `existingDocument` prop + read/sign render branch (mirrors TeleconsultationForm's `existingSession` pattern) to keep Task 2 at the planned 4 files rather than adding a separate sign-button island.
- **Files modified:** src/components/receituario/ClinicalDocumentForm.tsx
- **Commit:** 04d8a02

## Known Stubs

None — the form, allergy alert, list, and issue/read/sign pages are all wired to the Plan 04 actions and Plan 02 schema with live data sources (medications, patients, clinical_documents).

## Self-Check: PASSED

- FOUND: src/components/receituario/AllergyAlert.tsx
- FOUND: src/components/receituario/ClinicalDocumentForm.tsx
- FOUND: src/app/(dashboard)/clinica/receituario/page.tsx
- FOUND: src/app/(dashboard)/clinica/receituario/[id]/page.tsx
- FOUND: commit 6d0fdb2 (Task 1 — module registration)
- FOUND: commit 04d8a02 (Task 2 — UI + pages)
