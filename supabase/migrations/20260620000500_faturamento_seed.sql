-- =============================================================================
-- Migration: 20260620000500_faturamento_seed.sql
-- Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 02
-- Purpose: Seed catalog & ANS motivos for the billing domain.
--   Part A — glosa_motivos: ANS Tabela 38 system-wide codes (clinic_id = NULL).
--             These are public reference data (no PII — T-15-05 accepted).
--             Inserted once; guarded by WHERE NOT EXISTS so idempotent.
--   Part B — seed_faturamento_services(): AFTER INSERT trigger on clinics seeds
--             ~12 standard dental services per new tenant.
--             Mirrors seed_chart_of_accounts() pattern from 20260619001300.
--             Backfill INSERT...SELECT covers clinics that existed before this
--             migration runs (idempotent NOT EXISTS guard on clinic_id).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART A: glosa_motivos — ANS Tabela 38 system-wide codes (clinic_id = NULL)
--   clinic_id IS NULL = shared ANS reference data; not per-tenant.
--   ON CONFLICT DO NOTHING keeps the insert idempotent on repeated pushes.
--   Codes sourced from ANS Tabela 38 (standard rejection reasons — CONV-03).
-- ---------------------------------------------------------------------------
INSERT INTO public.glosa_motivos (clinic_id, codigo_ans, descricao)
SELECT NULL, codigo_ans, descricao
FROM (VALUES
  ('1001', 'Número da carteira inválido'),
  ('1002', 'Beneficiário não localizado na base de dados'),
  ('1003', 'Beneficiário com dados incompletos ou incorretos'),
  ('1005', 'Beneficiário sem cobertura para este procedimento'),
  ('1006', 'Carência não cumprida'),
  ('1007', 'Beneficiário com contrato suspenso ou cancelado'),
  ('2001', 'Prestador não credenciado para este procedimento'),
  ('2003', 'Número do CRO inválido ou não correspondente ao executante'),
  ('2004', 'Prestador habilitado apenas para execução parcial'),
  ('3001', 'Procedimento não coberto pelo plano'),
  ('3002', 'Procedimento duplicado'),
  ('3005', 'Quantidade de procedimentos acima do limite'),
  ('3007', 'Documentação incompleta, incorreta ou ausente'),
  ('3008', 'Procedimento não autorizado'),
  ('3009', 'Incompatibilidade entre o procedimento e o dente informado'),
  ('3010', 'Guia sem autorização prévia quando exigida'),
  ('4001', 'Valor cobrado acima da tabela de preços'),
  ('4002', 'Glosa parcial por divergência de valor'),
  ('4003', 'Código de procedimento inválido ou não reconhecido'),
  ('4004', 'Guia com dados incompletos para faturamento'),
  ('9901', 'Outros (definido pela operadora)')
) AS x(codigo_ans, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM public.glosa_motivos WHERE clinic_id IS NULL
);

-- ---------------------------------------------------------------------------
-- PART B — seed_faturamento_services(): per-tenant dental service catalog
--   Called from the AFTER INSERT trigger on clinics (new tenants) and also via
--   idempotent backfill below (existing clinics that predate this migration).
--   Services are editable by the clinic; account_id left NULL (classified later).
--   TUSS codes sourced from TUSS terminologia odontológica (D-05).
--   T-15-04: trigger uses NEW.id only — no cross-tenant seeding possible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_faturamento_services()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clinic UUID := NEW.id;
BEGIN
  INSERT INTO public.services (clinic_id, name, tuss_code, valor_particular, ativo)
  VALUES
    (v_clinic, 'Consulta odontológica',         '00010014',  80.00,   true),
    (v_clinic, 'Profilaxia / limpeza',           NULL,        120.00,  true),
    (v_clinic, 'Restauração resina composta',    '85100196',  180.00,  true),
    (v_clinic, 'Tratamento de canal (endodontia)', NULL,      700.00,  true),
    (v_clinic, 'Exodontia simples',              NULL,        200.00,  true),
    (v_clinic, 'Raspagem periodontal',           NULL,        250.00,  true),
    (v_clinic, 'Clareamento dental',             NULL,        600.00,  true),
    (v_clinic, 'Prótese total',                  NULL,        1200.00, true),
    (v_clinic, 'Coroa unitária',                 NULL,        1500.00, true),
    (v_clinic, 'Radiografia periapical',         '41001010',  50.00,   true),
    (v_clinic, 'Selante',                        NULL,        90.00,   true),
    (v_clinic, 'Aplicação de flúor',             NULL,        70.00,   true);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: seed_services_on_clinic
--   Fires AFTER INSERT on clinics for each new tenant.
--   Name chosen alphabetically AFTER seed_accounts_on_clinic so chart-of-accounts
--   already exists when this fires (PostgreSQL fires AFTER triggers alphabetically).
-- ---------------------------------------------------------------------------
CREATE TRIGGER seed_services_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_faturamento_services();

-- ---------------------------------------------------------------------------
-- Backfill: existing clinics that predate this migration.
--   NOT EXISTS guard: only seeds for clinics that have no services yet.
--   Idempotent — safe to re-run.
-- ---------------------------------------------------------------------------
INSERT INTO public.services (clinic_id, name, tuss_code, valor_particular, ativo)
SELECT c.id, x.name, x.tuss_code, x.valor_particular, true
FROM public.clinics c
CROSS JOIN (VALUES
  ('Consulta odontológica',           '00010014',  80.00::NUMERIC(12,2)),
  ('Profilaxia / limpeza',            NULL,        120.00::NUMERIC(12,2)),
  ('Restauração resina composta',     '85100196',  180.00::NUMERIC(12,2)),
  ('Tratamento de canal (endodontia)', NULL,       700.00::NUMERIC(12,2)),
  ('Exodontia simples',               NULL,        200.00::NUMERIC(12,2)),
  ('Raspagem periodontal',            NULL,        250.00::NUMERIC(12,2)),
  ('Clareamento dental',              NULL,        600.00::NUMERIC(12,2)),
  ('Prótese total',                   NULL,        1200.00::NUMERIC(12,2)),
  ('Coroa unitária',                  NULL,        1500.00::NUMERIC(12,2)),
  ('Radiografia periapical',          '41001010',  50.00::NUMERIC(12,2)),
  ('Selante',                         NULL,        90.00::NUMERIC(12,2)),
  ('Aplicação de flúor',              NULL,        70.00::NUMERIC(12,2))
) AS x(name, tuss_code, valor_particular)
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s WHERE s.clinic_id = c.id
);
