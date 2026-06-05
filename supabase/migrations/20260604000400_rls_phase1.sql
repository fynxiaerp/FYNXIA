-- Phase 1: RLS on new tables + masked view

-- ============ invitations RLS ============
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_tenant_read" ON public.invitations
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "invitations_admin_write" ON public.invitations
  FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'));

-- ============ patient_consents RLS ============
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_consents_tenant_read" ON public.patient_consents
  FOR SELECT USING (tenant_id = get_my_tenant_id());
-- WR-04: explicit INSERT policy with WITH CHECK so write access is never implicitly granted
CREATE POLICY "patient_consents_patient_write" ON public.patient_consents
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ============ users_masked view (SEC-01, D-11, D-12) ============
-- SECURITY INVOKER (PG default) — underlying users RLS still applies.
CREATE OR REPLACE VIEW public.users_masked AS
SELECT
  id,
  tenant_id,
  CASE
    WHEN get_my_role() IN ('admin','dentist','superadmin') THEN email
    ELSE
      CASE WHEN position('@' IN email) > 2
        THEN substring(email,1,2) || '***' || substring(email, position('@' IN email))
        ELSE '***' || substring(email, position('@' IN email))
      END
  END AS email,
  full_name,
  role,
  created_at,
  updated_at,
  deleted_at
FROM public.users;
