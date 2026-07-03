-- =============================================================================
-- Migration: 20260703000200_estoque_alters.sql
-- Phase: 17-estoque-materiais / Plan 02
-- Purpose: ALTER existing tables to support Phase 17 integration:
--   1. payables.origem CHECK — adicionar 'estoque_agente' (EST-03 / D-15)
--   2. approval_requests.requested_by — tornar nullable (Open Question 2)
--
-- Requirements: EST-03
-- Dependencies:
--   public.payables            — 20260621000100_payables_tables.sql
--   public.approval_requests   — 20260616000200_approval_requests.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. payables.origem CHECK — adicionar 'estoque_agente'
-- ---------------------------------------------------------------------------
-- EST-03 / D-15: O agente de compras L2 gera rascunhos de CP com origem = 'estoque_agente'.
-- O CHECK atual (migration 20260621000100 linha 78) não inclui este valor →
-- INSERT falharia com 23514 check_violation silencioso (Pitfall 1 do RESEARCH).
--
-- Estratégia: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT com lista completa.
-- A lista inclui todos os valores anteriores + o novo valor 'estoque_agente'.
ALTER TABLE public.payables DROP CONSTRAINT IF EXISTS payables_origem_check;
ALTER TABLE public.payables ADD CONSTRAINT payables_origem_check
  CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo', 'estoque_agente'));

COMMENT ON COLUMN public.payables.origem IS
  'Origem da conta a pagar. estoque_agente = gerada pelo agente de compras L2 (EST-03, D-15).';

-- ---------------------------------------------------------------------------
-- 2. approval_requests.requested_by — tornar nullable
-- ---------------------------------------------------------------------------
-- Open Question 2 (RESEARCH.md): O agente de compras L2 é um ator de sistema (cron/agent)
-- sem sessão de usuário. O campo requested_by é FK para public.users(id) NOT NULL —
-- sem um UUID de usuário real, o INSERT falharia com 23502 not_null_violation.
--
-- Solução: tornar requested_by nullable. NULL = ação de sistema/agente cron.
-- A FK para public.users permanece (integridade quando informado por humano).
-- O valor '00000000-...' (system user sentinel) mencionado no RESEARCH Pattern 4
-- pode ser usado como alternativa, mas NULL é mais explícito e correto semanticamente.
ALTER TABLE public.approval_requests ALTER COLUMN requested_by DROP NOT NULL;

COMMENT ON COLUMN public.approval_requests.requested_by IS
  'UUID do usuário que originou a requisição. NULL = ação de sistema/agente cron (sem sessão de usuário). Open Question 2 resolvido: nullable.';
