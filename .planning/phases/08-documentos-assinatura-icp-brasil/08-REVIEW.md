---
phase: 08-documentos-assinatura-icp-brasil
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - supabase/migrations/20260615000100_document_tables.sql
  - supabase/migrations/20260615000200_document_rls.sql
  - supabase/migrations/20260615000300_documents_bucket.sql
  - src/lib/icp/sign-document.ts
  - src/lib/documents/template-engine.ts
  - src/lib/documents/document-types.ts
  - src/lib/validators/document-template.ts
  - src/actions/documents.ts
  - src/actions/document-templates.ts
  - src/proxy.ts
  - src/app/(dashboard)/config/documentos/page.tsx
  - src/app/(dashboard)/clinica/documentos/page.tsx
  - src/app/api/documentos/[versionId]/route.ts
  - src/components/pdf/DocumentoPDF.tsx
  - src/components/config/DocumentTemplateForm.tsx
  - src/components/config/DocumentTemplatesManager.tsx
  - src/components/documents/DocumentGenerator.tsx
  - src/components/documents/DocumentVersionsList.tsx
  - src/components/shell/nav-config.ts
  - src/components/shell/nav-icons.ts
  - src/types/database.types.ts
  - src/__tests__/documents/actions.test.ts
  - src/__tests__/documents/template-engine.test.ts
  - src/__tests__/icp/sign-document.test.ts
  - src/__tests__/migrations/phase8.test.ts
  - src/__tests__/pdf/documento.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 8: Code Review Report — Documentos & Assinatura ICP-Brasil

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 8 implements document generation with ICP-Brasil signing (RSA-2048 + node-forge), append-only version history, AES-encrypted content at rest, and RBAC-gated access. The core cryptographic work is solid: `signPdfBuffer`/`verifyPdfSignature` follow the correct pitfall mitigations (fresh MessageDigest, binary-string encoding, service-role-only .pfx fetch), nav-config correctly uses string icon keys (not component references), and `assertNotReadOnly()` gates all mutations.

Two critical issues and four warnings were found. The most important: (1) `signDocument` mutates the `document_versions` row via admin UPDATE, making immutability an application promise only — not enforced at the DB layer — with a non-atomic signed-check allowing a race condition where two concurrent callers could double-sign; (2) `handleRequestRevision` creates a brand-new `documents` row (version 1) instead of appending a new version under the existing document, silently breaking the DOC-03 append-only chain.

---

## Critical Issues

### CR-01: `signDocument` mutates `document_versions` via admin UPDATE — immutability not enforced at DB layer; non-atomic signed check enables double-sign race

**File:** `src/actions/documents.ts:246-364`

**Issue:** The migration (`20260615000200_document_rls.sql`) deliberately has no `FOR UPDATE` policy on `document_versions` to enforce INSERT-only immutability. However, `signDocument` uses `createAdminClient()` which bypasses RLS entirely and calls `.update({...}).eq('id', documentVersionId)` at line 351-364. The signed-status check at line 256 (`if (version.signature)`) is not atomic with that update — two concurrent `signDocument` calls for the same `documentVersionId` can both read `version.signature = null`, both proceed through all steps, both upload to the same storage path (second upload hits `upsert: false` and will fail, leaving the DB row partially signed from the first call), or both succeed if the storage object is somehow deleted between calls.

In addition, because the admin client bypasses RLS completely, any bug or privilege escalation in the application layer that reaches `signDocument` can overwrite signature fields on a previously signed version — the DB has no guard.

**Fix:**

Add a DB-level atomic guard using a `WHERE signature IS NULL` clause on the update, and check the rowcount to detect races:

```typescript
// Step 9 — atomic guard: only update if still unsigned (prevents double-sign race)
const { data: updateRows, error: updateVerError } = await admin
  .from('document_versions')
  .update({
    content_hash: sigResult.sha256Hex,
    signature: sigResult.signatureB64,
    storage_path: storagePath,
    cert_pem: sigResult.certPem,
    signer_cn: sigResult.certSubjectCn,
    cert_thumbprint: sigResult.certThumbprintSha1,
    cert_not_after: sigResult.certNotAfter,
    signed_at: sigResult.signedAt,
    signed_by: actor.id,
  })
  .eq('id', documentVersionId)
  .is('signature', null) // atomic guard: only update if still unsigned
  .select('id')

if (updateVerError || !updateRows || updateRows.length === 0) {
  // Roll back: delete the uploaded PDF (avoid orphaned storage object)
  await admin.storage.from('documents-pdf').remove([storagePath])
  return { success: false, error: updateVerError
    ? 'Erro ao registrar assinatura'
    : 'Esta versão já foi assinada por outra requisição simultânea' }
}
```

For deeper immutability, consider a DB trigger that raises an exception if `signature` is being set on a row that already has a non-null `signature`:

```sql
CREATE OR REPLACE FUNCTION prevent_signature_overwrite()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signature IS NOT NULL AND NEW.signature IS NOT NULL THEN
    RAISE EXCEPTION 'document_versions: signature is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_signature_overwrite
BEFORE UPDATE ON public.document_versions
FOR EACH ROW EXECUTE FUNCTION prevent_signature_overwrite();
```

---

### CR-02: `handleRequestRevision` creates a new independent `documents` row (version 1) instead of a new version under the existing document — breaks DOC-03 append-only chain

**File:** `src/components/documents/DocumentGenerator.tsx:195-221` and `src/actions/documents.ts:150-212`

**Issue:** When the user clicks "Nova Revisão" on a signed document, `handleRequestRevision` calls `generateDocument({ templateId: selectedTemplateId, context: {} })` without passing a `documentId`. `generateDocument` always inserts a new row in `documents` (line 152-163) with `current_version: 1` and a new `document_versions` row with `version_number: 1`. The returned `result.documentId` is a new UUID that replaces `documentId` state (line 213). The `supersedes_id` field in `document_versions` is never set anywhere in the codebase.

Result: "revisions" are actually independent new documents, not new versions of the existing one. The UI's `refreshVersions(result.documentId)` (line 215) then displays only the new document's version history — the signed original disappears from the list. The DOC-03 append-only chain (D-03) is never actually formed.

**Fix — Option A (minimal, recommended for MVP):** Add an optional `documentId` parameter to `generateDocument` and, when provided, append a new version under that document instead of creating a new one. The DB's `UNIQUE(document_id, version_number)` constraint enforces uniqueness.

```typescript
// In generateDocument signature:
export interface GenerateDocumentInput {
  templateId: string
  context: DocumentContext
  patientId?: string
  unitId?: string
  existingDocumentId?: string // If set: append new version under this document
}

// In generateDocument body, after fetching the template:
let docId: string
let nextVersionNumber: number

if (input.existingDocumentId) {
  // Verify document belongs to actor's clinic and is in 'signed' status
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, clinic_id, status, current_version')
    .eq('id', input.existingDocumentId)
    .single()

  if (!existingDoc || existingDoc.clinic_id !== actor.tenant_id) {
    return { success: false, error: 'Documento não encontrado' }
  }

  docId = existingDoc.id
  nextVersionNumber = existingDoc.current_version + 1

  // Update current_version on the document header
  await supabase.from('documents').update({
    current_version: nextVersionNumber,
    status: 'draft', // reopen to draft for the new revision
    updated_at: new Date().toISOString(),
  }).eq('id', docId)
} else {
  // Create new document (existing logic)
  const { data: doc } = ...
  docId = doc.id
  nextVersionNumber = 1
}

// Then insert version_number: nextVersionNumber, supersedes_id: previous version id
```

**Fix — Option B (client side, minimal):** Pass `existingDocumentId` from `handleRequestRevision`:
```typescript
// DocumentGenerator.tsx handleRequestRevision
const result = await generateDocument({
  templateId: selectedTemplateId,
  context: {},
  existingDocumentId: documentId ?? undefined, // pass existing doc to create new version under it
})
// Do NOT replace documentId — keep displaying the same document's version history
// setDocumentId(result.documentId) <- remove this line
await refreshVersions(documentId) // keep refreshing the SAME document
```

---

## Warnings

### WR-01: `ti` role allowed in `generateDocument`/`signDocument` action gates but not in `documentos` MODULE_PERMISSIONS — middleware and action gates are inconsistent

**File:** `src/actions/documents.ts:109,239` and `src/proxy.ts:30`

**Issue:** `ti` is in the role allow-list for `generateDocument` (line 109: `'admin', 'superadmin', 'dentist', 'receptionist', 'ti'`) and `signDocument` (line 239: `'admin', 'superadmin', 'dentist', 'ti'`), but `ti` has no `documentos` module in `MODULE_PERMISSIONS` (line 30: `ti: { config: {allowed:true}, ia: {allowed:true} }`). The middleware blocks `ti` from reaching `/clinica/documentos`, but a `ti` actor calling the Server Actions directly (e.g., from a script, test, or future API endpoint) bypasses the middleware gate and can generate and sign documents.

**Fix:** Either add `documentos: {allowed:true}` to the `ti` entry in MODULE_PERMISSIONS (if `ti` is intended to access documents), or remove `'ti'` from both action role gates. Given `ti` manages config/infrastructure and not clinical documents, removal is likely correct:

```typescript
// src/actions/documents.ts line 109 — remove 'ti'
if (!['admin', 'superadmin', 'dentist', 'receptionist'].includes(actor.role)) {
  return { success: false, error: 'Permissão insuficiente para gerar documentos' }
}

// src/actions/documents.ts line 239 — remove 'ti'
if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
  return { success: false, error: 'Permissão insuficiente para assinar documentos' }
}
```

---

### WR-02: `receptionist` included in `generateDocument` action gate but has no `documentos` module in MODULE_PERMISSIONS — same middleware/action mismatch

**File:** `src/actions/documents.ts:109` and `src/proxy.ts:25`

**Issue:** `receptionist: { clinica: {allowed:true} }` — no `documentos` module. The middleware blocks receptionist from `/clinica/documentos`. Yet line 109 includes `'receptionist'` in the generate-document role gate. A receptionist calling `generateDocument` directly would succeed.

**Fix:** Decide the intended policy. If receptionists should be able to generate (but not sign) documents, add `documentos: {allowed:true}` to the `receptionist` entry:
```typescript
// src/proxy.ts line 25
receptionist: { clinica: {allowed:true}, documentos: {allowed:true} },
```
If receptionists should NOT access documents, remove `'receptionist'` from line 109 of `documents.ts`.

---

### WR-03: Download route 302 redirect missing `Cache-Control: no-store` — LGPD PII concern

**File:** `src/app/api/documentos/[versionId]/route.ts:120`

**Issue:** The primary code path creates a short-TTL (60 s) Supabase signed URL and responds with `Response.redirect(signedData.signedUrl, 302)`. This bare redirect has no `Cache-Control` header. Some browsers (and Vercel's edge cache) may cache 302 redirects, serving the now-expired signed URL on subsequent requests — or, worse, caching the redirect URL itself if the browser honors it for future requests. The fallback download path (line 107-115) correctly sets `Cache-Control: no-store`.

The signed URL itself expires in 60 s, so this is not a long-lived disclosure, but it violates the LGPD `no-store` intent stated in the security comment.

**Fix:**
```typescript
// Replace line 120:
return new Response(null, {
  status: 302,
  headers: {
    'Location': signedData.signedUrl,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  },
})
```

---

### WR-04: `signDocument` uses a non-deterministic `generatedAt` timestamp in the PDF render — signed PDF bytes cannot be reproduced on retry

**File:** `src/actions/documents.ts:320,327`

**Issue:** `nowIso = new Date().toISOString()` is captured at the start of the signing flow and embedded as `generatedAt` in the PDF via `createElement(DocumentoPDF, { ..., generatedAt: nowIso })`. If the upload at line 340 fails and the action returns an error, a user retrying the `signDocument` call will trigger a new render with a fresh `nowIso` — producing different PDF bytes, a different SHA-256 hash, and a different RSA signature. Since `upsert: false` is set, the second upload attempt will also fail (the object exists from the partial first call if the upload actually succeeded but the DB update failed). In this scenario, the stored signature and hash cannot be reconciled with a re-rendered PDF.

**Fix:** Capture `generatedAt` before signing, and persist it alongside the draft version so re-renders use the same timestamp. Alternatively, store it in the `document_versions` row (add a `generated_at` column) and use it for both the draft render and the signing render:

```typescript
// In signDocument, use the version's creation timestamp as generatedAt
// so the same timestamp is always used regardless of when signing occurs.
const generatedAt = version.created_at // from the fetched version row (add created_at to select)
const pdfElement = createElement(DocumentoPDF, {
  clinicName,
  title: templateName,
  content: rawContent,
  documentNumber: versionLabel,
  generatedAt,  // deterministic — same value on every render of this version
})
```

This requires adding `created_at` to the `select` in step 1 of `signDocument`. No schema change needed.

---

## Info

### IN-01: `verifyPdfSignature` silently returns `false` for all forge exceptions — verification errors indistinguishable from invalid signatures

**File:** `src/lib/icp/sign-document.ts:127-136`

**Issue:** The entire verify block is wrapped in `try { ... } catch { return false }`. A malformed `certPem` string, a forge internal error, or a network issue loading cert data will silently return `false` — the same value as a genuine signature mismatch. Callers in `verifyDocumentSignature` (documents.ts:456) treat `false` as "signature invalid", which may mislead users into thinking a valid document's signature is broken when in fact forge threw an unexpected exception.

**Fix:** Log the exception and/or propagate a distinct error signal:
```typescript
export function verifyPdfSignature(
  pdfBuffer: Buffer,
  signatureB64: string,
  certPem: string
): { valid: boolean; error?: string } {
  try {
    const sig = forge.util.decode64(signatureB64)
    const cert = forge.pki.certificateFromPem(certPem)
    const md2 = forge.md.sha256.create()
    md2.update(pdfBuffer.toString('binary'), 'raw')
    const valid = (cert.publicKey as forge.pki.rsa.PublicKey).verify(md2.digest().bytes(), sig)
    return { valid }
  } catch (err) {
    console.error('[verifyPdfSignature] forge error:', err)
    return { valid: false, error: 'Erro interno na verificação criptográfica' }
  }
}
```
Update callers to handle the new return type.

---

### IN-02: Template content is included verbatim in `TemplateListItem` returned to client — 20 KB templates transferred on every `listTemplates` call

**File:** `src/actions/document-templates.ts:297-299` and `src/actions/documents.ts:119`

**Issue:** `listTemplates` selects `content` as part of the `TemplateListItem`. Template content can be up to 20,000 characters (per the Zod validator). For a clinic with many templates, the `DocumentosPage` SSR load and every client refresh transfers the full content of all templates to the browser. Only the template name, category, and variable list are displayed in the table — `content` is only needed when editing.

This is a data minimization concern aligned with LGPD best practices (minimize data transferred) and a bandwidth issue.

**Fix:** Create a separate `TemplateListSummary` type without `content`, used for the list view. Load full content only in the edit dialog via a separate `getTemplate(id)` call:
```typescript
// listTemplates returns summary (no content)
export interface TemplateListSummary {
  id: string; name: string; category: string
  variables: string[]; is_active: boolean
  created_at: string; updated_at: string
}

// New getTemplate(id) returns full content for the edit form
export async function getTemplate(id: string): Promise<{ success: boolean; data?: TemplateListItem; error?: string }>
```

---

## What Looks Good

- **ICP secret secrecy (T-08-03):** `sign-document.ts` has `import 'server-only'`, decrypts the password in-process only, never logs or returns the private key, and fetches the `.pfx` via service role from a private bucket. The `certPem` is stored only in `document_versions` (REVOKE-protected column) and never returned in `listDocumentVersions`.
- **Pitfall 1 (sign the final bytes):** Within a single `signDocument` call, `pdfBuffer` is rendered once and passed directly to both `signPdfBuffer` and `admin.storage.upload` without re-rendering.
- **Pitfall 2 (fresh MessageDigest):** `verifyPdfSignature` correctly creates a new `forge.md.sha256.create()` object instead of reusing the one from signing.
- **Column-level REVOKE:** `REVOKE SELECT (storage_path, cert_pem) ON public.document_versions FROM authenticated, anon` is in place and the admin client is correctly used wherever those columns must be read.
- **INSERT-only RLS on `document_versions`:** No `FOR UPDATE` or `FOR DELETE` policy exists; regular authenticated users cannot mutate version rows.
- **Cross-tenant guards:** Both `signDocument` and `verifyDocumentSignature` verify `doc.clinic_id !== actor.tenant_id`; the download route also checks this and returns 404 (not 403) to avoid information disclosure.
- **RSC serialization:** `nav-config.ts` uses string `NavIconKey` values; `NAV_ICONS` map is in `nav-icons.ts` (client-only) — no function/component crosses the server→client boundary.
- **`assertNotReadOnly()`:** Called at the top of all mutating actions (`generateDocument`, `signDocument`, `createTemplate`, `updateTemplate`, `deleteTemplate`). Read-only actions (`verifyDocumentSignature`, `listDocumentVersions`, `listTemplates`) correctly omit it.
- **Bucket configuration:** `documents-pdf` bucket is private with no public storage policies — service role is the sole accessor.
- **Download route runtime:** `export const runtime = 'nodejs'` is set — `@react-pdf/renderer` and `Buffer` are available.

---

## Finding Counts

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | CR-01, CR-02 |
| Warning  | 4 | WR-01, WR-02, WR-03, WR-04 |
| Info     | 2 | IN-01, IN-02 |
| **Total**| **8** | |

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
