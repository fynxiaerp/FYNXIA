---
phase: 08-documentos-assinatura-icp-brasil
plan: 02
subsystem: documents
tags: [migrations, rls, icp-brasil, node-forge, react-pdf, template-engine, signing, server-actions]

requires:
  - phase: 07-sistema-multiunidade-pap-is
    provides: certificates table + icp-certificates bucket + node-forge 1.4.0 + crypto.ts + createAdminClient

provides:
  - 3 SQL migrations (document_templates, documents, document_versions + RLS + documents-pdf bucket)
  - document-types.ts (DocumentContext, SignatureResult, DocumentCategory, DocumentStatus)
  - template-engine.ts (fillTemplate + detectVariables — pure functions, zero deps)
  - sign-document.ts (signPdfBuffer + verifyPdfSignature — server-only, node-forge RSA)
  - DocumentoPDF.tsx (generic @react-pdf A4 Flexbox, Font.register, signatureBlock prop)
  - document-templates.ts Server Action (createTemplate/updateTemplate/deleteTemplate/listTemplates)
  - documents.ts Server Action (generateDocument/signDocument/verifyDocumentSignature/listDocumentVersions)

affects:
  - 08-03: db push will apply these migrations to remote
  - 12-receituario: will consume signPdfBuffer + DocumentoPDF
  - 15-nfse: will consume document engine
  - 20-teleodonto: will consume document engine

tech-stack:
  added: []
  patterns:
    - "signPdfBuffer: server-only RSA direct signing — decrypt pw in RAM, load pfx via admin client, forge.privateKey.sign(md), never expose key"
    - "verifyPdfSignature: fresh md2 = forge.md.sha256.create() — Pitfall 2 (md consumed after sign)"
    - "DocumentoPDF: @react-pdf Flexbox-only, Font.register Roboto, signatureBlock prop conditional, no use client"
    - "document_versions INSERT-only RLS: no UPDATE/DELETE policy — D-03 immutability, mirrors dental_records"
    - "document-types.ts: non-use-server constants/types file — Pitfall 5 pattern from Phase 7"
    - "detectVariables: [...new Set(matchAll.map(m => m[1]).filter(v => v !== undefined))] — tsc strict"

key-files:
  created:
    - supabase/migrations/20260615000100_document_tables.sql
    - supabase/migrations/20260615000200_document_rls.sql
    - supabase/migrations/20260615000300_documents_bucket.sql
    - src/lib/documents/document-types.ts
    - src/lib/documents/template-engine.ts
    - src/lib/icp/sign-document.ts
    - src/components/pdf/DocumentoPDF.tsx
    - src/actions/document-templates.ts
    - src/actions/documents.ts
  modified:
    - src/__tests__/documents/template-engine.test.ts (removed @ts-expect-error — module now exists)
    - src/__tests__/icp/sign-document.test.ts (explicit rsa.PublicKey cast for tsc)

key-decisions:
  - "signPdfBuffer returns certPem in SignatureResult so documents.ts can store it in document_versions without a second DB read"
  - "documents.ts uses createAdminClient() for signing path (cert secrets bypass RLS) but createClient() for read operations (RLS enforced)"
  - "detectVariables uses .filter(v => v !== undefined) to satisfy tsc strict — matchAll captures are typed string|undefined even for required groups"
  - "DocumentoPDF comment text rewritten to avoid false-positive matches on test regexes for 'display: grid' and 'use client'"

metrics:
  duration: 7min
  completed: 2026-06-14T14:44:21Z
  tasks: 3
  files_created: 9
  files_modified: 2
---

# Phase 08 Plan 02: Migrations + Template Engine + ICP Signing + DocumentoPDF Summary

**Three migrations + five source modules turn 55 Plan 01 scaffolds GREEN: RSA sign→verify, template variable fill, DocumentoPDF Flexbox render, and Server Actions for CRUD + sign flow**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-14T14:37:47Z
- **Completed:** 2026-06-14T14:44:21Z
- **Tasks:** 3
- **Files created:** 9

## Accomplishments

- **Task 1** — Three SQL migrations committed (not yet pushed — Plan 03 [BLOCKING]):
  - `document_templates`: clinic-scoped config table with `{{var}}` content, `variables[]` cache, soft delete
  - `documents`: header table; `status CHECK (draft, signed)`, `unit_id` nullable (Phase 7 multi-unit)
  - `document_versions`: append-only with `UNIQUE(document_id, version_number)`, `is_content_encrypted BOOLEAN DEFAULT true` (LGPD), INSERT-only RLS (no UPDATE/DELETE policy), `REVOKE SELECT (storage_path, cert_pem)` (T-08-06)
  - `documents-pdf` private Storage bucket (mirrors `icp-certificates`)
  - 19/19 migration source-inspection tests GREEN

- **Task 2** — Template engine (TDD):
  - `document-types.ts`: `DocumentContext`, `DocumentCategory`, `DocumentStatus`, `SignatureResult` — no `'use server'` (Pitfall 5)
  - `template-engine.ts`: `fillTemplate` (global replace, missing keys verbatim) + `detectVariables` (deduped, first-appearance order)
  - 9/9 behavior tests GREEN

- **Task 3** — ICP signing library + DocumentoPDF + Server Actions:
  - `sign-document.ts`: `import 'server-only'`; exact algorithm from Plan 01 test — decrypt pw, download pfx via admin client, forge RSA sign, `certificateToAsn1` thumbprint; `verifyPdfSignature` uses fresh `md2`
  - `DocumentoPDF.tsx`: generic @react-pdf A4 component; `Font.register` Roboto; Flexbox only; signature block (signed) vs RASCUNHO label (draft); no `use client`
  - `document-templates.ts`: `createTemplate`, `updateTemplate`, `deleteTemplate`, `listTemplates` — `assertNotReadOnly` on mutations
  - `documents.ts`: `generateDocument`, `signDocument`, `verifyDocumentSignature`, `listDocumentVersions` — atomic sign flow (Pitfall 1); `createAdminClient` for cert/storage; `renderToBuffer` + `signPdfBuffer` wired
  - 7/7 DocumentoPDF tests GREEN; 15/15 actions tests GREEN; 2/2 sign-document tests still GREEN

## Task Commits

1. **Task 1: Three migrations** — `1cbabd9`
2. **Task 2: Template engine + types** — `2708e47`
3. **Task 3: Signing lib + PDF + Actions** — `ad421f9`
4. **Fix: tsc compliance (detectVariables + PublicKey cast)** — `871d62c`

## Overall Verification

- `npx vitest run src/__tests__/documents/ src/__tests__/icp/ src/__tests__/migrations/phase8.test.ts src/__tests__/pdf/documento.test.ts` → **70/70 GREEN** (6 files)
- `npx tsc --noEmit` → **exit 0**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `@ts-expect-error` now unused in template-engine.test.ts**
- **Found during:** Task 3 verification (`npx tsc --noEmit`)
- **Issue:** Plan 01 added `// @ts-expect-error not-yet-implemented` before the import; once `template-engine.ts` exists the directive becomes unused and tsc emits TS2578
- **Fix:** Removed the `@ts-expect-error` comment line from `src/__tests__/documents/template-engine.test.ts`
- **Files modified:** `src/__tests__/documents/template-engine.test.ts`
- **Commit:** `871d62c`

**2. [Rule 1 - Bug] `detectVariables` returned `string | undefined` instead of `string[]`**
- **Found during:** Task 3 verification (`npx tsc --noEmit`)
- **Issue:** `String.prototype.matchAll` capture groups are typed `string | undefined`; tsc strict rejected the unguarded `.map(m => m[1])` return type
- **Fix:** Added `.filter((v): v is string => v !== undefined)` type guard after `.map`
- **Files modified:** `src/lib/documents/template-engine.ts`
- **Commit:** `871d62c`

**3. [Rule 1 - Bug] Comment text in DocumentoPDF.tsx matched test source-inspection regex**
- **Found during:** Task 3 verification (`npx vitest run`)
- **Issue:** Comment `// ─── Styles (Flexbox only — no display: 'grid')` matched the regex `/display:\s*['"]grid['"]/i` in `documento.test.ts`; comment noting "NO 'use client'" matched `/['"]use client['"]/i`
- **Fix:** Rewrote both comment lines to avoid quoted occurrences of the forbidden patterns
- **Files modified:** `src/components/pdf/DocumentoPDF.tsx`
- **Commit:** `ad421f9`

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug; tsc/test compliance)
**Impact on plan:** All fixes are correctness-only. No behavior or scope change.

## Known Stubs

None — all core functions are wired. `generateDocument` and `signDocument` in `documents.ts` contain real logic (renderToBuffer, signPdfBuffer, Supabase inserts). The Server Actions depend on tables that will be pushed in Plan 03 ([BLOCKING]), but the code is not stubbed — it will function once the DB migration is applied.

## Threat Flags

None — no new network endpoints, auth paths, or infrastructure beyond what the plan's threat model covers. All T-08-03 through T-08-08 mitigations are implemented as specified:
- `import 'server-only'` on sign-document.ts (T-08-03)
- Sign the FINAL renderToBuffer bytes only; sha256Hex stored (T-08-04)
- INSERT-only RLS on document_versions; no UPDATE/DELETE policy (T-08-05)
- `REVOKE SELECT (storage_path, cert_pem)` on authenticated, anon (T-08-06)
- RLS `clinic_id = get_my_tenant_id()` on all three tables + indexes (T-08-07)

---
*Phase: 08-documentos-assinatura-icp-brasil*
*Completed: 2026-06-14*
