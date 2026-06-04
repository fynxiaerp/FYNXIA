-- =============================================================================
-- Migration: 20260603000100_rls_policies.sql
-- Phase: 00-foundation / Plan 02
-- Purpose: Enable RLS + tenant isolation policies on tenants, users, audit_logs
-- FREE plan approach (D-11): all policies use get_my_tenant_id() + get_my_role()
--   SECURITY DEFINER functions — no JWT claims used, no Custom Access Token Hook required.
-- C-1 guard: no policy body queries the users table directly (SECURITY DEFINER functions handle it)
-- Pitfall 5: every write policy has both USING and WITH CHECK
-- SEC-02 / LGPD: audit_logs is immutable (DELETE + UPDATE denied via USING (false))
-- =============================================================================

-- ---------------------------------------------------------------------------
-- USERS TABLE
-- C-1: SECURITY DEFINER function used — no direct subquery against users table
-- Pitfall 5: both USING and WITH CHECK present on the write policy
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_tenant_isolation" ON public.users
  FOR ALL
  USING (
    tenant_id = get_my_tenant_id()
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
  );

-- ---------------------------------------------------------------------------
-- AUDIT_LOGS TABLE
-- SELECT: restricted to same tenant, admin/superadmin roles only
-- DELETE: denied unconditionally — immutable compliance log (LGPD + CFO Lei 13.787)
-- UPDATE: denied unconditionally — immutable compliance log
-- INSERT: no policy — inserts come only from SECURITY DEFINER triggers (Phase 1+)
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  FOR DELETE USING (false);

CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE USING (false);

-- ---------------------------------------------------------------------------
-- TENANTS TABLE
-- SELECT: tenant may read its own record
-- UPDATE: only admin role may update; both USING and WITH CHECK enforce tenant scope
-- INSERT: no policy — tenant creation handled by service-role (onboarding, Phase 1)
-- DELETE: no policy — soft delete via deleted_at; hard delete is service-role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_own_record" ON public.tenants
  FOR SELECT
  USING (
    id = get_my_tenant_id()
  );

CREATE POLICY "tenants_admin_update" ON public.tenants
  FOR UPDATE
  USING (
    id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  )
  WITH CHECK (
    id = get_my_tenant_id()
    AND get_my_role() = 'admin'   -- re-assert role on the proposed new row too
  );
