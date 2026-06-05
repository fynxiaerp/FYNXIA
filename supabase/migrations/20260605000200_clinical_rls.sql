-- Phase 2: RLS policies for clinical tables

-- ============ patients ============
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_tenant_read" ON public.patients
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "patients_staff_write" ON public.patients
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin','dentist','receptionist','superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin','dentist','receptionist','superadmin'));

-- ============ appointments ============
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_tenant_read" ON public.appointments
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "appointments_staff_write" ON public.appointments
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin','dentist','receptionist','superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin','dentist','receptionist','superadmin'));

-- ============ medical_records (CLINIC-05) — dentista/admin escrevem ============
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medical_records_tenant_read" ON public.medical_records
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "medical_records_clinical_write" ON public.medical_records
  FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','dentist','superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','dentist','superadmin'));

-- ============ dental_records (CLINIC-06, D-15, Pitfall 4) — somente admin/dentist escrevem ============
ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dental_records_tenant_read" ON public.dental_records
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "dental_records_clinical_write" ON public.dental_records
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','dentist'));

-- ============ anamneses (CLINIC-08) — leitura por tenant; escrita presencial por staff ============
-- O fluxo público (token) insere via service role na Server Action (sem sessão) — padrão patient_consents.
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anamneses_tenant_read" ON public.anamneses
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "anamneses_staff_insert" ON public.anamneses
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id()
              AND get_my_role() IN ('admin','dentist','receptionist','superadmin'));
