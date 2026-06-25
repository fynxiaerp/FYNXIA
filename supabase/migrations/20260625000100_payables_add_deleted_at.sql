-- =============================================================================
-- Migration: 20260625000100_payables_add_deleted_at.sql
-- Phase: 16-contas-a-pagar-concilia-o-tributos / UAT hotfix
-- Purpose: Add missing soft-delete column to public.payables.
--
-- Bug (UAT Fase 16, Teste 1 — blocker):
--   /clinica/financeiro/contas-a-pagar falhava com
--   "column payables.deleted_at does not exist".
--   public.payables foi criada em 20260621000100_payables_tables.sql SEM a coluna
--   deleted_at, mas src/actions/payables.ts filtra .is('deleted_at', null) em 4
--   queries (listar, detalhar, baixar, cancelar). O CREATE TABLE original foi
--   corrigido para builds limpas; este ALTER aplica o fix ao banco já provisionado.
--
-- Convenção (CLAUDE.md): soft delete obrigatório (LGPD). suppliers e demais
--   tabelas já seguem o padrão deleted_at TIMESTAMPTZ nullable (NULL = ativo).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS — seguro em prod e em rebuild local.
-- =============================================================================

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
