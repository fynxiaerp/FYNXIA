-- =============================================================================
-- Migration: 20260621000700_phase16_seed.sql
-- Phase: 16-contas-a-pagar-concilia-o-tributos / Plan 02
-- Purpose: Seed 2026 tax brackets (D-17, TRIB-02):
--   inss_tax_tables  — 4 faixas progressivas INSS 2026
--   irrf_tax_tables  — 3 faixas IRRF 2026 (Lei 15.270/2025)
--   iss_tax_tables   — 1 linha padrão fallback ISS (5% LC116 item 14.01)
--
-- Requirements: TRIB-02, D-17
-- Idempotency: ON CONFLICT DO NOTHING — safe for re-push (supabase db push --dry-run).
--
-- INSS 2026 source: contabilizei.com.br/contabilidade-online/tabela-inss/
-- IRRF 2026 source: Lei 15.270/2025 (sancionada 2025-11-26) + contabilizei.com.br
--
-- Modalidade '11pct' (flat com teto — autônomo prestador a empresa, Lei 8.212/91 art.21 §2):
--   contrib = MIN(bruto, 8475.55) × 0.11
--   O teto R$ 8475.55 é faixa_max da última faixa progressiva (teto column confirma).
--   computeInss usa a coluna `teto` da última faixa para o cálculo flat.
-- Modalidade 'progressivo' (autônomo prestador a pessoa física):
--   contrib = SUM por faixa, com parcela_deduzir subtraída do resultado final.
--
-- suppliers.tipo values ('laboratorio','material','servico','autonomo','pj','outro')
--   são implicitamente seeded pelo CHECK constraint — sem linhas de seed necessárias.
-- =============================================================================

-- ── INSS 2026 — contribuinte individual progressivo ───────────────────────────
-- 4 faixas (RESEARCH linhas 196-201; vigencia_inicio 2026-01-01; vigencia_fim NULL = vigente)
-- Faixa 4: teto = 8475.55 (usado pela modalidade '11pct' flat)
INSERT INTO public.inss_tax_tables
  (vigencia_inicio, vigencia_fim, faixa_min, faixa_max, aliquota, parcela_deduzir, teto)
VALUES
  ('2026-01-01', NULL, 0.00,    1621.00, 0.0750, 0.00,   NULL),
  ('2026-01-01', NULL, 1621.01, 2902.84, 0.0900, 24.32,  NULL),
  ('2026-01-01', NULL, 2902.85, 4354.27, 0.1200, 111.40, NULL),
  ('2026-01-01', NULL, 4354.28, 8475.55, 0.1400, 198.49, 8475.55)
ON CONFLICT DO NOTHING;

-- ── IRRF 2026 — tabela progressiva mensal (Lei 15.270/2025) ──────────────────
-- 3 faixas: isento / gradual / flat 27.5%
-- Faixa gradual (5000.01–7350.00): usa formula_desconto = '978.62 - 0.133145 * base'
--   computeIrrf aplica: desconto = 978.62 - (0.133145 × base_calculo)
--   aliquota da faixa gradual = 0.2750 (mesma alíquota marginal) mas imposto = aliquota*base - desconto_formula
-- Faixa isenta: aliquota = 0.0000; parcela_deduzir = 0.00
-- Faixa 27.5% flat: parcela_deduzir = 908.73 (dedução fixa pós-progresso)
INSERT INTO public.irrf_tax_tables
  (vigencia_inicio, vigencia_fim, faixa_min, faixa_max, aliquota, parcela_deduzir, teto, formula_desconto)
VALUES
  ('2026-01-01', NULL, 0.00,    5000.00, 0.0000, 0.00,   NULL, NULL),
  ('2026-01-01', NULL, 5000.01, 7350.00, 0.2750, 0.00,   NULL, '978.62 - 0.133145 * base'),
  ('2026-01-01', NULL, 7350.01, NULL,    0.2750, 908.73, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── ISS — linha padrão fallback ───────────────────────────────────────────────
-- codigo_ibge '0000000' = fallback genérico (nenhum município real usa este código).
-- computeIss busca por codigo_ibge do município; se não encontrar, usa suppliers.iss_override.
-- Linhas per-município são adicionadas pelo admin ou por future migration específica.
-- servico_lc116 '14.01' = item LC 116/2003 — Serviços de Saúde (odontologia inclusa).
INSERT INTO public.iss_tax_tables
  (vigencia_inicio, vigencia_fim, codigo_ibge, municipio, aliquota, servico_lc116)
VALUES
  ('2026-01-01', NULL, '0000000', 'Padrão', 0.0500, '14.01')
ON CONFLICT DO NOTHING;
