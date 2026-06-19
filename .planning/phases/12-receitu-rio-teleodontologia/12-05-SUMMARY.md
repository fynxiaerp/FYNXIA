# Plan 12-05 Summary — [BLOCKING] DB push + gen types

**Wave:** 3 | **Status:** complete | **Date:** 2026-06-19

## What happened
Single [BLOCKING] migration checkpoint for Phase 12, executed inline by the orchestrator after Supabase CLI re-auth (recurring gotcha: CLI had flipped back to the wrong `nexus-*` account; user re-logged via OAuth). Account verified as FYNXIA org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` (● LINKED) before push.

## Actions
1. `npx supabase db push --dry-run` → confirmed exactly the 5 expected migrations.
2. `npx supabase db push` → applied to FYNXIA production:
   - `20260618000100_clinical_documents.sql` (clinical_documents + medications + document_seq_counters + next_doc_number())
   - `20260618000200_clinical_documents_rls.sql`
   - `20260618000300_clinical_documents_bucket.sql` (private clinical-documents-pdf bucket)
   - `20260618000400_teleconsultations.sql` (teleconsultations + soap_records)
   - `20260618000500_teleconsultations_rls.sql`
3. `gen types`: first attempt 403 (restricted PAT could push but not call the Management API gen-types endpoint) → user re-logged via OAuth → succeeded. Temp-file guard: 3189 lines (>1000), all 5 new tables + next_doc_number RPC present → overwrote `src/types/database.types.ts`.
4. Removed the `as never` workaround casts in `src/actions/clinical-documents.ts` + `teleconsultations.ts` now that real types exist; `npx tsc --noEmit` exit 0.

## Verification
- `database.types.ts` reflects medications/clinical_documents/document_seq_counters/teleconsultations/soap_records + `next_doc_number`.
- Sacred appointments GIST + status CHECK unchanged; Phase 8 sign-document.ts untouched.
- Commit: `4d45197`.

## Gotcha logged
The `gen types --linked` Management-API endpoint requires a full-privilege OAuth token; a manually-generated restricted PAT can `db push` (DB connection) but returns 403 on gen-types. Re-login via `npx supabase login` (OAuth, no manual token) restores it.
