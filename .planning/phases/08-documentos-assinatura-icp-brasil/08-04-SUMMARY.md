---
phase: 08-documentos-assinatura-icp-brasil
plan: 04
subsystem: documents
tags: [template-management, crud, rbac, rhf, zod, server-actions, config-ui, doc-01]

requires:
  - phase: 08-documentos-assinatura-icp-brasil
    plan: 02
    provides: document_templates table + detectVariables + document-types constants + base Server Actions

provides:
  - documentTemplateSchema (Zod v3, no .default()) — validates name/category/content/is_active
  - Enhanced createTemplate/updateTemplate/deleteTemplate/listTemplates with getActor+role gate+Zod+audit
  - DocumentTemplateForm client component — RHF+zodResolver, live variable detection
  - DocumentTemplatesManager client component — table list + Dialog create/edit + inline delete confirm
  - /config/documentos route (Server Component, admin/superadmin/ti gate, Acesso restrito Alert)

affects:
  - 08-05: DocumentTemplatesManager + listTemplates provide the template picker for document generation
  - 12-receituario: will consume these templates for prescription documents
  - 15-nfse: will consume template engine

tech-stack:
  added: []
  patterns:
    - "documentTemplateSchema: z.object without .default() — avoids RHF v7 resolver input/output type mismatch"
    - "getActor() helper: mirrors certificate.ts — createClient().auth.getUser() then users.select(id,tenant_id,role)"
    - "Role gate admin/superadmin/ti in every mutation: defense-in-depth alongside RLS (T-08-11)"
    - "listTemplates selects content column: enables form pre-population on edit without extra fetch"
    - "Live detectVariables() in DocumentTemplateForm: form.watch('content') → Badge chips"
    - "Inline delete confirm: no modal — row-level confirmation buttons (UX pattern from UnitsManager)"

key-files:
  created:
    - src/lib/validators/document-template.ts
    - src/components/config/DocumentTemplateForm.tsx
    - src/components/config/DocumentTemplatesManager.tsx
    - src/app/(dashboard)/config/documentos/page.tsx
  modified:
    - src/actions/document-templates.ts (added getActor, role gate, Zod validation, logBusinessEvent, content in listTemplates select)

key-decisions:
  - "documentTemplateSchema uses z.object without .default() — RHF v7 + @hookform/resolvers v5 resolvers compare input vs output types; .default() creates a mismatch that tsc rejects"
  - "listTemplates includes content in select — edit pre-population avoids a second server fetch; content is bounded by the 20000-char schema limit"
  - "Error feedback via Alert (not sonner) — sonner is not installed; Alert is the established in-app error pattern"

metrics:
  duration: 28min
  completed: 2026-06-14T15:24:59Z
  tasks: 2
  files_created: 4
  files_modified: 1
---

# Phase 08 Plan 04: Template Management CRUD + Editor UI Summary

**documentTemplateSchema (Zod v3) + enhanced Server Actions + DocumentTemplateForm/Manager + /config/documentos route with admin/superadmin/ti gate and live {{variable}} detection**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-06-14T14:57:00Z
- **Completed:** 2026-06-14T15:24:59Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- **Task 1** — Validator + enhanced Server Actions:
  - `src/lib/validators/document-template.ts`: `documentTemplateSchema` (Zod v3) — name 3-120 chars, category non-empty, content min 1/max 20000, is_active boolean. No `.default()` (see Deviation 1).
  - `src/actions/document-templates.ts` fully upgraded: `getActor()` helper (mirrors certificate.ts), role gate `admin/superadmin/ti` on all mutations, per-field Zod validation before DB ops, `logBusinessEvent` audit on create/update/delete (T-08-11 mitigations), `content` added to `TemplateListItem` and `listTemplates` select.
  - 18/18 actions.test.ts GREEN; tsc exit 0.

- **Task 2** — Template editor UI + route:
  - `DocumentTemplateForm` ('use client'): react-hook-form + zodResolver, name/category select (DEFAULT_DOCUMENT_CATEGORIES + pt-BR labels)/content textarea, live `detectVariables()` preview with Badge chips, pt-BR error Alerts, create/edit mode.
  - `DocumentTemplatesManager` ('use client'): table (name, category, variable count, ativo badge), "Novo Modelo" button, per-row edit Dialog + inline delete confirmation (row-level confirm pattern from UnitsManager).
  - `/config/documentos` (Server Component): auth via `createClient().auth.getUser()`, role gate `admin/superadmin/ti`, "Acesso restrito" Alert (no redirect — v1 convention), `listTemplates()` initial data, PageHeader breadcrumbs Configurações › Documentos.
  - tsc exit 0; next build green; `/config/documentos` appears in build output.

## Task Commits

1. **Task 1: validator + enhanced Server Actions** — `15506ce`
2. **Task 2: template editor UI + /config/documentos route** — `ce96622`

## Overall Verification

- `npx vitest run src/__tests__/documents/actions.test.ts` → **18/18 GREEN**
- `npx tsc --noEmit` → **exit 0**
- `npx next build` → **green** (`/config/documentos` rendered as dynamic route ƒ)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `documentTemplateSchema` `.default()` causes RHF v7 resolver type mismatch**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Zod `.default()` produces a schema whose input type has optional fields but output type has required fields. `@hookform/resolvers` v5 strict types compare them — tsc rejected the `zodResolver(documentTemplateSchema)` call with "Resolver<input, …> is not assignable to Resolver<output, …>".
- **Fix:** Removed `.default('outro')` from `category` and `.default(true)` from `is_active`. The RHF `defaultValues` in `DocumentTemplateForm` supplies these values explicitly; server actions apply `|| 'outro'` fallback for category.
- **Files modified:** `src/lib/validators/document-template.ts`
- **Commit:** `ce96622`

**2. [Rule 3 - Blocking] `sonner` not installed — used Alert instead**
- **Found during:** Task 2 planning (package.json inspection)
- **Issue:** Plan specified "show pt-BR error toasts (sonner) on failure" but `sonner` is not in `package.json` and has no shadcn `ui/sonner.tsx`.
- **Fix:** Used the established `Alert` / `AlertDescription` pattern (same as `CertificateUpload`, `UnitsManager`) for error display.
- **Files modified:** `src/components/config/DocumentTemplateForm.tsx`, `src/components/config/DocumentTemplatesManager.tsx`
- **Commit:** `ce96622`

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug, Rule 3 - Blocking). No behavioral or scope change.

## Known Stubs

None — all CRUD actions are wired to the live `document_templates` table (migrations applied in Plan 03). The `listTemplates` call in `DocumentosPage` returns real data; `DocumentTemplatesManager` optimistically updates local state on success.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's threat model. T-08-11 through T-08-14 mitigations are all implemented:
- T-08-11: `assertNotReadOnly()` + role gate in every mutation
- T-08-12: `documentTemplateSchema` validates name/category/content at action entry
- T-08-13: `listTemplates` uses `createClient()` → RLS `clinic_id = get_my_tenant_id()`
- T-08-14: Actions return Portuguese user-facing messages; raw DB errors are swallowed

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk. Both task commits (`15506ce`, `ce96622`) found in git log.
