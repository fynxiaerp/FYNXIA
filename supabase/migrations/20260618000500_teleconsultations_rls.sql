-- =============================================================================
-- Migration: 20260618000500_teleconsultations_rls.sql
-- Phase: 12-receitu-rio-teleodontologia / Plan 03
-- Purpose: RLS policies for teleodontologia tables:
--   - teleconsultations: tenant-scoped read; clinical-role write (admin/superadmin/dentist)
--   - soap_records:      tenant-scoped read; clinical-role write (admin/superadmin/dentist)
-- RLS pattern: USING + WITH CHECK (T-12-12 cross-tenant disclosure; T-12-13 elevation)
-- Helpers: get_my_tenant_id() → clinic UUID; get_my_role() → role TEXT
-- =============================================================================

-- ============ teleconsultations ============
ALTER TABLE public.teleconsultations ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member can read their own clinic's teleconsultations
CREATE POLICY "teleconsultations_tenant_read" ON public.teleconsultations
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- ALL (INSERT/UPDATE/DELETE): only clinical roles (dentist, admin, superadmin) may write
-- USING + WITH CHECK both enforce tenant + role gate (T-12-12, T-12-13 mitigations)
CREATE POLICY "teleconsultations_clinical_write" ON public.teleconsultations
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );

-- ============ soap_records ============
ALTER TABLE public.soap_records ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member can read their own clinic's SOAP records
CREATE POLICY "soap_records_tenant_read" ON public.soap_records
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- ALL (INSERT/UPDATE/DELETE): only clinical roles may write SOAP notes
-- USING + WITH CHECK both enforce tenant + role gate (T-12-12, T-12-13 mitigations)
CREATE POLICY "soap_records_clinical_write" ON public.soap_records
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );
