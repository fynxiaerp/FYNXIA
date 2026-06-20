-- =============================================================================
-- Migration: 20260620000400_faturamento_rls.sql
-- Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 03
-- Purpose: Row Level Security for ALL new Phase 15 faturamento tables.
-- Pattern: mirrors 20260619001200_financial_cadastros_rls.sql
--          (ENABLE RLS + tenant_read SELECT + role_write FOR ALL with USING+WITH CHECK)
--
-- D-18 role write matrix:
--   OS tables (service_orders, service_order_items, appointment_procedures):
--     write role IN ('dentist', 'receptionist', 'admin', 'superadmin')
--     dentist creates rascunho on conclude; finer faturar gate is in Server Action.
--   Cadastro/fiscal tables (insurers, insurer_prices, unit_fiscal_config, glosa_motivos,
--     nfse_records, tiss_lotes, tiss_guides, tiss_guide_items, unit_os_counters):
--     write role IN ('admin', 'superadmin')
--
-- T-14-02 pattern: BOTH USING and WITH CHECK on every write policy (CLAUDE.md).
-- T-15-07: clinic_id = get_my_tenant_id() on SELECT blocks cross-tenant read.
-- T-15-08: glosa_motivos WITH CHECK requires clinic_id = get_my_tenant_id()
--           so NULL-clinic ANS system rows are immutable by tenant users.
--
-- Tables covered (13 total):
--   From 20260620000100: services, insurer_prices, unit_fiscal_config, glosa_motivos
--   From 20260620000200: insurers, appointment_procedures, service_orders,
--                        service_order_items, nfse_records, unit_os_counters
--   From 20260620000300: tiss_lotes, tiss_guides, tiss_guide_items
-- =============================================================================

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_tenant_read" ON public.services
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "services_admin_write" ON public.services
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- insurer_prices
-- ---------------------------------------------------------------------------
ALTER TABLE public.insurer_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurer_prices_tenant_read" ON public.insurer_prices
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "insurer_prices_admin_write" ON public.insurer_prices
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- unit_fiscal_config
-- ---------------------------------------------------------------------------
ALTER TABLE public.unit_fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_fiscal_config_tenant_read" ON public.unit_fiscal_config
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "unit_fiscal_config_admin_write" ON public.unit_fiscal_config
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- glosa_motivos
-- SELECT: clinic_id IS NULL OR clinic_id = get_my_tenant_id()
--   NULL rows = shared ANS seed (public reference data — T-15-05 accepted)
-- WRITE WITH CHECK: requires clinic_id = get_my_tenant_id()
--   Prevents tenants from editing NULL-clinic system rows (T-15-08).
-- ---------------------------------------------------------------------------
ALTER TABLE public.glosa_motivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "glosa_motivos_tenant_read" ON public.glosa_motivos
  FOR SELECT USING (clinic_id IS NULL OR clinic_id = get_my_tenant_id());

CREATE POLICY "glosa_motivos_admin_write" ON public.glosa_motivos
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- insurers
-- ---------------------------------------------------------------------------
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurers_tenant_read" ON public.insurers
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "insurers_admin_write" ON public.insurers
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- appointment_procedures
-- write: dentist (records procedures on conclude) + receptionist/admin/superadmin
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointment_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_procedures_tenant_read" ON public.appointment_procedures
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "appointment_procedures_role_write" ON public.appointment_procedures
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- service_orders
-- write: dentist (creates rascunho) + receptionist/admin/superadmin (faturar/cancel)
-- Finer faturar gate (rascunho→faturada state machine) enforced in Server Action.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders_tenant_read" ON public.service_orders
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "service_orders_role_write" ON public.service_orders
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- service_order_items
-- write: same matrix as service_orders (items are written at same time as OS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_order_items_tenant_read" ON public.service_order_items
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "service_order_items_role_write" ON public.service_order_items
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- nfse_records
-- write: admin/superadmin only (fiscal emission is admin-level action)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nfse_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_records_tenant_read" ON public.nfse_records
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "nfse_records_admin_write" ON public.nfse_records
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- unit_os_counters
-- write: admin/superadmin only (counter managed via next_os_number() SECURITY DEFINER)
-- Direct writes guarded by admin; Server Action calls the function, not this table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.unit_os_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_os_counters_tenant_read" ON public.unit_os_counters
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "unit_os_counters_admin_write" ON public.unit_os_counters
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- tiss_lotes
-- ---------------------------------------------------------------------------
ALTER TABLE public.tiss_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_lotes_tenant_read" ON public.tiss_lotes
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "tiss_lotes_admin_write" ON public.tiss_lotes
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- tiss_guides
-- ---------------------------------------------------------------------------
ALTER TABLE public.tiss_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_guides_tenant_read" ON public.tiss_guides
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "tiss_guides_admin_write" ON public.tiss_guides
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- tiss_guide_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.tiss_guide_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_guide_items_tenant_read" ON public.tiss_guide_items
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "tiss_guide_items_admin_write" ON public.tiss_guide_items
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
