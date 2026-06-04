-- =============================================================================
-- RLS Verification Script: rls-checks.sql
-- Phase: 00-foundation / Plan 03
-- Run in: Supabase SQL Editor (project jqjwyqlbbuqnrffdnlpp)
-- Purpose: Prove the Phase 0 security invariants are live on the actual database.
--
-- THREAT COVERAGE:
--   T-00-12 (C-1): RLS on users table must not cause stack-depth recursion
--   T-00-13 (C-5): get_my_tenant_id() + get_my_role() must be SECURITY DEFINER
--   T-00-15: Policy bodies must not contain direct FROM users subqueries
--   SEC-07:  Zero bare TIMESTAMP (without time zone) columns in public schema
--   INFRA-06: RLS must be enabled on all 3 core tables
--
-- HOW TO USE:
--   1. Open the Supabase SQL Editor for this project.
--   2. Run each block in order. Record the results in VERIFY.md.
--   3. Expected outcomes are documented in each block below.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- CHECK 1: SECURITY DEFINER function presence (T-00-13 / C-5 / INFRA-07)
-- ---------------------------------------------------------------------------
-- Expected: 2 rows — get_my_tenant_id and get_my_role, BOTH with prosecdef=true.
-- If prosecdef=false on either function, tenant_id/role isolation is NOT enforced
-- by the database — any authenticated user can spoof their own identity.
-- Note: custom_access_token_hook will NOT appear (Supabase FREE plan — hook not registered).
-- ---------------------------------------------------------------------------
SELECT
  proname           AS function_name,
  prosecdef         AS is_security_definer,
  pronargs          AS arg_count
FROM pg_proc
WHERE proname IN ('get_my_tenant_id', 'get_my_role', 'custom_access_token_hook')
ORDER BY proname;

-- EXPECTED RESULT:
--   function_name        | is_security_definer | arg_count
--   ----------------------+--------------------+-----------
--   get_my_role           | true               | 0
--   get_my_tenant_id      | true               | 0
--   (custom_access_token_hook: NOT present — FREE plan, hook not used)


-- ---------------------------------------------------------------------------
-- CHECK 2: Policy inspection — no direct FROM users in policy bodies (T-00-15 / C-1)
-- ---------------------------------------------------------------------------
-- Expected: All policies listed. Manually verify that NO qual or with_check value
-- contains a subquery that directly queries FROM users or FROM public.users.
-- Policies MUST use get_my_tenant_id() or get_my_role() calls — never direct subqueries.
-- If any qual/with_check contains "FROM users", C-1 recursion risk is present.
-- ---------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- EXPECTED RESULT (6 policies):
--   tablename   | policyname                | cmd    | qual (summarized)
--   ------------+---------------------------+--------+------------------
--   audit_logs  | audit_logs_no_delete      | DELETE | false
--   audit_logs  | audit_logs_no_update      | UPDATE | false
--   audit_logs  | audit_logs_tenant_select  | SELECT | tenant_id = get_my_tenant_id() AND get_my_role() IN (...)
--   tenants     | tenants_admin_update      | UPDATE | id = get_my_tenant_id() AND get_my_role() = 'admin'
--   tenants     | tenants_own_record        | SELECT | id = get_my_tenant_id()
--   users       | users_tenant_isolation    | ALL    | tenant_id = get_my_tenant_id()
--
-- PASS CRITERIA: No qual or with_check row contains the literal text "FROM users"


-- ---------------------------------------------------------------------------
-- CHECK 3: C-1 RLS recursion test (T-00-12 / INFRA-06)
-- ---------------------------------------------------------------------------
-- This verifies the live database does NOT enter infinite recursion when an
-- authenticated user queries the users table.
--
-- HOW TO TEST:
--   1. In the SQL Editor, open a new query window.
--   2. Set role to 'authenticated' (simulates a logged-in user with no JWT):
--        SET LOCAL ROLE authenticated;
--        SELECT * FROM public.users LIMIT 1;
--   3. Expected: Either returns 0 rows (no users in DB yet) or rows if test users exist.
--   4. FAIL signal: "stack depth limit exceeded" or "ERROR: infinite recursion"
--
-- The query below runs as the current (service) role — it will always return rows.
-- The REAL test requires switching to 'authenticated' role (see instructions above).
-- ---------------------------------------------------------------------------
SELECT
  id,
  tenant_id,
  role,
  email
FROM public.users
LIMIT 1;

-- EXPECTED: 0 rows (fresh project, no users inserted yet) — NOT a stack-depth error.
-- If you see rows, ensure they match the tenant_id returned by get_my_tenant_id()
-- for the authenticated user.


-- ---------------------------------------------------------------------------
-- CHECK 4: SEC-07 — Zero bare TIMESTAMP (without time zone) columns
-- ---------------------------------------------------------------------------
-- Brazil spans UTC-2 to UTC-5. All timestamps must be TIMESTAMPTZ.
-- A bare TIMESTAMP stores local wall-clock time with no zone info — causes
-- ambiguous comparisons, DST bugs, and incorrect audit trail ordering.
-- Expected: 0 rows returned. Any row returned is a SEC-07 violation.
-- ---------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE
  data_type = 'timestamp without time zone'
  AND table_schema = 'public';

-- EXPECTED: 0 rows — all columns in public schema use TIMESTAMPTZ (timestamp with time zone).


-- ---------------------------------------------------------------------------
-- CHECK 5: RLS enablement on all 3 core tables (INFRA-06)
-- ---------------------------------------------------------------------------
-- All three Phase 0 tables must have RLS enabled. If relrowsecurity=false on any
-- table, ALL rows are readable/writable by any authenticated user — catastrophic
-- multi-tenant data leak.
-- Expected: 3 rows — tenants, users, audit_logs (and audit_logs_2026_06 partition).
-- ---------------------------------------------------------------------------
SELECT
  relname       AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE
  relrowsecurity = true
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- EXPECTED: at minimum tenants, users, audit_logs (partition audit_logs_2026_06 also
-- inherits RLS from parent). If fewer than 3 tables listed, RLS is missing on one.


-- ---------------------------------------------------------------------------
-- CHECK 6: REVOKE EXECUTE confirmation — functions not callable by PUBLIC
-- ---------------------------------------------------------------------------
-- get_my_tenant_id() and get_my_role() must NOT be executable by the 'public' role.
-- If execute is granted to public, any authenticated user could call them directly
-- to obtain tenant IDs of other users (information disclosure).
-- Expected: 0 rows returned (no PUBLIC execute grants on these two functions).
-- ---------------------------------------------------------------------------
SELECT
  r.rolname         AS grantee,
  p.proname         AS function_name,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE
  p.proname IN ('get_my_tenant_id', 'get_my_role')
  AND r.rolname = 'public'
ORDER BY p.proname;

-- EXPECTED: can_execute = false for both functions.
-- If can_execute = true, the REVOKE EXECUTE FROM PUBLIC in the migration did not apply.
