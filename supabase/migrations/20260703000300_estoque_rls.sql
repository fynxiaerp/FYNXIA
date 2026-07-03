-- =============================================================================
-- Migration: 20260703000300_estoque_rls.sql
-- Phase: 17-estoque-materiais / Plan 02
-- Purpose: Row Level Security for all 6 Phase 17 Estoque & Materiais tables.
-- Pattern: mirrors 20260621000600_phase16_rls.sql (ENABLE RLS +
--          tenant_read SELECT + admin_write FOR ALL with USING+WITH CHECK)
--
-- Requirements: EST-01, EST-02, EST-03
--
-- Write role matrix (Pitfall 8 / Open Question 1 resolved — role_expansion.sql confirmado):
--   Enum de roles confirmado: admin, dentist, receptionist, patient, superadmin, dpo, auditor,
--   socio, ti, implantacao, aluno — 11 valores. Escrita restrita a admin/superadmin.
--
-- T-17-03 (Information Disclosure): USING (clinic_id = get_my_tenant_id()) em todas as tabelas.
-- T-17-04 (Elevation of Privilege): stock_draws + stock_alerts SEM política INSERT/UPDATE
--          para authenticated — escrita SOMENTE via createAdminClient (service role) nas
--          Server Actions de procedimento e cron (mitigação explícita do plan).
--
-- Tables covered (6):
--   admin_write (READ + WRITE authenticated): products, product_batches, stock_entries,
--                                             service_material_templates
--   read-only (authenticated): stock_draws, stock_alerts
-- =============================================================================

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_tenant_read" ON public.products
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "products_admin_write" ON public.products
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
-- product_batches
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_batches_tenant_read" ON public.product_batches
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "product_batches_admin_write" ON public.product_batches
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
-- stock_entries
-- ---------------------------------------------------------------------------
-- D-18: escrita apenas por admin/superadmin (enum de roles verificado em role_expansion.sql).
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_entries_tenant_read" ON public.stock_entries
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "stock_entries_admin_write" ON public.stock_entries
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
-- stock_draws — READ-ONLY para authenticated (T-17-04)
-- ---------------------------------------------------------------------------
-- Escrita via createAdminClient nas Server Actions de procedimento (drawMaterialsForProcedures)
-- e baixa manual. Authenticated nunca grava diretamente — sem política INSERT/UPDATE.
-- D-09: saldo negativo permitido; atendimento jamais bloqueado por falta de estoque.
ALTER TABLE public.stock_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_draws_tenant_read" ON public.stock_draws
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- INTENCIONAL: sem política de escrita para authenticated.
-- Escrita exclusivamente via service role (createAdminClient) nas Server Actions.

-- ---------------------------------------------------------------------------
-- service_material_templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_material_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_material_templates_tenant_read" ON public.service_material_templates
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "service_material_templates_admin_write" ON public.service_material_templates
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
-- stock_alerts — READ-ONLY para authenticated (T-17-04)
-- ---------------------------------------------------------------------------
-- Gerados pelo cron /api/cron/estoque-validade (D-16) e pelo agente de compras L2 (D-14).
-- Ambos usam createAdminClient — sem sessão de usuário authenticated no caminho de escrita.
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_alerts_tenant_read" ON public.stock_alerts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- INTENCIONAL: sem política de escrita para authenticated.
-- Escrita exclusivamente via service role (createAdminClient) no cron e no agente.
