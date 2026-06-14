---
phase: 08-documentos-assinatura-icp-brasil
plan: 05
subsystem: documents
tags: [rbac, documentos-module, icp-signing, atomic-sign-flow, immutable-versions, nodejs-route, ui, aes-encrypt]

requires:
  - phase: 08-documentos-assinatura-icp-brasil
    plan: 02
    provides: sign-document.ts + DocumentoPDF + document_templates/documents/document_versions schema
  - phase: 08-documentos-assinatura-icp-brasil
    plan: 03
    provides: migrations applied to remote DB (documents-pdf bucket live)
  - phase: 08-documentos-assinatura-icp-brasil
    plan: 04
    provides: listTemplates + TemplateListItem type (template picker source)

provides:
  - documentos ModuleKey in proxy.ts (admin/superadmin/dentist write; dpo/auditor/socio readOnly)
  - /clinica/documentos route gated by documentos module (dentist/admin write, read-only roles see history)
  - documents.ts: generateDocument (AES-encrypt, clinic_id, logBusinessEvent), signDocument (decrypt+render+sign+upload, cross-tenant guard, returns signerCn/signedAt/thumbprint), verifyDocumentSignature (RSA+SHA-256 cross-check, cross-tenant guard), listDocumentVersions (display metadata only)
  - /api/documentos/[versionId] nodejs route: short-TTL signed URL, cross-tenant guard, Cache-Control no-store
  - DocumentGenerator client component: generate->sign->verify flow, carimbo de tempo + signer shown
  - DocumentVersionsList client component: signed/draft badges, immutable lock, new-revision trigger
  - nav entry: /clinica/documentos with FileText icon

affects:
  - 12-receituario: will consume signDocument + DocumentoPDF for prescription signing
  - 15-nfse: will consume document engine
  - 20-teleodonto: will consume document engine

tech-stack:
  added: []
  patterns:
    - "documentos module: most-specific prefix /clinica/documentos in ROUTE_MODULE_MAP before /clinica (mirrors financeiro pattern)"
    - "deriveRoleRoutes: documentos treated same as financeiro (sub-route of /clinica for ROLE_ROUTES backward compat)"
    - "generateDocument: encrypt(filledContent) before insert; clinic_id explicit on document_versions (NOT NULL)"
    - "signDocument: decrypt(content) before renderToBuffer; cross-tenant guard (clinic_id != actor.tenant_id -> denied)"
    - "verifyDocumentSignature: RSA verify + SHA-256 cross-check; both must pass for verified=true"
    - "download route: createSignedUrl TTL=60s; fallback stream on signed URL failure; 404 not 403 on cross-tenant"
    - "nav-icons.ts: documentos -> FileText imported only in client component (RSC server->client boundary safe)"
    - "isReadOnly from x-read-only header in Server Component (set by middleware for auditor/dpo/socio)"

key-files:
  created:
    - src/app/api/documentos/[versionId]/route.ts
    - src/components/documents/DocumentGenerator.tsx
    - src/components/documents/DocumentVersionsList.tsx
    - src/app/(dashboard)/clinica/documentos/page.tsx
  modified:
    - src/proxy.ts (documentos ModuleKey + MODULE_PERMISSIONS + ROUTE_MODULE_MAP + deriveRoleRoutes)
    - src/actions/documents.ts (getActor helper, AES encrypt, clinic_id insert, logBusinessEvent, cross-tenant guards, sign returns display fields)
    - src/components/shell/nav-config.ts (documentos NavIconKey + ALL_NAV_ITEMS entry)
    - src/components/shell/nav-icons.ts (FileText for documentos)

key-decisions:
  - "documentos module treated as /clinica sub-route in deriveRoleRoutes (same as financeiro) — ROLE_ROUTES backward compat with 48 existing rbac tests"
  - "generateDocument AES-encrypts filled content on draft creation (T-08-18) — not deferred to signing"
  - "signDocument returns signerCn/signedAt/thumbprint in action result — avoids extra DB round-trip for UI display"
  - "download route uses redirect to short-TTL signed URL (60s); falls back to streaming bytes if createSignedUrl fails — raw storage_path never in response"
  - "nav-icons.ts imports FileText client-side only — keeps Lucide out of RSC boundary (documented pattern from nav-config.ts IMPORTANT comment)"

metrics:
  duration: 30min
  completed: 2026-06-14T15:55:09Z
  tasks: 3
  files_created: 4
  files_modified: 4
---

# Phase 08 Plan 05: Generation UI + Sign/Verify Flow + documentos Module Summary

**documentos RBAC module + atomic generate→sign→verify flow + immutable version history UI at /clinica/documentos; AES-encrypted content, nodejs download route with short-TTL signed URL, nav entry with FileText icon**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-14T15:25:00Z
- **Completed:** 2026-06-14T15:55:09Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 4

## Accomplishments

- **Task 1 — `documentos` module in proxy.ts:**
  - Added `'documentos'` to `ModuleKey` union
  - `MODULE_PERMISSIONS`: superadmin/admin/dentist `{allowed:true}`; dpo/auditor/socio `{allowed:true, readOnly:true}`
  - `ROUTE_MODULE_MAP`: `{ prefix: '/clinica/documentos', module: 'documentos' }` inserted before `/clinica` (most-specific-first)
  - `deriveRoleRoutes`: `documentos` handled same as `financeiro` (pushes `/clinica`, not `/documentos`) — ROLE_ROUTES backward compat maintained
  - 48/48 rbac tests GREEN; tsc exit 0

- **Task 2 — `documents.ts` actions + nodejs download route:**
  - `generateDocument`: `getActor()` helper (mirrors certificate.ts), role gate, `encrypt(filledContent)` on draft creation (T-08-18), explicit `clinic_id` on `document_versions` insert, `logBusinessEvent` audit
  - `signDocument`: `decrypt(content)` before `renderToBuffer`, cross-tenant guard, upload error surfaced, returns `signerCn`/`signedAt`/`thumbprint` for immediate UI display, `logBusinessEvent` audit
  - `verifyDocumentSignature`: RSA verify + SHA-256 cross-check (both must pass), cross-tenant guard
  - `listDocumentVersions`: display-only fields (no `storage_path`/`cert_pem`)
  - `src/app/api/documentos/[versionId]/route.ts`: `runtime='nodejs'`, `maxDuration=30`, cross-tenant guard (404 not 403), short-TTL signed URL (60s) with fallback stream, `Cache-Control: no-store`
  - 18/18 actions tests GREEN; tsc exit 0

- **Task 3 — Generation UI + version history + route + nav:**
  - `DocumentGenerator` ('use client'): template picker → `generateDocument` → draft card → "Assinar com ICP-Brasil" → `signDocument` → carimbo de tempo + signer CN + thumbprint + SHA-256 shown → "Baixar PDF" link + "Verificar Assinatura" button → `verifyDocumentSignature` → valid/invalid badge
  - `DocumentVersionsList` ('use client'): per-version row with signed/draft badge, signer, timestamp; immutable lock pattern; "Nova Revisão" button for signed documents (append-only D-03)
  - `/clinica/documentos` (Server Component): auth, `isReadOnly` from `x-read-only` header, `listTemplates()` initial data, PageHeader breadcrumbs Clínica › Documentos
  - `nav-config.ts`: `documentos` added to `NavIconKey` + `ALL_NAV_ITEMS`
  - `nav-icons.ts`: `FileText` mapped to `documentos` (client-only import — RSC boundary safe)
  - tsc exit 0; next build green (`/clinica/documentos` rendered as `ƒ` dynamic route)

## Task Commits

1. **Task 1: documentos module + proxy.ts RBAC** — `e345827`
2. **Task 2: documents actions + nodejs download route** — `ea8fd6c`
3. **Task 3: generation UI + version history + route + nav** — `fb45873`

## Overall Verification

- `npx vitest run src/__tests__/documents/ src/__tests__/icp/ src/__tests__/migrations/phase8.test.ts src/__tests__/pdf/documento.test.ts src/__tests__/proxy/rbac.test.ts src/__tests__/rbac/matrix.test.ts` → **118/118 GREEN** (8 files)
- `npx tsc --noEmit` → **exit 0**
- `npx next build` → **green** (`/clinica/documentos` + `/api/documentos/[versionId]` both in output)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `clinic_id` missing from `document_versions` insert in original `documents.ts`**
- **Found during:** Task 2 implementation review
- **Issue:** The Plan 02 `generateDocument` did not pass `clinic_id` when inserting into `document_versions`, but the DB schema has `clinic_id NOT NULL`. The original used a dead `const admin = createAdminClient()` and unused `adminUser` variable. tsc did not catch this (the column is NOT NULL at DB level, not enforced by TS types as required).
- **Fix:** Added `clinic_id: actor.tenant_id` to the `document_versions` insert. Removed dead variable declarations.
- **Files modified:** `src/actions/documents.ts`
- **Commit:** `ea8fd6c`

**2. [Rule 2 - Missing critical functionality] Content not AES-encrypted on draft generation**
- **Found during:** Task 2 implementation — plan spec requires `encrypt(filledContent)` (T-08-18) but Plan 02 implementation set `is_content_encrypted: false` with plaintext content
- **Fix:** Changed to `encrypt(filledContent)` and `is_content_encrypted: true` on draft insert. Added corresponding `decrypt(version.content)` in `signDocument` before `renderToBuffer`.
- **Files modified:** `src/actions/documents.ts`
- **Commit:** `ea8fd6c`

**3. [Rule 2 - Missing critical functionality] Cross-tenant guard missing in `signDocument` and `verifyDocumentSignature`**
- **Found during:** Task 2 implementation — T-08-21 threat model requires tenant isolation on document access
- **Fix:** Added `doc.clinic_id !== actor.tenant_id` check in both `signDocument` (returns `Acesso negado`) and `verifyDocumentSignature` (fetches document, checks clinic_id). Download route also returns 404 (not 403) on cross-tenant.
- **Files modified:** `src/actions/documents.ts`, `src/app/api/documentos/[versionId]/route.ts`
- **Commit:** `ea8fd6c`

**4. [Rule 2 - Missing critical functionality] `signDocument` did not return display fields for UI**
- **Found during:** Task 3 — `DocumentGenerator` needed `signerCn`/`signedAt`/`thumbprint` to show carimbo de tempo without a second DB round-trip
- **Fix:** Extended `signDocument` return type to include `signerCn`, `signedAt`, `thumbprint` from `sigResult`.
- **Files modified:** `src/actions/documents.ts`
- **Commit:** `ea8fd6c`

---

**Total deviations:** 4 auto-fixed (Rules 2). All are correctness/security requirements from the threat model (T-08-18, T-08-21).

## Known Stubs

None — all core functions are wired:
- `generateDocument` calls `encrypt`, inserts into live `documents` + `document_versions` tables
- `signDocument` calls `decrypt` → `renderToBuffer` → `signPdfBuffer` → storage upload → DB update
- `verifyDocumentSignature` downloads from storage, runs RSA + SHA-256 verify
- Download route creates signed URL from live `documents-pdf` bucket
- `DocumentGenerator` calls real Server Actions (no mock data)

## Threat Flags

None — all surfaces are within the plan's threat model (T-08-15 through T-08-21). No new trust boundaries introduced beyond what was specified.

## Self-Check: PASSED

Files confirmed present:
- `src/proxy.ts` — modified (documentos module)
- `src/actions/documents.ts` — modified (getActor, AES encrypt, cross-tenant guards)
- `src/app/api/documentos/[versionId]/route.ts` — created
- `src/components/documents/DocumentGenerator.tsx` — created
- `src/components/documents/DocumentVersionsList.tsx` — created
- `src/app/(dashboard)/clinica/documentos/page.tsx` — created
- `src/components/shell/nav-config.ts` — modified
- `src/components/shell/nav-icons.ts` — modified

Commits confirmed: `e345827`, `ea8fd6c`, `fb45873`
