-- =============================================================================
-- Migration: 20260621000600_phase16_rls.sql
-- Phase: 16-contas-a-pagar-conciliacao-tributos / Plan 03 — Task 3
-- Purpose: Row Level Security for ALL Phase 16 tables.
-- Pattern: mirrors 20260620000400_faturamento_rls.sql (ENABLE RLS +
--          tenant_read SELECT + role_write FOR ALL with USING+WITH CHECK)
--
-- D-23 write role matrix (Open Question 3 resolved — proxy.ts confirms no
--   distinct 'financeiro' role in RBAC enum):
--   financeiro write = admin/superadmin only
--   auditor/dpo/socio: read-only via SELECT policy — no write policy applies to them → write denied
--   recepção/dentista: blocked at proxy module gate (proxy.ts MODULE_PERMISSIONS)
--
-- T-16-06: cross-tenant read blocked by USING (clinic_id = get_my_tenant_id())
-- T-16-07: read-only roles (auditor/dpo/socio) denied write by absence of write policy
-- T-16-09: tax tables (inss_tax_tables, irrf_tax_tables, iss_tax_tables) — no clinic_id;
--          SELECT USING (true) for any authenticated user; NO tenant write policy —
--          mutation only by service role (migrations/seed bypasses RLS).
--
-- Tables covered (15 total):
--   Tenant-scoped (12):
--     From 20260621000100: suppliers, payables, payable_installments, recorrente_templates
--     From 20260621000200: bank_statements, statement_lines
--     From 20260621000300: professional_payouts, payout_items, rpa_records, reinf_events,
--                          unit_rpa_counters, competencia_fechamentos
--   Global reference / no clinic_id (3):
--     From 20260621000400: inss_tax_tables, irrf_tax_tables, iss_tax_tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_tenant_read" ON public.suppliers
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "suppliers_admin_write" ON public.suppliers
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
-- payables
-- ---------------------------------------------------------------------------
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payables_tenant_read" ON public.payables
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "payables_admin_write" ON public.payables
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
-- payable_installments
-- ---------------------------------------------------------------------------
ALTER TABLE public.payable_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payable_installments_tenant_read" ON public.payable_installments
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "payable_installments_admin_write" ON public.payable_installments
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
-- recorrente_templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.recorrente_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recorrente_templates_tenant_read" ON public.recorrente_templates
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "recorrente_templates_admin_write" ON public.recorrente_templates
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
-- bank_statements
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statements_tenant_read" ON public.bank_statements
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "bank_statements_admin_write" ON public.bank_statements
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
-- statement_lines
-- ---------------------------------------------------------------------------
ALTER TABLE public.statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statement_lines_tenant_read" ON public.statement_lines
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "statement_lines_admin_write" ON public.statement_lines
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
-- professional_payouts
-- ---------------------------------------------------------------------------
ALTER TABLE public.professional_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professional_payouts_tenant_read" ON public.professional_payouts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "professional_payouts_admin_write" ON public.professional_payouts
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
-- payout_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_items_tenant_read" ON public.payout_items
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "payout_items_admin_write" ON public.payout_items
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
-- rpa_records
-- pdf_storage_path is excluded from client reads via Server Action (never SELECTed);
-- RLS here provides the tenant-isolation backstop (T-16-06).
-- ---------------------------------------------------------------------------
ALTER TABLE public.rpa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpa_records_tenant_read" ON public.rpa_records
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "rpa_records_admin_write" ON public.rpa_records
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
-- reinf_events
-- payload JSONB may contain CNPJ/CPF (PII); RLS is the isolation backstop (T-16-06).
-- ---------------------------------------------------------------------------
ALTER TABLE public.reinf_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reinf_events_tenant_read" ON public.reinf_events
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "reinf_events_admin_write" ON public.reinf_events
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
-- unit_rpa_counters
-- Counter managed via next_rpa_number() SECURITY DEFINER; direct writes gated to admin.
-- Mirrors unit_os_counters RLS pattern from 20260620000400_faturamento_rls.sql.
-- ---------------------------------------------------------------------------
ALTER TABLE public.unit_rpa_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_rpa_counters_tenant_read" ON public.unit_rpa_counters
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "unit_rpa_counters_admin_write" ON public.unit_rpa_counters
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
-- competencia_fechamentos
-- ---------------------------------------------------------------------------
ALTER TABLE public.competencia_fechamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competencia_fechamentos_tenant_read" ON public.competencia_fechamentos
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "competencia_fechamentos_admin_write" ON public.competencia_fechamentos
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
-- inss_tax_tables — global reference data, no clinic_id (D-17, T-16-09)
-- tax tables are system reference; mutated only by migration/seed (service role bypasses RLS).
-- Authenticated tenants get SELECT only; no INSERT/UPDATE/DELETE policy for authenticated
-- users means those operations are denied (RLS default-deny).
-- ---------------------------------------------------------------------------
ALTER TABLE public.inss_tax_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inss_tax_tables_public_read" ON public.inss_tax_tables
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- irrf_tax_tables — global reference data, no clinic_id (D-17, T-16-09)
-- tax tables are system reference; mutated only by migration/seed (service role bypasses RLS).
-- ---------------------------------------------------------------------------
ALTER TABLE public.irrf_tax_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "irrf_tax_tables_public_read" ON public.irrf_tax_tables
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- iss_tax_tables — global reference data, no clinic_id (D-17, T-16-09)
-- tax tables are system reference; mutated only by migration/seed (service role bypasses RLS).
-- ---------------------------------------------------------------------------
ALTER TABLE public.iss_tax_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iss_tax_tables_public_read" ON public.iss_tax_tables
  FOR SELECT USING (true);

-- =============================================================================
-- RLS Summary — Phase 16 (15 tables total)
-- =============================================================================
-- Tenant-scoped tables (12) — each has:
--   ENABLE ROW LEVEL SECURITY
--   SELECT policy: USING (clinic_id = get_my_tenant_id())
--   ALL policy:    USING + WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'))
--
--   1.  suppliers
--   2.  payables
--   3.  payable_installments
--   4.  recorrente_templates
--   5.  bank_statements
--   6.  statement_lines
--   7.  professional_payouts
--   8.  payout_items
--   9.  rpa_records
--   10. reinf_events
--   11. unit_rpa_counters
--   12. competencia_fechamentos
--
-- Global reference tables (3) — each has:
--   ENABLE ROW LEVEL SECURITY
--   SELECT policy: USING (true)  — any authenticated user reads
--   NO write policy for authenticated  — mutation only via service role (migrations/seed)
--
--   13. inss_tax_tables
--   14. irrf_tax_tables
--   15. iss_tax_tables
-- =============================================================================
