-- =============================================================================
-- Migration: 20260719000200_bi_rls.sql
-- Phase: 19-relat-rios-or-amento-bi / Plan 03
-- Purpose: RLS policies for the 4 BI tables created in 20260719000100_bi_tables.sql.
--
-- Requirements: REP-02, REP-03, BI-01, BI-02
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (existing
--   convention, mirrors approval_requests / ai_agent_config).
--
-- budget_targets — socio WRITE allowed per D-14 (orçamento is not readOnly for socio).
-- kpi_targets    — admin/superadmin write only.
-- partner_shares — read: self-row pattern for socio (D-24/T-19-04); write: admin/
--                  superadmin only (A1/T-19-05) — socio has NO INSERT/UPDATE grant.
-- bi_alerts      — read-only for all tenant members; NO authenticated write policy
--                  at all — writes happen exclusively via service role (cron/agent),
--                  mirroring stock_alerts / nps_responses (T-19-06).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- budget_targets
-- ---------------------------------------------------------------------------
ALTER TABLE public.budget_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_targets_tenant_read" ON public.budget_targets
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- D-14: socio has WRITE access to budget targets (orçamento module is not readOnly for socio)
CREATE POLICY "budget_targets_write" ON public.budget_targets
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'socio')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'socio')
  );

-- ---------------------------------------------------------------------------
-- kpi_targets
-- ---------------------------------------------------------------------------
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_targets_tenant_read" ON public.kpi_targets
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "kpi_targets_admin_write" ON public.kpi_targets
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
-- partner_shares
-- Read: admin/superadmin see all rows; socio sees only their own row (T-19-04, D-24).
-- Write: admin/superadmin only — socio is NOT granted write (A1, T-19-05).
-- ---------------------------------------------------------------------------
ALTER TABLE public.partner_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_shares_self_or_admin_read" ON public.partner_shares
  FOR SELECT USING (
    clinic_id = get_my_tenant_id()
    AND (
      get_my_role() IN ('admin', 'superadmin')
      OR (get_my_role() = 'socio' AND user_id = auth.uid())
    )
  );

CREATE POLICY "partner_shares_admin_write" ON public.partner_shares
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
-- bi_alerts
-- Read-only for all tenant members. NO INSERT/UPDATE/DELETE policy for any
-- authenticated role — bi_alerts is written exclusively by the service role
-- (cron / bi-forecast-agent), which bypasses RLS entirely. This mirrors the
-- stock_alerts / nps_responses zero-authenticated-write convention (T-19-06).
-- ---------------------------------------------------------------------------
ALTER TABLE public.bi_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_alerts_tenant_read" ON public.bi_alerts
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Deliberately no write policy: inserts/updates/deletes only via service role client.
