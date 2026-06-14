---
phase: 07-sistema-multiunidade-pap-is
fixed_at: 2026-06-14T00:10:00Z
review_path: .planning/phases/07-sistema-multiunidade-pap-is/07-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-06-14
**Source review:** `.planning/phases/07-sistema-multiunidade-pap-is/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

---

## Fixed Issues

### WR-01: Middleware debug catch block exposes full stack trace

**Files modified:** `src/proxy.ts`
**Commit:** `16ea9b1`
**Applied fix:** Removed the `try { // TEMP-DEBUG` wrapper and the matching `} catch (error) { // TEMP-DEBUG` block that was returning a plain-text HTTP 500 response containing the full `error.stack` to any caller. The `proxy()` function body now runs unwrapped — Next.js middleware errors are caught by the framework and logged server-side. The request-scoped `supabase` client returned by `updateSession()` is preserved on line 168 (no `createClient()` reintroduction). The `// TEMP-DEBUG` marker comments were also removed as part of this fix (resolving IN-01).

---

### WR-03: `saveAiAgentConfig` partial-index upsert may create duplicates

**Files modified:** `src/actions/ai-agent-config.ts`
**Commit:** `80a7a67`
**Applied fix:** Replaced the `.upsert(..., { onConflict: 'clinic_id,agent_key' })` call with an explicit UPDATE-then-INSERT pattern. PostgREST requires a plain UNIQUE constraint as a conflict arbiter; `ai_agent_config` has only a partial unique index (`uq_ai_agent_config_network WHERE unit_id IS NULL`) which PostgREST cannot resolve, causing repeated saves to insert duplicate rows. The new pattern:
1. Runs `.update({ autonomy_level, enabled, updated_by, updated_at }).eq('clinic_id', ...).eq('agent_key', ...).is('unit_id', null).select('id')` — targets the partial index predicate exactly.
2. If `updateData.length === 0` (first-time row), runs `.insert({ ... unit_id: null ... })`.
The audit log, role gate, and `assertNotReadOnly()` guard are all preserved.

---

### WR-02: `certificates` RLS SELECT exposes secret columns at DB layer

**Files modified:** `supabase/migrations/20260614000900_certificates_revoke_secrets.sql` (new), `src/__tests__/migrations/phase7.test.ts`
**Commit:** `bef84bd`
**Applied fix:**
- Created new migration `supabase/migrations/20260614000900_certificates_revoke_secrets.sql` that issues:
  ```sql
  REVOKE SELECT (cert_password_enc, storage_path)
    ON public.certificates
    FROM authenticated, anon;
  ```
  This is defense-in-depth: even a `select('*')` by an authenticated tenant member (e.g. a `dpo` role with config read access) cannot return these two secret columns at the database layer. The service role bypasses column-level privileges by PostgreSQL design, so Phase 8 signing logic via `createAdminClient()` is unaffected.
- Added a `describe` block to `src/__tests__/migrations/phase7.test.ts` with 4 source-inspection assertions verifying the migration file exists and contains the correct REVOKE statement targeting both columns, both grantees, and `public.certificates`.

**IMPORTANT — `supabase db push` required:** This migration has NOT been pushed to the remote Supabase project. The operator (or CI/orchestrator) must run `supabase db push` to apply `20260614000900_certificates_revoke_secrets.sql`. Until that push completes, the column-level privilege restriction is not active in the remote database.

---

## Skipped Issues

None — all 3 in-scope findings were successfully fixed.

---

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 657 tests passed (43 test files) |
| `npx tsc --noEmit` | exit 0 (no errors) |
| `npx next build` | green — all routes compiled successfully |

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
