-- Phase 11 Plan 03: resources RLS (RES-01 Access Control, T-11-11, T-11-12)
-- T-11-11 Spoofing: clinic_id = get_my_tenant_id() in USING + WITH CHECK.
-- T-11-12 Elevation of Privilege: write policy gated to admin + superadmin only.
-- Pattern: mirrors ocr_extractions RLS with separate SELECT + ALL-write policies.

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- All authenticated clinic members can read their clinic's resources
CREATE POLICY "resources_tenant_read" ON public.resources
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Write operations (INSERT + UPDATE + DELETE): admin/superadmin only (T-11-12)
CREATE POLICY "resources_admin_write" ON public.resources
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
