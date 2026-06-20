-- =============================================================================
-- Migration: 20260619001200_financial_cadastros_rls.sql
-- Phase: 14-financeiro-cadastros-base / Plan 02
-- Purpose: Row Level Security for the 3 new cadastro-de-rede tables.
-- Pattern: mirrors 20260614000200_units_rls.sql (clinic_id isolation, admin write)
-- FCAD-01: RLS on chart_of_accounts, cost_centers, bank_accounts
-- T-14-01: SELECT gated by clinic_id = get_my_tenant_id() (no cross-tenant read)
-- T-14-02: ALL (INSERT/UPDATE/DELETE) gated by role IN ('admin','superadmin')
--          BOTH USING and WITH CHECK required (CLAUDE.md: never skip WITH CHECK)
-- NOTE:    financial_transactions and financial_categories are NOT touched here.
--          Their existing policies already cover the new columns added in 001100
--          (new columns are on the same row; existing WITH CHECK applies).
-- NOTE:    Read policy intentionally does NOT filter by ativo — admins must see
--          inactive accounts in the cadastro tree (RESEARCH Code Example).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chart_of_accounts RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_of_accounts_tenant_read" ON public.chart_of_accounts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "chart_of_accounts_admin_write" ON public.chart_of_accounts
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
-- cost_centers RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_centers_tenant_read" ON public.cost_centers
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "cost_centers_admin_write" ON public.cost_centers
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
-- bank_accounts RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_tenant_read" ON public.bank_accounts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "bank_accounts_admin_write" ON public.bank_accounts
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
