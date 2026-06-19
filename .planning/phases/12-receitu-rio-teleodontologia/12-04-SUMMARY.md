---
phase: 12-receitu-rio-teleodontologia
plan: "04"
subsystem: receituario-teleodontologia-actions
tags: [receituario, teleodontologia, server-actions, pdf, signing, allergy, soap, icp-brasil]
dependency_graph:
  requires:
    - 12-02  # medications + clinical_documents + next_doc_number + allergy-check + formatDocNumber + Zod schema
    - 12-03  # teleconsultations + soap_records + Zod validators
    - 08-02  # signPdfBuffer + sign-document.ts (Phase 8 signing engine — IMPORTED, never modified)
  provides:
    - issueClinicDocument (clinical-documents.ts)
    - signClinicDocument (clinical-documents.ts)
    - listClinicDocuments (clinical-documents.ts)
    - createTeleconsultation (teleconsultations.ts)
    - startTeleconsultation / endTeleconsultation (teleconsultations.ts)
    - createSoapRecord (teleconsultations.ts)
    - listTeleconsultations (teleconsultations.ts)
    - ReceituarioPDF / AtestadoPDF / ExamePDF (PDF components)
  affects:
    - 12-06  # Wave 4 receituário UI — forms call issueClinicDocument + signClinicDocument
    - 12-07  # Wave 4 teleconsultation UI — forms call createTeleconsultation + createSoapRecord
tech_stack:
  added: []
  patterns:
    - "@react-pdf/renderer createElement + renderToBuffer (Flexbox-only, Roboto font)"
    - "atomic .is('signature', null) race guard (Phase 8 pattern, now applied to clinical_documents)"
    - "server-side consent_ip from x-forwarded-for headers (T-12-18)"
    - "checkMedicationAllergy called after decrypt() inside action — plaintext never leaves server"
    - "as unknown as ReactElement<DocumentProps> cast for renderToBuffer type compatibility"
key_files:
  created:
    - src/components/pdf/ReceituarioPDF.tsx
    - src/components/pdf/AtestadoPDF.tsx
    - src/components/pdf/ExamePDF.tsx
    - src/actions/clinical-documents.ts
    - src/actions/teleconsultations.ts
  modified: []
decisions:
  - "renderToBuffer cast: used 'as unknown as ReactElement<DocumentProps>' to bridge our PDF component props to @react-pdf/renderer's DocumentProps type — runtime is correct (all components return <Document>), this is a TypeScript structural mismatch only"
  - "content_json insert uses 'as never' cast on .from() and .insert() — new tables (clinical_documents, teleconsultations, soap_records) not yet in database.types.ts; resolved at Plan 05 db push per plan note_on_tsc"
  - "signClinicDocument does NOT re-render with signatureBlock in props — the PDF bytes that are signed are the SAME as what was rendered (deterministic Pitfall 1); the signature metadata is stored in the DB row and used by the UI to display the block"
metrics:
  duration_minutes: 8
  tasks_completed: 3
  files_created: 5
  files_modified: 0
  completed_date: "2026-06-18"
---

# Phase 12 Plan 04: Server Actions + PDFs Summary

**One-liner:** Receituário + teleodontologia Server Action + PDF layer — issue/sign/list clinical docs with AES-encrypted content + Phase 8 ICP-Brasil signing reuse, and teleconsultation create/start/end/SOAP with server-side CFO consent IP.

## What Was Built

### Task 1 — ReceituarioPDF + AtestadoPDF + ExamePDF (commit 59fbf5a)

Three `@react-pdf/renderer` components mirroring `DocumentoPDF.tsx` (Phase 8):

- **ReceituarioPDF:** Handles `receita_simples` and `receita_controle_especial`. Renders patient name, numbered medication blocks (nome + posologia + quantidade), optional observações, a Portaria SVS/MS 344/98 notice for controle especial, professional name + CRO, and draft/signed block.
- **AtestadoPDF:** Standard atestado with patient name, motivo text, optional afastamento dias block, professional + CRO.
- **ExamePDF:** Solicitação de exame with patient name, solicitação text body, professional + CRO.

All three: Roboto font (same Google Fonts URLs as DocumentoPDF), Flexbox-only (no CSS Grid), `generatedAt` received as prop from `row.created_at` (deterministic — Pitfall 1), amber RASCUNHO label when unsigned, green ICP-Brasil signature block when signed.

### Task 2 — clinical-documents.ts Server Actions (commit 9592922 + fix 442fb33)

`issueClinicDocument`:
1. `assertNotReadOnly()` + getActor + role gate (admin/superadmin/dentist)
2. `clinicalDocumentSchema.safeParse` + doc-type conditional requiredness checks
3. RX-02: fetch `patients.allergies` via admin → `decrypt()` → `checkMedicationAllergy()` per medication line (non-blocking — alert returned alongside success, never aborts)
4. RX-01: `supabase.rpc('next_doc_number', ...)` + `formatDocNumber(docType, seq, year)`
5. Resolve `professional_id` from input or via professionals WHERE user_id = actor.id
6. Build `content_json` per doc_type → `encrypt(JSON.stringify(...))` (T-12-19)
7. Insert `clinical_documents` draft row with `portal_visible` flag (RX-03)
8. `logBusinessEvent('clinical_document.issued')` — IDs only, no PII

`signClinicDocument`:
- Mirrors Phase 8 `signDocument` exactly on `clinical_documents` table
- Admin fetch bypasses REVOKE → already-signed guards → cross-tenant guard → cert fetch → clinic/professional/patient name fetch → `decrypt(content_json)` → pick PDF component by `doc_type` → `renderToBuffer` → `signPdfBuffer` (Phase 8, NEVER modified) → upload to `clinical-documents-pdf` → atomic `.is('signature', null)` update → rollback on 0-row result → `logBusinessEvent`

`listClinicDocuments`: RLS-scoped, never selects `storage_path` or `cert_pem` (T-12-21).

### Task 3 — teleconsultations.ts Server Actions (commit 1907877 + fix 442fb33)

`createTeleconsultation`: assertNotReadOnly + getActor + role gate + `teleconsultationSchema.safeParse` → server-side IP capture (`x-forwarded-for` first token or `x-real-ip`) → insert with `consent_ip` + `consent_given_at = now()` server-set (T-12-18); consent_ip excluded from audit log (LGPD).

`startTeleconsultation`: consent_given guard + `started_at` + `status='em_andamento'` (tenant-scoped).

`endTeleconsultation`: `ended_at` + `status='concluida'` (tenant-scoped).

`createSoapRecord` (TEL-02): `soapSchema.safeParse` → insert `soap_records` with `teleconsultation_id` + `appointment_id` (both FKs) + 4 SOAP fields + `dentist_id = actor.id` (server-set).

`listTeleconsultations`: RLS-scoped, ordered by created_at desc, optional patient filter.

## Verification Results

| Check | Result |
|-------|--------|
| `clinical-documents.test.ts` (30 tests) | GREEN |
| `teleconsultations.test.ts` (27 tests) | GREEN |
| `receituario/` suite (5 files, 162 tests) | GREEN |
| `teleodontologia/` suite included | GREEN |
| `sign-document.test.ts` regression | GREEN (2/2) |
| `npx tsc --noEmit` | exits 0 |
| `sign-document.ts` byte-identical | CONFIRMED (unmodified) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] renderToBuffer type mismatch**
- **Found during:** Task 2 tsc check
- **Issue:** `createElement(ReceituarioPDF/AtestadoPDF/ExamePDF, props)` returned `FunctionComponentElement<XxxProps>` which TypeScript couldn't assign to `ReactElement<DocumentProps>` required by `renderToBuffer`
- **Fix:** Cast each element `as unknown as ReactElement<DocumentProps>` — runtime is correct (all components return `<Document>`); this is a structural TypeScript mismatch only. Same pattern used by the `documents.ts` Phase 8 action which doesn't trigger it because `DocumentoPDF` happens to share prop shape
- **Files modified:** `src/actions/clinical-documents.ts`
- **Commit:** 442fb33

**2. [Rule 1 - Bug] noUncheckedIndexedAccess on split result**
- **Found during:** Task 3 tsc check
- **Issue:** `fwd.split(',')[0].trim()` — array index access `[0]` returns `string | undefined` under `noUncheckedIndexedAccess`
- **Fix:** `(fwd.split(',')[0] ?? fwd).trim()` — falls back to the whole `fwd` string if somehow the split result is undefined (impossible in practice but satisfies tsc)
- **Files modified:** `src/actions/teleconsultations.ts`
- **Commit:** 442fb33

## Known Stubs

None — all action exports implement real logic. The `as never` casts on `.from('clinical_documents' as never)` etc. are **not stubs** — they are type-only workarounds for the missing `database.types.ts` entries (resolved at Plan 05 db push per `<note_on_tsc>`).

## Threat Flags

No new network endpoints or auth paths beyond what the plan's threat model covers. All five threat mitigations (T-12-16 through T-12-21) are implemented:
- T-12-16: allergy check server-side in action, no client override field
- T-12-17: `.is('signature', null)` atomic guard + rollback
- T-12-18: `consent_ip` from `x-forwarded-for`/`x-real-ip` headers, client cannot set
- T-12-19: `content_json` encrypted; allergy plaintext never returned; `storage_path` never selected in list
- T-12-20: `assertNotReadOnly()` + role gate on every mutation
- T-12-21: `listClinicDocuments` column list excludes `storage_path` and `cert_pem`

## Build Gate (`npx next build`)

Run on 2026-06-19 (Next.js 16.2.7, Turbopack):

| Stage | Result |
|-------|--------|
| Compile | ✓ Compiled successfully in 26.0s |
| TypeScript | ✓ Finished in 33.0s (0 errors) |
| Static pages | ✓ 48/48 generated |
| Page optimization | ✓ Finalized |

**Status: CLEAN.** The `<note_on_tsc>` anticipated possible new-table type errors at Wave 2 (clinical_documents / medications / teleconsultations / soap_records / next_doc_number rpc) pending the Plan 05 db push. The build is green at this point: the documented `as never` casts kept the Server Action calls staged and the regenerated `database.types` resolved the remaining table types, so `npx next build` already passes ahead of the Plan 05/06 gate. No build failures introduced by this plan.

## Self-Check: PASSED

**Created files (all FOUND):**
- `src/components/pdf/ReceituarioPDF.tsx`
- `src/components/pdf/AtestadoPDF.tsx`
- `src/components/pdf/ExamePDF.tsx`
- `src/actions/clinical-documents.ts`
- `src/actions/teleconsultations.ts`

**Commits (all FOUND in git history):**
- `59fbf5a` — feat(12-04): add ReceituarioPDF + AtestadoPDF + ExamePDF
- `9592922` — feat(12-04): add clinical-documents.ts Server Actions (issue + sign + list)
- `1907877` — feat(12-04): add teleconsultations.ts Server Actions (create + start/end + SOAP + list)
- `442fb33` — fix(12-04): resolve tsc errors in clinical-documents + teleconsultations

**Build gate:** `npx next build` CLEAN (compile + TypeScript + 48/48 static pages).
