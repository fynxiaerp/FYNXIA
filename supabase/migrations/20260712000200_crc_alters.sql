-- =============================================================================
-- Migration: 20260712000200_crc_alters.sql
-- Phase: 18-crc-marketing / Plan 02
-- Purpose: payables.campaign_id nullable FK — financial cost linkage for
--   campaign ROI (D-05: CPL/CAC). Mirrors lab_orders.financial_transaction_id
--   (Phase 13) reverse-direction precedent.
--
-- Requirements: CRC-02
-- Dependencies: public.payables(id), public.campaigns(id) — created in 20260712000100
--
-- D-05: custo da campanha vem do módulo financeiro — despesa lançada em Contas a
-- Pagar pode opcionalmente ser tagueada com a campanha que financia. Nullable: a
-- maioria dos payables não tem relação com campanha nenhuma. Attribution acontece
-- em `payables` (lançamento/committed spend), não em `financial_transactions`
-- (que só existe a partir da baixa) — ver RESEARCH Pattern 2 / Assumption A3.
--
-- NOT touched (Pitfall 1 / A2 — reuse, no schema change needed):
--   - the AI-governance approval-queue table's type CHECK — reuses 'ai_action' +
--     agent_key='crc-campaign' (no new type value needed)
--   - patient_consents.consent_type CHECK — reuses 'marketing_whatsapp' as umbrella
--     marketing consent for both WhatsApp and email channels in v1 (Assumption A2)
-- =============================================================================

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payables_campaign ON public.payables(campaign_id) WHERE campaign_id IS NOT NULL;

COMMENT ON COLUMN public.payables.campaign_id IS 'D-05: FK opcional para a campanha que esta despesa de marketing financia. NULL = despesa não relacionada a campanha. CPL/CAC agregam via SUM(valor_total) WHERE campaign_id = X.';
