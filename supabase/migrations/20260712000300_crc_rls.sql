-- =============================================================================
-- Migration: 20260712000300_crc_rls.sql
-- Phase: 18-crc-marketing / Plan 02
-- Purpose: Row Level Security for all 6 Phase 18 CRC & Marketing tables.
-- Pattern: mirrors 20260703000300_estoque_rls.sql (ENABLE RLS +
--          tenant_read SELECT + role_write FOR ALL with USING+WITH CHECK)
--
-- Requirements: CRC-01, CRC-02, CRC-03, CRC-04, CRC-05
--
-- Write role matrix (Pitfall 7 RESEARCH — no 'marketing' role in the 11-value
-- enum): WRITER_ROLES = admin, superadmin, receptionist (mirrors every other
-- phase's `const WRITER_ROLES = [...]` convention in src/actions/*.ts).
--
-- T-18-03 (Information Disclosure): USING (clinic_id = get_my_tenant_id()) on all 6 tables.
-- T-18-04 (Elevation of Privilege): nps_responses / referral_rewards have NO
--   authenticated INSERT policy — scores/credits are never client-writable, writes
--   go through service role only (createAdminClient in cron/agent), mirrors stock_draws.
-- T-18-05 (Tampering): every write policy pairs USING with WITH CHECK.
--
-- Tables covered (6):
--   role_write (READ + WRITE authenticated): lead_sources, leads, campaigns, referrals
--   read + treat-update only (authenticated): nps_responses
--   read-only (authenticated): referral_rewards
-- =============================================================================

-- ---------------------------------------------------------------------------
-- lead_sources
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_sources_tenant_read" ON public.lead_sources
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "lead_sources_write" ON public.lead_sources
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  );

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_tenant_read" ON public.campaigns
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "campaigns_write" ON public.campaigns
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  );

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_tenant_read" ON public.leads
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "leads_write" ON public.leads
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  );

-- ---------------------------------------------------------------------------
-- nps_responses — READ + treat-update only for authenticated (T-18-04)
-- ---------------------------------------------------------------------------
-- INTENCIONAL: sem política de INSERT para authenticated. Invites/scores são
-- escritos exclusivamente via service role (createAdminClient) no cron noturno
-- (D-12) e na Server Action pública de submissão (rota /nps/[patient-id]/[token],
-- sem sessão). O único write autenticado permitido é marcar detractor_treated_at
-- (markDetractorTreated, D-15) — modelado como UPDATE policy dedicada.
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nps_responses_tenant_read" ON public.nps_responses
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "nps_responses_treat_update" ON public.nps_responses
  FOR UPDATE
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  );

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_tenant_read" ON public.referrals
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "referrals_write" ON public.referrals
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'receptionist')
  );

-- ---------------------------------------------------------------------------
-- referral_rewards — READ-ONLY for authenticated (T-18-04)
-- ---------------------------------------------------------------------------
-- INTENCIONAL: sem política de escrita para authenticated. Ledger é gravado
-- exclusivamente via service role em creditReferralReward (D-18), disparado na
-- conversão do lead indicado — nunca client-writable (evita fraude de auto-crédito).
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_rewards_tenant_read" ON public.referral_rewards
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- INTENCIONAL: sem política de escrita para authenticated.
-- Escrita exclusivamente via service role (createAdminClient) em creditReferralReward.
