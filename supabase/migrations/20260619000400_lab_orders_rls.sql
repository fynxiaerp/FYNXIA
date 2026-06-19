-- =============================================================================
-- Migration: 20260619000400_lab_orders_rls.sql
-- Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 03
-- Purpose: RLS policies for prosthetic_labs + lab_orders (LAB-01 — T-13-08/T-13-09)
--
-- Pattern: separate SELECT + ALL-write policies (mirrors resources_rls.sql).
--   SELECT: any authenticated member of the clinic can read.
--   ALL (write): gated to admin / superadmin / dentist (T-13-09 elevation guard).
--   USING + WITH CHECK always pair (CLAUDE.md mandate).
--
-- NOTE: financial_transactions RLS is NOT modified here — the despesa INSERT in
--   Plan 04 goes via the authenticated client and is governed by the EXISTING
--   financial_transactions policy (tenant_id = get_my_tenant_id() + admin write).
-- =============================================================================

-- ─── prosthetic_labs RLS ─────────────────────────────────────────────────────

ALTER TABLE public.prosthetic_labs ENABLE ROW LEVEL SECURITY;

-- All authenticated clinic members can read their clinic's labs (T-13-08)
CREATE POLICY "prosthetic_labs_select" ON public.prosthetic_labs
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Write operations: admin / superadmin / dentist only (T-13-09)
CREATE POLICY "prosthetic_labs_write" ON public.prosthetic_labs
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );

-- ─── lab_orders RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- All authenticated clinic members can read their clinic's lab orders (T-13-08)
CREATE POLICY "lab_orders_select" ON public.lab_orders
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Write operations: admin / superadmin / dentist only (T-13-09)
CREATE POLICY "lab_orders_write" ON public.lab_orders
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );
