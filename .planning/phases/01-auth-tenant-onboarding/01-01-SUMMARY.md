---
phase: 01-auth-tenant-onboarding
plan: "01"
subsystem: database
tags: [supabase, postgresql, rls, security-definer, multi-tenant, lgpd, vitest, migrations, audit-trigger]
dependency_graph:
  requires:
    - supabase/migrations/20260603000000_initial_schema.sql (public.tenants table from Phase 0)
    - supabase/migrations/20260603000100_rls_policies.sql (RLS policies on tenants from Phase 0)
    - auth.users (Supabase-managed auth schema)
  provides:
    - supabase/migrations/20260604000200_rename_tenants_to_clinics.sql (tenants→clinics rename + CNPJ/phone/address/specialty/logo_url columns)
    - supabase/migrations/20260604000300_clinics_users_phase1.sql (invitations + patient_consents + audit triggers + July/Aug partitions)
    - supabase/migrations/20260604000400_rls_phase1.sql (RLS on invitations + patient_consents + users_masked view)
    - vitest.config.ts (test infrastructure)
    - src/__tests__/migrations/schema.test.ts (static migration content assertions)
  affects:
    - All future RLS policies that previously referenced public.tenants now use public.clinics
    - All future feature phases (patients, appointments, financial) reference public.clinics as FK target
    - Audit trail: every INSERT/UPDATE/DELETE on clinics and users is now auto-logged
    - LGPD: email column in list views is masked via users_masked view for receptionist/patient roles
tech_stack:
  added:
    - vitest@4.1.8 (dev — test runner)
    - "@vitest/coverage-v8@4.1.8" (dev — coverage)
  patterns:
    - Static SQL content assertion tests (no live DB required — validates migration authoring)
    - SECURITY DEFINER audit trigger variant for tables without tenant_id column (clinics.id IS the tenant_id)
    - Partial unique index WHERE cnpj IS NOT NULL (allows NULL during onboarding, prevents duplicate CNPJs)
    - CASE-based email masking in PostgreSQL view via get_my_role() — SECURITY INVOKER preserves underlying RLS
    - Future-partition proactive creation (July + August 2026) to prevent partition-miss errors
key_files:
  created:
    - supabase/migrations/20260604000200_rename_tenants_to_clinics.sql
    - supabase/migrations/20260604000300_clinics_users_phase1.sql
    - supabase/migrations/20260604000400_rls_phase1.sql
    - vitest.config.ts
    - src/__tests__/migrations/schema.test.ts
  modified:
    - package.json (added test + test:watch scripts, vitest devDependencies)
decisions:
  - "Two separate SECURITY DEFINER trigger functions: audit_clinics_changes() uses NEW.id as tenant_id (clinics.id IS the tenant); audit_table_changes() uses NEW.tenant_id (for tables with explicit tenant_id column)"
  - "invitations RLS: tenant_read (FOR SELECT) + invitations_admin_write (FOR ALL with USING+WITH CHECK) — both require get_my_role() IN admin/superadmin for writes"
  - "patient_consents RLS: read-only via RLS (FOR SELECT); writes routed via service role in Server Actions, same as audit_logs"
  - "users_masked view: SECURITY INVOKER (default) so underlying users RLS still applies — view only changes column values, not row visibility"
  - "Static migration content tests: validates SQL authoring without requiring live DB — aligns with Wave 0 infrastructure goal"
metrics:
  duration_minutes: 12
  tasks_completed: 3
  tasks_total: 4
  files_created: 5
  files_modified: 1
  completed_date: "2026-06-04"
---

# Phase 1 Plan 1: Database Foundation for Auth & Tenant Onboarding Summary

**One-liner:** Three versioned SQL migrations renaming public.tenants to public.clinics, adding CNPJ/phone columns, creating invitations + patient_consents tables, installing SECURITY DEFINER audit triggers on clinics + users, proactively creating July/August 2026 audit partitions, and establishing the users_masked LGPD view — plus vitest infrastructure with static migration content assertions.

## What Was Built

### Task 0 (Wave 0): Test Infrastructure

Vitest installed and configured with node environment. `src/__tests__/migrations/schema.test.ts` provides three static SQL content assertions that validate migration file authoring without requiring a live database connection. Tests were committed in RED state (migrations not yet written) then turned GREEN after Tasks 1 and 2 completed.

**Test command:** `npx vitest run src/__tests__/migrations/schema.test.ts` — all 3 assertions GREEN.

### Task 1: Rename Migration (`20260604000200_rename_tenants_to_clinics.sql`)

- `ALTER TABLE public.tenants RENAME TO clinics` — PostgreSQL auto-updates FK constraints and RLS policy table associations
- `ALTER INDEX idx_tenants_slug RENAME TO idx_clinics_slug` — indexes NOT auto-renamed, explicit rename required
- RLS policy renames: `tenants_own_record → clinics_own_record`, `tenants_admin_update → clinics_admin_update`
- ADD COLUMN: cnpj, phone, address, specialty, logo_url (all TEXT, nullable — validated at application layer)
- `CREATE UNIQUE INDEX idx_clinics_cnpj WHERE cnpj IS NOT NULL` — partial unique index prevents duplicate clinic registry documents while allowing NULL during onboarding
- Re-assert `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER — defensive measure against Pitfall 1 (PostgreSQL does not rewrite function body text on table rename)

### Task 2: Tables + Audit Trigger + Partitions + Masked View

**`20260604000300_clinics_users_phase1.sql`**

**invitations table (D-04, D-05):**
- `expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'` — enforces D-05 24h expiry
- State machine: `pending → accepted | expired | revoked`
- `idx_invitations_one_pending` partial unique index on `(tenant_id, email) WHERE status = 'pending'` — one pending invite per clinic/email pair (reenvio invalidation via status update)
- Partial index `idx_invitations_expires_at WHERE status = 'pending'` — efficient expiry sweeps

**patient_consents table (SEC-05, LGPD):**
- `consent_type` CHECK constraint: `data_processing | marketing_whatsapp | medical_record_sharing | ai_processing`
- `policy_version` TEXT — version bump required on privacy policy changes
- `ip_address INET`, `user_agent TEXT` — LGPD demonstrable consent evidence
- `revoked_at TIMESTAMPTZ` — NULL = active consent; non-NULL = revoked
- FK to `patients(id)` intentionally deferred to Phase 2 migration (circular dependency prevention)

**Audit triggers (SEC-02, D-13, D-14):**
- `audit_clinics_changes()`: SECURITY DEFINER trigger for `public.clinics` — uses `NEW.id` as `tenant_id` (clinics.id IS the tenant identifier)
- `audit_table_changes()`: SECURITY DEFINER trigger for `public.users` — uses `NEW.tenant_id` column
- Both fire AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW
- SECURITY DEFINER required: `audit_logs` has no INSERT RLS policy (writes only through privileged code paths)

**Audit partitions (Pitfall 7):**
- `audit_logs_2026_07`: FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
- `audit_logs_2026_08`: FOR VALUES FROM ('2026-08-01') TO ('2026-09-01')

**`20260604000400_rls_phase1.sql`**

**invitations RLS:**
- `invitations_tenant_read` FOR SELECT: `tenant_id = get_my_tenant_id()`
- `invitations_admin_write` FOR ALL: USING + WITH CHECK both require `get_my_role() IN ('admin','superadmin')` AND tenant scope

**patient_consents RLS:**
- `patient_consents_tenant_read` FOR SELECT: `tenant_id = get_my_tenant_id()`
- No INSERT/UPDATE/DELETE policy — writes via service role in Server Actions (same pattern as audit_logs)

**users_masked view (SEC-01, D-11, D-12):**
- SECURITY INVOKER (PostgreSQL default) — underlying `users` RLS applies; view only transforms column values
- Email masking logic: `get_my_role() IN ('admin','dentist','superadmin')` → full email; otherwise `jo***@gmail.com` format
- Handles short local-parts (position('@') ≤ 2) with `'***' || @domain` fallback

## Checkpoint State

**Task 3 [BLOCKING]** — `npx supabase db push` + post-push SQL verification + type regeneration — paused awaiting human action.

The three Phase 1 migration files are authored and locally committed. They must be pushed to the live Supabase project before TypeScript types can be regenerated and downstream plans can proceed.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Architecture Notes

The plan correctly notes that `public.clinics` has no `tenant_id` column (its `id` IS the tenant identifier). This required two separate trigger functions rather than the single `audit_table_changes()` function shown in the research patterns. The `audit_clinics_changes()` variant was created as specified in the plan's exact SQL.

## Known Stubs

None — these are pure SQL migration files. No data flows to UI from this plan.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers. All six STRIDE mitigations (T-01-06 through T-01-11) were implemented:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-01-06 | CREATE OR REPLACE for both SECURITY DEFINER functions in rename migration |
| T-01-07 | `invitations_admin_write` WITH CHECK requires get_my_role() IN ('admin','superadmin') + tenant scope |
| T-01-08 | `users_masked` view masks email for receptionist/patient via get_my_role() CASE |
| T-01-09 | `audit_clinics` + `audit_users` triggers fire AFTER INSERT/UPDATE/DELETE via SECURITY DEFINER |
| T-01-10 | `audit_logs_2026_07` + `audit_logs_2026_08` partitions created proactively |
| T-01-11 | `idx_clinics_cnpj` partial unique index WHERE cnpj IS NOT NULL |

## Self-Check: PASSED

### Files verified to exist:

- supabase/migrations/20260604000200_rename_tenants_to_clinics.sql — FOUND
- supabase/migrations/20260604000300_clinics_users_phase1.sql — FOUND
- supabase/migrations/20260604000400_rls_phase1.sql — FOUND
- vitest.config.ts — FOUND
- src/__tests__/migrations/schema.test.ts — FOUND

### Commits verified:

- c6a5217 — chore(01-01): install vitest + create migration test scaffold (RED)
- 2836015 — feat(01-01): rename migration tenants→clinics + Phase 1 columns
- 20e35f2 — feat(01-01): add Phase 1 tables + audit trigger + partitions + masked view migrations
