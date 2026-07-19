-- =============================================================================
-- Migration: 20260719000300_bi_seed.sql
-- Phase: 19-relat-rios-or-amento-bi / Plan 03
-- Purpose: Seed do agente 'bi_forecast' no ai_agent_config (BI-02 / D-31/D-34).
--
-- Requirements: BI-02
-- Dependencies:
--   public.clinics          — 20260604000300_clinics_users_phase1.sql
--   public.ai_agent_config  — 20260614000600_ai_agent_config.sql
--     uq_ai_agent_config_network — índice parcial WHERE unit_id IS NULL
--
-- Rationale: O agente de previsão/alertas de BI (bi_forecast) precisa existir na
--   tabela ai_agent_config para que withAgentPolicy() funcione. Sem este seed, o
--   framework de governança de agentes rejeitaria o agente como não configurado.
--
-- Padrão de seed: mirrors 20260703000400_estoque_seed.sql.
--   - Level L1 por padrão (A2: suggest-only). D-34/D-35 sempre roteiam por
--     approval_requests independentemente do nível configurado — o agente NUNCA
--     escreve diretamente em budget_targets/bi_alerts fora do fluxo de aprovação.
--   - ON CONFLICT usa o índice parcial WHERE unit_id IS NULL (network-level config).
--   - Idempotente: re-executável sem erro se já existir.
-- =============================================================================

INSERT INTO public.ai_agent_config (clinic_id, agent_key, autonomy_level, enabled)
SELECT c.id, 'bi_forecast', 'L1', true
FROM public.clinics c
WHERE c.deleted_at IS NULL
ON CONFLICT (clinic_id, agent_key) WHERE unit_id IS NULL DO NOTHING;
