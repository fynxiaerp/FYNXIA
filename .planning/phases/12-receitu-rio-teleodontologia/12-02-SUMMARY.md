---
phase: 12-receitu-rio-teleodontologia
plan: "02"
subsystem: receituario
tags: [receituario, medications, clinical-documents, migration, allergy, database, pure-lib, zod]

dependency_graph:
  requires:
    - "Phase 8 documents_bucket.sql (private bucket pattern)"
    - "Phase 8 certificates_revoke_secrets.sql (REVOKE SELECT column pattern)"
    - "Phase 8 document_rls.sql (USING+WITH CHECK idiom)"
    - "Phase 11 professionals.sql (professional_id FK target)"
    - "12-01-PLAN.md (Wave 0 RED test scaffolds)"
  provides:
    - "medications table + ~120 dental drug seed rows (allergen_tags, therapeutic_class)"
    - "clinical_documents table (doc_type CHECK 4 types, content_json TEXT encrypted, portal_visible)"
    - "document_seq_counters + next_doc_number() SECURITY DEFINER Postgres function"
    - "clinical-documents-pdf private storage bucket"
    - "checkMedicationAllergy PURE function (RX-02, accent/case-insensitive)"
    - "formatDocNumber pure helper (REC/RCC/ATE/EXM-YYYY-NNNN)"
    - "clinicalDocumentSchema + medicationLineSchema (Zod v3, no .default)"
  affects:
    - "12-04-PLAN.md (Server Actions: issueClinicDocument/signClinicDocument consume all of these)"
    - "12-05-PLAN.md (BLOCKING db push applies these migrations)"
    - "12-06-PLAN.md (UI imports clinicalDocumentSchema + checkMedicationAllergy)"

tech_stack:
  added: []
  patterns:
    - "ON CONFLICT DO UPDATE SET last_seq+1 (atomic Postgres upsert — no MAX+1)"
    - "REVOKE SELECT (col) FROM authenticated,anon (Phase 8 pattern reused)"
    - "TEXT not JSONB for encrypted health PII at rest"
    - "NFD normalize + strip combining diacritics for pt-BR tolerant text match"
    - "PURE function pattern: no use-server, no server-only, importable anywhere"
    - "Zod v3 flat schema: no .default(), conditional validation in action not schema"

key_files:
  created:
    - supabase/migrations/20260618000100_clinical_documents.sql
    - supabase/migrations/20260618000200_clinical_documents_rls.sql
    - supabase/migrations/20260618000300_clinical_documents_bucket.sql
    - src/lib/clinical/allergy-check.ts
    - src/lib/clinical/doc-number.ts
    - src/lib/validators/clinical-document.ts
  modified: []

decisions:
  - "content_json is TEXT (not JSONB) — AES-256-GCM encrypted at rest; JSONB would expose prescription PII (T-12-10, Pitfall 7)"
  - "REVOKE SELECT (storage_path, cert_pem) on clinical_documents — mirrors Phase 8 document_versions pattern (T-12-08)"
  - "medications table has NO clinic_id — global reference; RLS uses active=true only, no tenant filter (Pitfall 4)"
  - "next_doc_number() uses ON CONFLICT DO UPDATE (atomic upsert) — never MAX+1 (T-12-09, Pitfall 3)"
  - "checkMedicationAllergy is PURE (no use-server) — decrypt happens upstream in Plan 04 action"
  - "clinicalDocumentSchema has no .default() — D-133/D-158; RHF defaultValues supply values"
  - "doc_type CHECK uses receita_controle_especial (not receita_controle) — matches interface spec and test assertions"

metrics:
  duration_minutes: 9
  completed_date: "2026-06-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 12 Plan 02: Receituário Foundations Summary

**One-liner:** `medications` global drug table (~120 dental meds + allergen_tags) + `clinical_documents` table (content_json TEXT/AES, portal_visible, 4-type CHECK) + atomic `next_doc_number()` RPC + PURE `checkMedicationAllergy` (NFD tolerant match) + `formatDocNumber` + Zod v3 schema.

---

## What Was Built

### Task 1: Receituário Migrations (commit `c438071`)

Three migrations created — NOT pushed (Plan 12-05 is the BLOCKING db push):

**`20260618000100_clinical_documents.sql`**
- `public.medications`: global reference table (no `clinic_id`), `therapeutic_class TEXT`, `allergen_tags TEXT[]`, `requires_special_control BOOLEAN`, `common_dosages TEXT[]`, `active BOOLEAN`; indexes on `therapeutic_class` + partial `active`
- **Seed**: ~120 rows covering the full dental formulary — analgésicos (dipirona, paracetamol), AINEs (ibuprofeno, nimesulida, cetoprofeno, diclofenaco, meloxicam, naproxeno, etoricoxib, celecoxibe), antibióticos (amoxicilina, amox+clav, clindamicina, azitromicina, metronidazol, cefalexina, cefadroxil, eritromicina, doxiciclina, penicilina, sulfas, fluoroquinolonas), anestésicos locais (lidocaína, mepivacaína, articaína, prilocaína, bupivacaína, benzocaína tópica), corticosteroides (dexametasona, betametasona, prednisolona), antifúngicos (nistatina, miconazol, fluconazol), antissépticos (clorexidina 0.12%/0.2%), opioides leves (codeína, tramadol — `requires_special_control=true`), benzodiazepínicos (diazepam, midazolam, alprazolam, lorazepam — `requires_special_control=true`), antialérgicos, hemostáticos, protetores gástricos, endodônticos (hipoclorito, EDTA, PMCC, Ca(OH)2), outros
- Allergen tags precise: penicilínicos → `['penicilina','betalactamico']`; AINEs → `['aine']` + specific; anestésicos amida → `['anestesico_local','amida']`; ésteres → `['anestesico_local','ester']`; sulfas → `['sulfa']`
- `public.clinical_documents`: `doc_type CHECK ('receita_simples','receita_controle_especial','atestado','solicitacao_exame')`, `status CHECK ('draft','signed')`, `content_json TEXT` (AES-encrypted — NOT JSONB), `portal_visible BOOLEAN`, `deleted_at` (LGPD), full ICP signature columns mirroring Phase 8 `document_versions`
- `REVOKE SELECT (storage_path, cert_pem)` on `clinical_documents` (T-12-08)
- `public.document_seq_counters`: `UNIQUE(clinic_id, doc_type)`
- `next_doc_number(p_clinic_id, p_doc_type)`: SECURITY DEFINER, `INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq` — atomic, no MAX+1
- `GRANT EXECUTE ON FUNCTION next_doc_number TO authenticated`

**`20260618000200_clinical_documents_rls.sql`**
- `clinical_documents`: SELECT (`clinic_id = get_my_tenant_id() AND deleted_at IS NULL`); ALL write (`get_my_role() IN ('admin','superadmin','dentist')`) with USING + WITH CHECK
- `document_seq_counters`: tenant-scoped SELECT + write (defense-in-depth; function is SECURITY DEFINER)
- `medications`: SELECT `USING (active = true)` — NO tenant filter (global reference); write gated to `get_my_role() = 'superadmin'`

**`20260618000300_clinical_documents_bucket.sql`**
- `INSERT INTO storage.buckets ... ('clinical-documents-pdf', 'clinical-documents-pdf', false)` — private; mirrors `documents-pdf` pattern from Phase 8; service role sole accessor

### Task 2: Pure Libs + Zod Schema (commit `7056abc`)

**`src/lib/clinical/allergy-check.ts`** (PURE — no server directives)
- `norm(s)`: NFD decompose → strip combining diacritics U+0300–U+036F → lowercase + trim — handles all pt-BR accented variants
- `checkMedicationAllergy(params)`: 4-step algorithm: (1) `alergia_medicamento` flag → push reason; (2) `alergia_anestesia && therapeuticClass === 'anestesico_local'` → push reason; (3) each `allergenTag` vs `norm(allergiesPlaintext)` → push per-tag reason; (4) medication name vs allergy text → push name reason. Returns `{ hasAlert: boolean, reasons: string[] }`. Never throws.

**`src/lib/clinical/doc-number.ts`** (PURE)
- `ClinicalDocType` union type
- `DOC_TYPE_PREFIX: Record<ClinicalDocType, string>` — `{receita_simples:'REC', receita_controle_especial:'RCC', atestado:'ATE', solicitacao_exame:'EXM'}`
- `formatDocNumber(docType, seq, year)` → `` `${prefix}-${year}-${String(seq).padStart(4,'0')}` ``

**`src/lib/validators/clinical-document.ts`** (Zod v3, no `.default()`)
- `medicationLineSchema`: `medication_id uuid`, `medication_name min(1)`, `posologia min(1).max(500)`, `quantidade max(100).optional()`
- `clinicalDocumentSchema`: flat schema covering all 4 doc types; doc-type-conditional validation deferred to Plan 04 action
- Exported: `MedicationLineInput`, `ClinicalDocumentInput`

---

## Test Results

| Suite | GREEN | Total | Notes |
|-------|-------|-------|-------|
| `migrations-phase12-rx.test.ts` | 58 | 58 | All migration + GIST regression asserts GREEN |
| `allergy-check.test.ts` | 12 | 12 | All pure-unit + source-inspection GREEN |
| `clinical-documents.test.ts` | 8 | 30 | 22 RED = Plans 04/06 (action + PDF + UI not yet created — by design) |
| `formatDocNumber` (inside clinical-documents.test.ts) | 4 | 4 | All prefix/pad cases GREEN |
| `tsc --noEmit` | PASS | — | 0 errors |
| `src/__tests__/documents/` | 316 | 338 | No regressions in Phase 8 suites |

**Intentionally still RED** (Plans 04/06 targets, not in this plan's scope):
- `src/actions/clinical-documents.ts` source-inspection (Plan 04)
- `src/components/pdf/ReceituarioPDF.tsx`, `AtestadoPDF.tsx`, `ExamePDF.tsx` (Plan 06)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `content_json TEXT` spacing in migration**
- **Found during:** Task 1 verification (migrations-phase12-rx.test.ts run 1)
- **Issue:** Test regex `/content_json TEXT/` requires single space; original column definition used multi-space alignment (`content_json     TEXT`)
- **Fix:** Removed alignment padding so the literal `content_json TEXT` appears in the SQL
- **Files modified:** `supabase/migrations/20260618000100_clinical_documents.sql`
- **Commit:** inline fix before Task 1 commit `c438071`

**2. [Rule 1 - Bug] allergy-check.ts comment triggered `/'use server'/` assertion**
- **Found during:** Task 2 GREEN verification (allergy-check.test.ts run 1)
- **Issue:** The docstring phrase `no 'use server'` literally matched the test's `expect(src).not.toMatch(/'use server'/)` — causing a false-positive failure
- **Fix:** Rewrote comment to `no server directives` — semantically identical, no literal match
- **Files modified:** `src/lib/clinical/allergy-check.ts`
- **Commit:** inline fix before Task 2 commit `7056abc`

---

## Known Stubs

None — all created artifacts are complete and functional. The Zod schema's conditional validation (receita needs medications, atestado needs motivo) is intentionally deferred to the Plan 04 Server Action per the plan spec — this is documented in a comment in `clinical-document.ts`, not a stub.

---

## Threat Flags

No new threat surface beyond what was in the plan's threat model. All T-12-06 through T-12-11 mitigations applied as planned.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `supabase/migrations/20260618000100_clinical_documents.sql` | FOUND |
| `supabase/migrations/20260618000200_clinical_documents_rls.sql` | FOUND |
| `supabase/migrations/20260618000300_clinical_documents_bucket.sql` | FOUND |
| `src/lib/clinical/allergy-check.ts` | FOUND |
| `src/lib/clinical/doc-number.ts` | FOUND |
| `src/lib/validators/clinical-document.ts` | FOUND |
| Commit `c438071` (Task 1) | FOUND |
| Commit `7056abc` (Task 2) | FOUND |
