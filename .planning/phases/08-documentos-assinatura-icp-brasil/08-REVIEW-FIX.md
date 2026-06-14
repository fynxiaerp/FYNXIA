---
phase: 08-documentos-assinatura-icp-brasil
fixed_at: 2026-06-14T13:17:00-03:00
review_path: .planning/phases/08-documentos-assinatura-icp-brasil/08-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-06-14T13:17:00-03:00
**Source review:** .planning/phases/08-documentos-assinatura-icp-brasil/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, IN-01, IN-02-adjacent)
- Fixed: 8
- Skipped: 0

---

## Fixed Issues

### CR-01: Atomic sign guard — double-sign race eliminated

**Files modified:** `src/actions/documents.ts`
**Commit:** `202733e`
**Applied fix:** Replaced the plain `.update(...).eq('id', documentVersionId)` in `signDocument` with `.update(...).eq('id', documentVersionId).is('signature', null).select('id')`. After the update, we check `!updateRows || updateRows.length === 0` — if true (another concurrent call already wrote the signature), we delete the just-uploaded PDF from storage to avoid an orphan and return `"Esta versão já foi assinada por outra requisição simultânea"`. This makes the signed-check atomic at the DB level: `WHERE id = ? AND signature IS NULL`.

---

### CR-02: Revision appends new version under same document (DOC-03 chain preserved)

**Files modified:** `src/actions/documents.ts`, `src/components/documents/DocumentGenerator.tsx`
**Commit:** `202733e` (server action), `5c9c95d` (component)
**Applied fix:**
- Added optional `existingDocumentId?: string` to `GenerateDocumentInput` interface.
- In `generateDocument`: when `existingDocumentId` is provided, fetch the existing document (with tenant guard `clinic_id !== actor.tenant_id`), compute `nextVersionNumber = current_version + 1`, update the documents header (`current_version`, `status: 'draft'`), and insert the new version under the same `docId`. When not provided, the existing create-new-document path runs unchanged.
- In `DocumentGenerator.tsx` `handleRequestRevision`: pass `existingDocumentId: documentId` to `generateDocument`, do NOT call `setDocumentId()` (keep the same document chain), and refresh versions for the existing `documentId` — not the returned one.

---

### WR-01: Remove `'ti'` from `signDocument` role gate (middleware/action consistency)

**Files modified:** `src/actions/documents.ts`
**Commit:** `202733e`
**Applied fix:** Changed `['admin', 'superadmin', 'dentist', 'ti']` to `['admin', 'superadmin', 'dentist']` in the `signDocument` role gate. `ti` has no `documentos` entry in `MODULE_PERMISSIONS` — the middleware already blocks `ti` from `/clinica/documentos`; the action gate now matches.

---

### WR-02: Remove `'receptionist'` and `'ti'` from `generateDocument` role gate

**Files modified:** `src/actions/documents.ts`
**Commit:** `202733e`
**Applied fix:** Changed `['admin', 'superadmin', 'dentist', 'receptionist', 'ti']` to `['admin', 'superadmin', 'dentist']` in the `generateDocument` role gate. Neither `receptionist` nor `ti` has `documentos` in `MODULE_PERMISSIONS`. Single source of truth: action gates now mirror the middleware matrix exactly.

---

### WR-03: `Cache-Control: no-store` on download redirect (LGPD)

**Files modified:** `src/app/api/documentos/[versionId]/route.ts`
**Commit:** `62a25a3`
**Applied fix:** Replaced `Response.redirect(signedData.signedUrl, 302)` with an explicit `new Response(null, { status: 302, headers: { Location, Cache-Control: 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' } })`. Intermediaries (Vercel edge, browser cache) will no longer cache the redirect response containing the short-TTL signed URL.

---

### WR-04: Reproducible signed PDF bytes — use `version.created_at` as `generatedAt`

**Files modified:** `src/actions/documents.ts`
**Commit:** `202733e`
**Applied fix:** Added `created_at` to the version select in step 1 of `signDocument`. Replaced `const nowIso = new Date().toISOString()` (non-deterministic, called at sign time) with `const generatedAt = version.created_at` (deterministic — same value on every render of the same version). The `DocumentoPDF` element now receives `generatedAt` from the stored timestamp. A retry after an upload failure produces identical PDF bytes → same SHA-256 → same RSA signature. A separate `const nowIso = new Date().toISOString()` is kept only for the `documents.updated_at` stamp in step 10.

---

### IN-01: `verifyPdfSignature` returns discriminated result, not boolean

**Files modified:** `src/lib/icp/sign-document.ts`, `src/actions/documents.ts`
**Commit:** `fc9986a` (sign-document.ts), `202733e` (caller in documents.ts)
**Applied fix:**
- Changed `verifyPdfSignature` return type from `boolean` to `{ valid: boolean; error?: string }`. The `catch` block now logs the forge exception with `console.error` and returns `{ valid: false, error: 'Erro interno na verificação criptográfica' }` instead of silently returning `false`.
- Updated the caller in `verifyDocumentSignature` (documents.ts): checks `verifyResult.error` first and returns `{ success: false, error: verifyResult.error }` so the UI shows an operational error rather than a misleading "invalid signature" badge.

---

### IN-02-adjacent: `content` field missing from `TemplateListItem` / `listTemplates` select

**Files modified:** `src/actions/document-templates.ts`
**Commit:** `935461f`
**Applied fix:** This was a pre-existing type error (not in the REVIEW.md findings list) exposed when reverting an unrelated uncommitted change. Added `content: string` to `TemplateListItem` interface and added `content` to the `.select(...)` string in `listTemplates`. `DocumentTemplateForm.tsx` uses `editing?.content` which requires this field. `tsc --noEmit` was failing with TS2339/TS2353 until this was applied.

---

## Verification

- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run`: 712 tests passed, 48 test files (all green)
- `npx next build`: not run (no Next.js dev server available in this environment; tsc + vitest confirm structural correctness)

---

_Fixed: 2026-06-14T13:17:00-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
