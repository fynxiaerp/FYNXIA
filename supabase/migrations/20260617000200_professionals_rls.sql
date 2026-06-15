-- =============================================================================
-- Migration: 20260617000200_professionals_rls.sql
-- Phase: 11-profissionais-recursos / Plan 02
-- Purpose: RLS policies for professionals, professional_availability,
--          and professional_availability_exceptions (T-11-05, T-11-06).
--
-- Policy pattern (mirrors 20260605000200_clinical_rls.sql):
--   SELECT: any tenant member reads their clinic's data (clinic_id = get_my_tenant_id())
--   ALL:    admin/superadmin only — USING + WITH CHECK both required (CLAUDE.md)
--
-- CRITICAL: this file does NOT touch the appointments table or its GIST.
-- =============================================================================

-- ============ professionals ============
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Tenant members read their clinic's professionals
CREATE POLICY "professionals_tenant_read" ON public.professionals
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Admin/superadmin write (T-11-05, T-11-06): USING + WITH CHECK (CLAUDE.md mandate)
CREATE POLICY "professionals_admin_write" ON public.professionals
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ============ professional_availability ============
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

-- Tenant members read availability windows for their clinic's professionals
CREATE POLICY "professional_availability_tenant_read" ON public.professional_availability
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Admin/superadmin write
CREATE POLICY "professional_availability_admin_write" ON public.professional_availability
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ============ professional_availability_exceptions ============
ALTER TABLE public.professional_availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Tenant members read exceptions for their clinic's professionals
CREATE POLICY "professional_availability_exceptions_tenant_read" ON public.professional_availability_exceptions
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Admin/superadmin write
CREATE POLICY "professional_availability_exceptions_admin_write" ON public.professional_availability_exceptions
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
