-- =============================================================================
-- Migration: 20260621000400_tax_tables.sql
-- Phase: 16-contas-a-pagar-concilia-o-tributos / Plan 02
-- Purpose: Create versioned tax reference tables (D-17, TRIB-02):
--   inss_tax_tables  — faixas INSS progressivas versionadas por vigência
--   irrf_tax_tables  — faixas IRRF versionadas por vigência (com formula_desconto)
--   iss_tax_tables   — alíquotas ISS por município versionadas por vigência
--
-- Requirements: TRIB-02, D-17
-- Dependencies: none (global reference data — no clinic_id, no FK to tenants)
--
-- Design (Padrão 1 — RESEARCH §"Brazilian Tax Withholding"):
--   - Versionadas por vigencia_inicio/vigencia_fim DATE: a query busca
--     WHERE vigencia_inicio <= data_pagamento AND (vigencia_fim IS NULL OR vigencia_fim >= data_pagamento)
--   - vigencia_fim NULL = tabela vigente (sem data de encerramento)
--   - Permite auditoria retroativa: cálculo de 2025 usa tabela 2025, não 2026
--   - Seed 2026 em 20260621000700_phase16_seed.sql
--
-- No clinic_id: dados de referência globais (compartilhados como glosa_motivos NULL-clinic).
-- RLS (Plan 03): tabelas são read-only para todos os tenants; escrita apenas via migration/superadmin.
-- =============================================================================

-- ── inss_tax_tables (D-17) ───────────────────────────────────────────────────
-- Faixas INSS progressivas (contribuinte individual prestador a empresa).
-- teto: valor máximo de contribuição (NULL = sem teto na faixa; última faixa define o teto).
-- parcela_deduzir: valor fixo a deduzir do imposto calculado (tabela progressiva).
-- aliquota: ex: 0.1400 para 14%.
-- Modalidade '11pct' (flat com teto) calcula: MIN(bruto, teto_faixa_max) × 0.11
--   teto = faixa_max da última faixa (8475.55 em 2026) — documentado no seed.
-- Modalidade 'progressivo' usa a tabela normalmente (soma das faixas com dedução).
CREATE TABLE public.inss_tax_tables (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio DATE          NOT NULL,
  vigencia_fim    DATE,                         -- NULL = vigente
  faixa_min       NUMERIC(12,2) NOT NULL,
  faixa_max       NUMERIC(12,2),               -- NULL = sem limite superior na faixa
  aliquota        NUMERIC(5,4)  NOT NULL,       -- ex: 0.1400 para 14%
  parcela_deduzir NUMERIC(12,2) NOT NULL DEFAULT 0,
  teto            NUMERIC(12,2),               -- max contrib = teto × aliquota - parcela_deduzir
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_inss_tax_vigencia ON public.inss_tax_tables(vigencia_inicio, vigencia_fim);

-- ── irrf_tax_tables (D-17) ──────────────────────────────────────────────────
-- Faixas IRRF progressivas mensais (Lei 15.270/2025 — vigência 2026-01-01).
-- formula_desconto: coluna TEXT para a faixa gradual (5000.01–7350.00).
--   A faixa gradual usa: desconto = 978.62 - (0.133145 × base_calculo)
--   Armazenada como string para auditoria; computeIrrf interpreta em runtime.
-- parcela_deduzir: dedução fixa para faixas não-graduais (ex: 908.73 para 27.5%).
CREATE TABLE public.irrf_tax_tables (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio  DATE          NOT NULL,
  vigencia_fim     DATE,                         -- NULL = vigente
  faixa_min        NUMERIC(12,2) NOT NULL,
  faixa_max        NUMERIC(12,2),               -- NULL = acima do limite (última faixa)
  aliquota         NUMERIC(5,4)  NOT NULL,       -- ex: 0.2750 para 27.5%; 0.0000 para isento
  parcela_deduzir  NUMERIC(12,2) NOT NULL DEFAULT 0,
  teto             NUMERIC(12,2),
  formula_desconto TEXT,                         -- fórmula da faixa gradual (NULLABLE — faixas normais usam parcela_deduzir)
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_irrf_tax_vigencia ON public.irrf_tax_tables(vigencia_inicio, vigencia_fim);

-- ── iss_tax_tables (D-17) ────────────────────────────────────────────────────
-- Alíquotas ISS por município versionadas por vigência.
-- codigo_ibge: código IBGE do município (7 dígitos; ex: '3550308' = São Paulo).
-- servico_lc116: item da Lista de Serviços LC 116/2003 (ex: '14.01' = serviços de saúde).
-- computeIss fallback: usa suppliers.iss_override quando não encontra linha por município.
-- Seed: 1 linha padrão código '0000000' como fallback genérico (Plan 02 seed).
-- Linhas per-município são adicionadas pelo admin via future migration.
CREATE TABLE public.iss_tax_tables (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio DATE          NOT NULL,
  vigencia_fim    DATE,                         -- NULL = vigente
  codigo_ibge     TEXT          NOT NULL,       -- '3550308' = São Paulo; '0000000' = padrão fallback
  municipio       TEXT          NOT NULL,
  aliquota        NUMERIC(5,4)  NOT NULL,       -- ex: 0.0500 para 5%
  servico_lc116   TEXT,                         -- item LC 116 (ex: '14.01' serv. de saúde); NULL = todos
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_iss_tax_municipio ON public.iss_tax_tables(codigo_ibge, vigencia_inicio);
