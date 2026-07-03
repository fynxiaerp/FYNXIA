-- =============================================================================
-- Migration: 20260703000400_estoque_seed.sql
-- Phase: 17-estoque-materiais / Plan 02
-- Purpose: Seed do agente 'stock_replenishment' no ai_agent_config (EST-03 / D-15).
--
-- Requirements: EST-03
-- Dependencies:
--   public.clinics                — 20260604000300_clinics_users_phase1.sql
--   public.ai_agent_config        — 20260614000600_ai_agent_config.sql
--     uq_ai_agent_config_network  — índice parcial WHERE unit_id IS NULL
--
-- Rationale: O agente de compras L2 (stock_replenishment) precisa existir na tabela
--   ai_agent_config para que withAgentPolicy() funcione. Sem este seed, o framework
--   de governança de agentes rejeitaria o agente como não configurado.
--
-- Padrão de seed: mirrors 20260614000600_ai_agent_config.sql (linhas 44-49).
--   - Level L2 por padrão (conforme D-15: agente cria rascunho de CP com aprovação humana).
--   - ON CONFLICT usa o índice parcial WHERE unit_id IS NULL (network-level config).
--   - Idempotente: re-executável sem erro se já existir.
-- =============================================================================

-- Seed do agente 'stock_replenishment' L2 (network-level) para todas as clínicas ativas
-- L2 = autonomia moderada: cria rascunho de CP mas requer aprovação humana antes de efetivar.
-- unit_id = NULL = configuração de rede (válida para toda a clínica/rede de franquias).
INSERT INTO public.ai_agent_config (clinic_id, agent_key, autonomy_level, enabled)
SELECT c.id, 'stock_replenishment', 'L2', true
FROM public.clinics c
WHERE c.deleted_at IS NULL
ON CONFLICT (clinic_id, agent_key) WHERE unit_id IS NULL DO NOTHING;
