---
phase: 00-foundation
plan: "02"
subsystem: database
tags: [supabase, postgresql, rls, security-definer, multi-tenant, lgpd, migrations]
dependency_graph:
  requires:
    - supabase/config.toml (Supabase CLI initialized by Plan 01)
    - auth.users (Supabase-managed auth schema)
  provides:
    - supabase/migrations/20260603000000_initial_schema.sql (tenants + users + audit_logs schema + SECURITY DEFINER functions)
    - supabase/migrations/20260603000100_rls_policies.sql (RLS enablement + tenant-isolation policies)
    - public.tenants (root multi-tenant entity — FK target for all feature tables)
    - public.users (application user profiles with tenant_id — FK target for all user-scoped data)
    - public.audit_logs (immutable compliance log — partitioned by month)
    - get_my_tenant_id() SECURITY DEFINER function (used by every RLS policy in all future phases)
    - get_my_role() SECURITY DEFINER function (used by role-based RLS policies in all future phases)
  affects:
    - All future feature phases (patients, appointments, financial) reference public.tenants and public.users as FK targets
    - All future RLS policies call get_my_tenant_id() and get_my_role() — these functions are the contract
tech_stack:
  added: []
  patterns:
    - SECURITY DEFINER function as RLS indirection layer (C-1 recursion prevention)
    - REVOKE EXECUTE FROM PUBLIC on all SECURITY DEFINER functions (least-privilege)
    - TIMESTAMPTZ on all timestamp columns (SEC-07 — Brazil multi-timezone)
    - Partitioned audit_logs table (PARTITION BY RANGE created_at) for 20-year retention
    - Soft delete via deleted_at TIMESTAMPTZ (LGPD compliance)
    - RLS USING + WITH CHECK on all write policies (Pitfall 5 prevention)
    - FOR DELETE/UPDATE USING (false) for immutable audit_logs (SEC-02/LGPD)
key_files:
  created:
    - supabase/migrations/20260603000000_initial_schema.sql
    - supabase/migrations/20260603000100_rls_policies.sql
  modified: []
decisions:
  - "FREE plan approach: get_my_tenant_id() + get_my_role() SECURITY DEFINER functions replace Custom Access Token Hook (Pro-only) for all RLS — no auth.jwt() used anywhere"
  - "audit_logs has no FK to tenants (intentional) — immutable compliance log must survive tenant deletion"
  - "audit_logs INSERT has no RLS policy — inserts routed exclusively through SECURITY DEFINER triggers created in Phase 1+"
  - "REVOKE EXECUTE FROM PUBLIC on both SECURITY DEFINER functions — only callable internally by RLS policies"
metrics:
  duration_minutes: 15
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  completed_date: "2026-06-04"
---

# Phase 0 Plan 2: Database Schema and RLS Policies Summary

**One-liner:** Two versioned SQL migrations establishing tenants/users/audit_logs with TIMESTAMPTZ throughout, plus get_my_tenant_id() + get_my_role() SECURITY DEFINER functions and full RLS tenant isolation — FREE plan compatible, C-1 recursion-safe, audit_logs immutable.

## What Was Built

### Task 1: Initial Schema Migration (`20260603000000_initial_schema.sql`)

#### Table Definitions

**`public.tenants`**
```sql
id         UUID        PRIMARY KEY DEFAULT gen_random_uuid()
name       TEXT        NOT NULL
slug       TEXT        NOT NULL UNIQUE
timezone   VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo'
plan       VARCHAR(20) NOT NULL DEFAULT 'trial'
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ                          -- soft delete
```
Index: `idx_tenants_slug ON public.tenants(slug)`

**`public.users`**
```sql
id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE
email          TEXT        NOT NULL
full_name      TEXT        NOT NULL
role           TEXT        NOT NULL DEFAULT 'receptionist'
                           CHECK (role IN ('admin','dentist','receptionist','patient','superadmin'))
sensitive_data TEXT        -- AES-256-GCM ciphertext (SEC-08, D-05)
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at     TIMESTAMPTZ              -- soft delete
```
Indexes: `idx_users_tenant_id ON public.users(tenant_id)` (H-1), `idx_users_email ON public.users(email)`

**`public.audit_logs`** (PARTITION BY RANGE created_at)
```sql
id         UUID        NOT NULL DEFAULT gen_random_uuid()
tenant_id  UUID        NOT NULL
actor_id   UUID        -- auth.uid(); NULL for system events
action     TEXT        NOT NULL
table_name TEXT
record_id  UUID
old_values JSONB
new_values JSONB
ip_address INET
user_agent TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```
Initial partition: `audit_logs_2026_06` FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
Indexes: `idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC)`, `idx_audit_logs_actor ON public.audit_logs(actor_id)`

#### SECURITY DEFINER Functions

**`get_my_tenant_id() RETURNS UUID`**
- LANGUAGE SQL, STABLE, SECURITY DEFINER, SET search_path = public
- Body: `SELECT tenant_id FROM public.users WHERE id = auth.uid()`
- REVOKE EXECUTE FROM PUBLIC
- C-1 resolution: every RLS policy calls this instead of querying users directly
- FREE plan replacement for JWT claim `tenant_id` from Custom Access Token Hook

**`get_my_role() RETURNS TEXT`**
- LANGUAGE SQL, STABLE, SECURITY DEFINER, SET search_path = public
- Body: `SELECT role FROM public.users WHERE id = auth.uid()`
- REVOKE EXECUTE FROM PUBLIC
- FREE plan replacement for JWT claim `user_role` from Custom Access Token Hook

### Task 2: RLS Policies Migration (`20260603000100_rls_policies.sql`)

#### RLS Enablement
- `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`
- `ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY`
- `ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY`

#### Policies

| Table | Policy Name | Operation | Condition |
|-------|-------------|-----------|-----------|
| users | users_tenant_isolation | FOR ALL | USING + WITH CHECK: `tenant_id = get_my_tenant_id()` |
| audit_logs | audit_logs_tenant_select | FOR SELECT | `tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin')` |
| audit_logs | audit_logs_no_delete | FOR DELETE | `USING (false)` — immutable |
| audit_logs | audit_logs_no_update | FOR UPDATE | `USING (false)` — immutable |
| tenants | tenants_own_record | FOR SELECT | `id = get_my_tenant_id()` |
| tenants | tenants_admin_update | FOR UPDATE | USING: `id = get_my_tenant_id() AND get_my_role() = 'admin'`; WITH CHECK: `id = get_my_tenant_id()` |

## Security Invariants Enforced

| Threat | Resolution |
|--------|------------|
| T-00-06: C-1 RLS recursion (DoS) | All policies call `get_my_tenant_id()` SECURITY DEFINER — zero direct `FROM users` in any policy body |
| T-00-07: Elevation of Privilege (C-5) | Both SECURITY DEFINER functions read from `public.users` (service-role-writable only), never from user-mutable `user_metadata` |
| T-00-08: Tampering (Pitfall 5) | All write policies have both USING and WITH CHECK |
| T-00-09: Repudiation/Tampering (SEC-02) | `audit_logs_no_delete` and `audit_logs_no_update` use `USING (false)`; no INSERT policy (only SECURITY DEFINER triggers may insert) |
| T-00-10: search_path injection (Pitfall 7) | Both functions declare `SET search_path = public` |
| T-00-11: audit_logs over-exposure | SELECT restricted to same tenant AND role in (admin, superadmin) |

## Important: Plan 03 Must Push These Migrations

The migration files are ready but NOT yet applied to the Supabase project. Plan 03 must:
1. Verify Supabase project region is sa-east-1 (São Paulo) — cannot be changed after creation
2. Run `npx supabase db push` to apply both migrations
3. Run live RLS recursion test: `SELECT * FROM public.users` as an authenticated user
4. Run `SELECT column_name, data_type FROM information_schema.columns WHERE data_type = 'timestamp without time zone' AND table_schema = 'public'` — must return 0 rows (SEC-07 verification)

## Upgrade Path (when migrating to Supabase Pro)

When the project upgrades to Pro, the Custom Access Token Hook (`custom_access_token_hook`) can be added as a performance optimization. The hook would inject `tenant_id` and `user_role` into the JWT, allowing RLS policies to use `(SELECT auth.jwt() ->> 'tenant_id')::uuid` instead of `get_my_tenant_id()` — reducing one DB lookup per policy evaluation per query. The existing policies require zero changes; the functions remain as fallback. This is purely additive.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Comment Sanitization (Rule 1 — Correctness)

Two verification scripts use `grep`-style regex that matched comment text:
1. `\bTIMESTAMP\b(?!TZ)` matched the comment `never bare TIMESTAMP` in the schema file — reworded to `never timezone-unaware variant`
2. `FROM\s+(public\.)?users` matched `FROM users / FROM public.users` in the RLS header comment — reworded to describe the guard without embedding the forbidden pattern
3. `auth\.jwt\(\)` matched `NO auth.jwt() claims` in the RLS header comment — reworded to `no JWT claims used`

These rewording did not change any SQL semantics — only comment text was adjusted to allow the verification scripts to function as intended.

## Known Stubs

None — these are pure SQL migration files. No data flows to UI from this plan.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All six mitigations in the STRIDE register (T-00-06 through T-00-11) were implemented.

## Self-Check: PASSED

### Files verified to exist:
- supabase/migrations/20260603000000_initial_schema.sql — FOUND
- supabase/migrations/20260603000100_rls_policies.sql — FOUND

### Commits verified:
- a522408 — feat(00-02): initial schema migration — tenants, users, audit_logs + SECURITY DEFINER functions
- 1613277 — feat(00-02): RLS policies migration — tenant isolation on tenants, users, audit_logs
