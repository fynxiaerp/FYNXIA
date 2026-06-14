---
phase: "07"
plan: "02"
subsystem: multiunidade-data-layer
tags: [migrations, units, user_units, get_my_unit_ids, rls, rbac, role-expansion, backfill]
dependency_graph:
  requires:
    - "07-01: node-forge, phase7.test.ts scaffold (Wave 0)"
  provides:
    - "supabase/migrations/20260614000100_units_table.sql (units table + audit + backfill)"
    - "supabase/migrations/20260614000150_clinics_regime.sql (clinics.regime_tributario)"
    - "supabase/migrations/20260614000200_units_rls.sql (units RLS)"
    - "supabase/migrations/20260614000300_user_units.sql (user_units N:N + get_my_unit_ids())"
    - "supabase/migrations/20260614000400_role_expansion.sql (role CHECK 5→11 values)"
    - "supabase/migrations/20260614000700_operational_unit_id.sql (unit_id backfill)"
  affects:
    - "Plan 03: certificates + ai_agent_config migrations build on units table"
    - "Plan 04: db push applies all 6 of these migration files to production"
    - "Plan 05: empresa form uses clinics.regime_tributario (SYS-01)"
    - "Plans 05–09: unit_id on appointments/charges/receivables enables SYS-05 BI per unit"
tech_stack:
  added: []
  patterns:
    - "audit_units_changes() dedicated trigger function using clinic_id (mirrors audit_clinics_changes pattern)"
    - "get_my_unit_ids() RETURNS UUID[] STABLE SECURITY DEFINER — network roles get all units, operational get assigned"
    - "Three-step NULLABLE->UPDATE->NOT NULL for unit_id on existing populated tables (Pitfall 2 compliance)"
    - "TEXT CHECK constraint expansion via DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT (not enum)"
key_files:
  created:
    - supabase/migrations/20260614000100_units_table.sql
    - supabase/migrations/20260614000150_clinics_regime.sql
    - supabase/migrations/20260614000200_units_rls.sql
    - supabase/migrations/20260614000300_user_units.sql
    - supabase/migrations/20260614000400_role_expansion.sql
    - supabase/migrations/20260614000700_operational_unit_id.sql
  modified: []
decisions:
  - "audit_units_changes() created as dedicated trigger (not reusing audit_table_changes()) because units uses clinic_id not tenant_id — mirrors the existing audit_clinics_changes() precedent"
  - "get_my_unit_ids() returns UUID[] (not UUID) to support multi-unit assignment for floating dentists (franchise target market)"
  - "user_units.clinic_id denormalized for RLS checks without joining units (T-07-04 cross-tenant prevention)"
  - "unit_id backfill uses is_default=true pivot — every existing clinic has exactly 1 default unit after migration 20260614000100"
  - "Unit-level RLS on operational tables deferred to future phase — this plan only lands the column so SYS-05 can be built"
metrics:
  duration_minutes: 35
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 0
  completed_date: "2026-06-14"
---

# Phase 07 Plan 02: Multiunidade Migrations — Wave 1 Data Layer Summary

Six migration SQL files establishing the multi-unit data layer: `units` table (filiais) under `clinics` (rede/tenant), `clinics.regime_tributario` column for SYS-01, N:N `user_units` assignment table, `get_my_unit_ids()` SECURITY DEFINER helper for unit-scoped RLS, role CHECK expansion from 5 to 11 values on both `users` and `invitations`, and `unit_id` added (NULLABLE → backfill → NOT NULL) to `appointments`, `charges`, and `receivables`.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | units table + audit trigger + clinics.regime_tributario + units RLS | 41bc5ab | 20260614000100_units_table.sql, 20260614000150_clinics_regime.sql, 20260614000200_units_rls.sql |
| 2 | user_units N:N + get_my_unit_ids() SECURITY DEFINER + role expansion | b4ec5b6 | 20260614000300_user_units.sql, 20260614000400_role_expansion.sql |
| 3 | unit_id NULLABLE→backfill→NOT NULL on appointments/charges/receivables | a0584ed | 20260614000700_operational_unit_id.sql |

---

## Verification

- `npx vitest run src/__tests__/migrations/phase7.test.ts` → 32 PASS (Plan 02 targets GREEN), 16 FAIL (Plan 03 targets — `20260614000500_certificates.sql` and `20260614000600_ai_agent_config.sql` not yet written, expected RED)
- `npx tsc --noEmit` → exit 0 (no TypeScript errors)
- Migration file order correct: units(100) → clinics_regime(150) → units_rls(200) → user_units(300) → role_expansion(400) → operational_unit_id(700)
- No `NOT NULL` on any `ADD COLUMN unit_id` line (Pitfall 2 / T-07-07 compliance verified)

---

## Deviations from Plan

None — plan executed exactly as written. All 6 migration files match the plan's `files_modified` list, all `must_haves.artifacts` requirements satisfied, all `must_haves.truths` encoded in SQL.

---

## Known Stubs

None — this plan creates SQL migration files only; no UI components or data flows.

---

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. Mitigations applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-07-04 (cross-tenant unit assignment) | user_units write RLS has `clinic_id = get_my_tenant_id()` in BOTH USING and WITH CHECK |
| T-07-05 (get_my_unit_ids leaking across tenants) | Network-role branch filters `clinic_id = get_my_tenant_id()`; operational branch scoped to `auth.uid()` |
| T-07-06 (role escalation via unlisted value) | CHECK constraint on users.role AND invitations.role — 11-value allowlist |
| T-07-07 (NOT NULL before backfill aborts migration) | Three-step NULLABLE→UPDATE→NOT NULL ordering enforced in all three table additions |
| T-07-23 (invalid regime_tributario) | CHECK constraint (4-value allowlist: simples_nacional, lucro_presumido, lucro_real, mei) |

---

## Self-Check

| Check | Result |
|-------|--------|
| supabase/migrations/20260614000100_units_table.sql | FOUND |
| supabase/migrations/20260614000150_clinics_regime.sql | FOUND |
| supabase/migrations/20260614000200_units_rls.sql | FOUND |
| supabase/migrations/20260614000300_user_units.sql | FOUND |
| supabase/migrations/20260614000400_role_expansion.sql | FOUND |
| supabase/migrations/20260614000700_operational_unit_id.sql | FOUND |
| commit 41bc5ab | FOUND |
| commit b4ec5b6 | FOUND |
| commit a0584ed | FOUND |

## Self-Check: PASSED
