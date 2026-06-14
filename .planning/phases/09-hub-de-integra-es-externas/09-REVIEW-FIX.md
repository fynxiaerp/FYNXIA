---
phase: 09-hub-de-integra-es-externas
fixed_at: 2026-06-14T14:48:30Z
review_path: .planning/phases/09-hub-de-integra-es-externas/09-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-06-14T14:48:30Z
**Source review:** .planning/phases/09-hub-de-integra-es-externas/09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Info findings IN-01/IN-02 were doc-only and skipped per instructions)
- Fixed: 3
- Skipped: 0

Post-fix verification:
- `npx vitest run`: 801 tests passed (51 test files)
- `npx tsc --noEmit`: exit 0 (no errors)
- `npx next build`: green (all routes compiled)

---

## Fixed Issues

### WR-01: `reprocessConnector` UPDATE missing tenant guard

**Files modified:** `src/actions/integration-events.ts`
**Commit:** `4a3571a`
**Applied fix:** Added `.eq('clinic_id', actor.tenant_id)` to the bulk UPDATE at step 5 of `reprocessConnector`. The ids array is already tenant-scoped by the prior SELECT, so behavior is identical under normal operation. The added filter is a defense-in-depth guard that makes the UPDATE self-defending against future refactors that might widen the SELECT scope. A comment was added explaining the intent.

---

### WR-02: `deleteConnector` hard DELETE severs audit trail

**Files modified:**
- `supabase/migrations/20260615000700_connectors_soft_delete.sql` (new file)
- `src/lib/integrations/types.ts`
- `src/actions/integration-connectors.ts`
- `src/actions/integration-events.ts`
- `src/__tests__/integrations/connectors.test.ts`

**Commit:** `d043e4f`

**Applied fix:**

1. **New migration** `20260615000700_connectors_soft_delete.sql`: adds `deleted_at TIMESTAMPTZ` (nullable) to `public.integration_connectors` and replaces the `integration_connectors_tenant_read` RLS policy to include `AND deleted_at IS NULL`, so soft-deleted rows are invisible to tenant-scoped SELECT. The `admin_write` policy is unchanged — the service-role admin client can still update soft-deleted rows if needed.

2. **`ConnectorRow` type** (`src/lib/integrations/types.ts`): added `deleted_at: string | null` field to match the new column.

3. **`deleteConnector` action** (`src/actions/integration-connectors.ts`): replaced `.delete()` with `.update({ deleted_at: new Date().toISOString() })`. Added `.is('deleted_at', null)` to make the operation idempotent (cannot soft-delete an already-soft-deleted row). All existing guards (assertNotReadOnly, role gate, tenant scope, audit log) are preserved unchanged.

4. **`listConnectors` query** (`src/actions/integration-connectors.ts`): added `.is('deleted_at', null)` filter and included `deleted_at` in the SELECT column list.

5. **`listConnectorHealth` query** (`src/actions/integration-events.ts`): added `.is('deleted_at', null)` to the connectors SELECT so soft-deleted connectors are excluded from the health view.

6. **Test assertions** (`src/__tests__/integrations/connectors.test.ts`): added a new `describe` block `'Phase 9 migration — connectors_soft_delete (WR-02 LGPD audit trail)'` with 3 source-inspection assertions verifying the migration file exists, adds the `deleted_at TIMESTAMPTZ` column, and updates the RLS policy to filter `deleted_at IS NULL`.

**IMPORTANT — db push required:** Migration `20260615000700_connectors_soft_delete.sql` has been created but NOT applied to the remote Supabase instance. The orchestrator must run `supabase db push` (or `supabase migration up`) before this phase goes to production. Until the migration is applied, `deleteConnector` will fail at runtime because the `deleted_at` column does not yet exist in the database.

---

### WR-03: `logToHub` interpolates unvalidated clinicId into PostgREST `.or()` filter

**Files modified:** `src/lib/integrations/hub-log.ts`
**Commit:** `8828ad5`
**Applied fix:** Added UUID validation using `UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` before interpolating `clinicId` into the PostgREST `.or()` filter string. If `clinicId` is not a well-formed UUID, `safeClinicId` is set to `null` and the safe system-sentinel branch (`clinic_id.is.null`) is taken instead. Current callers both pass `clinicId: null`, so behavior is identical today. The change prevents silent degradation for future callers that might pass a resolved but malformed value.

---

## Skipped Issues

None — all 3 in-scope findings were fixed.

Info findings IN-01 and IN-02 were excluded from scope per instructions (doc-only, risk of breaking tests).

---

_Fixed: 2026-06-14T14:48:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
