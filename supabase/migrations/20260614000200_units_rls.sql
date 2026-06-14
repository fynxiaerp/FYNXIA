-- =============================================================================
-- Migration: 20260614000200_units_rls.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: Row Level Security for the `units` table.
--          Tenant isolation via clinic_id = get_my_tenant_id(); write gated to
--          admin/superadmin (same pattern as financial_categories_admin_write).
-- CLAUDE.md: USING + WITH CHECK both present on all write policies.
-- Pattern from 07-RESEARCH.md §"Existing RLS pattern to follow":
--   units_tenant_read  — SELECT: all roles in the rede see all units.
--   units_admin_write  — ALL:    clinic_id check + role check USING + WITH CHECK.
-- =============================================================================

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- All authenticated members of the rede can read its units (SYS-01 + SYS-05 listing)
CREATE POLICY "units_tenant_read" ON public.units
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Only admin/superadmin can create, update, or delete units (SYS-01 write gate)
-- BOTH USING and WITH CHECK required (CLAUDE.md: never skip WITH CHECK)
CREATE POLICY "units_admin_write" ON public.units
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
