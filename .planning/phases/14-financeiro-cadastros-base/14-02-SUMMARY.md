---
phase: 14-financeiro-cadastros-base
plan: 02
subsystem: financeiro
tags: [migrations, sql, rls, seed, backfill, wave-2, fcad]
dependency_graph:
  requires:
    - plan: 14-01 (RED test contracts)
    - migration: 20260606000100_financial_tables.sql (financial_transactions, financial_categories)
    - migration: 20260614000100_units_table.sql (units, audit_units_changes())
  provides:
    - migration: supabase/migrations/20260619001100_financial_cadastros_tables.sql
    - migration: supabase/migrations/20260619001200_financial_cadastros_rls.sql
    - migration: supabase/migrations/20260619001300_financial_cadastros_seed.sql
  affects:
    - plan: 14-03 (db push — BLOCKING; must run before any UI/Server Action plan)
    - plan: 14-04 (chart-tree.ts buildTree reads from chart_of_accounts)
    - plan: 14-05 (Server Actions createAccount, createCostCenter, createBankAccount)
tech_stack:
  added: []
  patterns:
    - adjacency-list self-referential table with ON DELETE RESTRICT for tree integrity
    - partial unique index WHERE is_default = true (one default CC per unit)
    - NULLABLE columns on ALTER TABLE + Server Action enforcement (D-03b)
    - SECURITY DEFINER seed function + alphabetically-ordered trigger (Pitfall 5)
    - CREATE OR REPLACE to update existing trigger function (seed_financial_categories)
    - NOT EXISTS guard for idempotent seed backfills
    - RAISE EXCEPTION assertion block for zero-unresolved-rows invariant
key_files:
  created:
    - supabase/migrations/20260619001100_financial_cadastros_tables.sql
    - supabase/migrations/20260619001200_financial_cadastros_rls.sql
    - supabase/migrations/20260619001300_financial_cadastros_seed.sql
  modified: []
decisions:
  - id: D-14-02-01
    summary: Indexes placed after all ALTER TABLE statements to avoid regex false-positives in source-inspection tests
    rationale: Test /account_id\s+UUID[^,]*NOT NULL/ spans newlines via [^,]*; ordering CREATE TABLE/ALTER before all CREATE INDEX prevents the pattern from crossing statement boundaries
  - id: D-14-02-02
    summary: bank_account_id ALTER kept in same multi-column ALTER as account_id and cost_center_id (original plan intent preserved)
    rationale: After moving indexes after all DDL, the three columns are all in one ALTER TABLE block, which is cleaner SQL
  - id: D-14-02-03
    summary: NOT EXISTS guard used for idempotent CC seed instead of ON CONFLICT
    rationale: Partial unique index (WHERE is_default = true) makes ON CONFLICT DO NOTHING conflict-target syntax awkward; NOT EXISTS achieves same idempotency
metrics:
  duration_minutes: 9
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 14 Plan 02: Migrations + Libraries Summary

**One-liner:** 3 SQL migrations creating chart_of_accounts/cost_centers/bank_accounts with RLS, a 14-node odontological seed, idempotent backfill, and a RAISE EXCEPTION guard ensuring zero unresolved cost-center rows.

---

## What Was Built

Wave 2 (GREEN): 3 migration files that turn the Plan 01 RED source-inspection tests fully GREEN (48/48 pass).

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `20260619001100_financial_cadastros_tables.sql` | 147 | 3 new tables + ALTERs on 2 existing tables + indexes + audit triggers |
| `20260619001200_financial_cadastros_rls.sql` | 72 | RLS ENABLE + tenant_read + admin_write policies for all 3 new tables |
| `20260619001300_financial_cadastros_seed.sql` | 302 | Chart seed function + trigger + categories update + backfills + assertion |

### Schema Delivered

**New tables:**

| Table | Isolation | Key constraints |
|-------|-----------|-----------------|
| `chart_of_accounts` | `clinic_id` | `parent_id` self-ref ON DELETE RESTRICT; unique `(clinic_id, code)` |
| `cost_centers` | `clinic_id` | `unit_id` FK ON DELETE RESTRICT; partial unique `(unit_id) WHERE is_default = true` |
| `bank_accounts` | `clinic_id` | `saldo_inicial NUMERIC(12,2)` |

**Expanded columns (NULLABLE, D-03b):**

| Table | New column | FK behavior |
|-------|-----------|-------------|
| `financial_transactions` | `account_id` | ON DELETE RESTRICT |
| `financial_transactions` | `cost_center_id` | ON DELETE RESTRICT |
| `financial_transactions` | `bank_account_id` | ON DELETE SET NULL |
| `financial_categories` | `account_id` | ON DELETE SET NULL |

**Seed + backfill:**
- `seed_chart_of_accounts()`: 14-node odontological chart (2 roots, 2 subgroups, 10 leaves)
- `seed_accounts_on_clinic` trigger fires alphabetically before `seed_categories_on_clinic` (Pitfall 5)
- `seed_financial_categories()` updated to map `account_id` after inserting categories
- Backfill: all existing clinics get chart, all existing `financial_categories` get `account_id` mapped, all existing `financial_transactions` get `cost_center_id` from default CC
- STEP 10 `RAISE EXCEPTION` aborts migration atomically if any row has a resolvable CC but no `cost_center_id`

---

## Test Results

```
migrations-phase14.test.ts: 48/48 PASS (full GREEN — all 3 migration sections)

financeiro suite summary:
  5 files PASS (migrations-phase14, regression-guard, receivables, charge-form, money)
  2 files FAIL RED (chart-of-accounts, transaction-classification — Plan 03/04 modules absent, expected)
  73 assertions passing, 11 failing RED (expected Wave 2 state)

npm run build: exits 0 (SQL-only migration, no TypeScript impact)
```

---

## Commits

| Hash | Description |
|------|-------------|
| 54fc815 | feat(14-02): tables migration — chart_of_accounts, cost_centers, bank_accounts + ALTERs |
| e36c3b8 | feat(14-02): RLS migration — chart_of_accounts, cost_centers, bank_accounts |
| d306770 | feat(14-02): seed + backfill migration — chart, CCs, category mapping, transaction backfill |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restructured migration to fix source-inspection test regex false-positives**
- **Found during:** Task 1 verification
- **Issue:** The test `/account_id\s+UUID[^,]*NOT NULL/` uses `[^,]*` which spans newlines. With the original ordering (ALTER TABLE + indexes interspersed), `bank_account_id UUID...SET NULL;` had no comma between it and `WHERE account_id IS NOT NULL` in the index, causing the regex to match across statement boundaries and fail the "account_id is NOT added with NOT NULL" assertion.
- **Fix:** Reordered the file — all CREATE TABLE and ALTER TABLE statements first, then all CREATE INDEX statements. This ensures every multi-column ALTER ends with a comma-separated list, and the partial-index `NOT NULL` appears after all ALTER statements.
- **Files modified:** `20260619001100_financial_cadastros_tables.sql`
- **Commit:** 54fc815 (final version after two incremental fixes)

---

## Known Stubs

None — this plan creates SQL migration files only. No UI rendering or data flows involved.

---

## Threat Flags

None — all new trust boundaries were already captured in the plan's threat model:
- T-14-01 (cross-tenant read): mitigated by `clinic_id = get_my_tenant_id()` in RLS SELECT
- T-14-02 (privilege escalation): mitigated by `get_my_role() IN ('admin','superadmin')` with USING + WITH CHECK
- T-14-04 (backfill cross-tenant mis-assignment): mitigated by scoped JOINs + STEP 10 assertion

---

## Self-Check: PASSED

Files created:
- FOUND: supabase/migrations/20260619001100_financial_cadastros_tables.sql
- FOUND: supabase/migrations/20260619001200_financial_cadastros_rls.sql
- FOUND: supabase/migrations/20260619001300_financial_cadastros_seed.sql

Commits:
- FOUND: 54fc815
- FOUND: e36c3b8
- FOUND: d306770
