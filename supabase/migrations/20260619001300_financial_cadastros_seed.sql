-- =============================================================================
-- Migration: 20260619001300_financial_cadastros_seed.sql
-- Phase: 14-financeiro-cadastros-base / Plan 02
-- Purpose: Seed odontological chart of accounts, default cost centers per unit,
--          update financial_categories to map account_id, backfill existing
--          financial_transactions with account_id + cost_center_id.
-- Order (within single transaction — atomic):
--   STEP 1  seed_chart_of_accounts() function
--   STEP 2  trigger seed_accounts_on_clinic (fires BEFORE seed_categories_on_clinic
--           alphabetically — Pitfall 5: ensures chart exists when categories seed)
--   STEP 3  CREATE OR REPLACE seed_financial_categories() to include account_id mapping
--   STEP 4  Backfill chart_of_accounts for existing clinics (idempotent)
--   STEP 5  Map existing financial_categories.account_id by name (idempotent)
--   STEP 6  Seed 1 default CC per existing unit (idempotent)
--   STEP 7  Trigger seed_default_cost_center() on units AFTER INSERT
--   STEP 8  Backfill financial_transactions.account_id via category
--   STEP 9  Backfill financial_transactions.cost_center_id via tenant default CC
--   STEP 10 Assertion: 0 unresolved rows that have a resolvable CC (atomically fails migration)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: seed_chart_of_accounts() — inserts full odontological chart tree
--   for a newly created clinic (NEW.id). Inserts roots first, then subgroups,
--   then leaves — each batch resolves parent_id by (clinic_id, code) JOIN.
--   SECURITY DEFINER: runs as function owner, bypasses RLS during migration.
--   Odontological chart (RESEARCH Pattern 4, codes per CFC convention):
--     1       Receitas                  grupo
--     1.1     Receitas Operacionais     grupo
--     1.1.1   Consultas                 receita
--     1.1.2   Tratamentos Odontológicos receita
--     1.1.3   Convênios                 receita
--     1.1.4   Outras Receitas           receita
--     2       Despesas                  grupo
--     2.1     Despesas Operacionais     grupo
--     2.1.1   Aluguel                   despesa
--     2.1.2   Materiais Odontológicos   despesa
--     2.1.3   Salários e Encargos       despesa
--     2.1.4   Laboratório               despesa
--     2.1.5   Impostos e Taxas          despesa
--     2.1.6   Outras Despesas           despesa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clinic UUID := NEW.id;
BEGIN
  -- Roots (no parent)
  INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type) VALUES
    (v_clinic, NULL, '1', 'Receitas',  'grupo'),
    (v_clinic, NULL, '2', 'Despesas',  'grupo');

  -- Subgroups (parent resolved by code within this clinic)
  INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type)
  SELECT v_clinic, p.id, x.code, x.name, 'grupo'
  FROM (VALUES
    ('1.1', 'Receitas Operacionais',  '1'),
    ('2.1', 'Despesas Operacionais',  '2')
  ) AS x(code, name, parent_code)
  JOIN public.chart_of_accounts p ON p.clinic_id = v_clinic AND p.code = x.parent_code;

  -- Leaves (parent resolved by code within this clinic)
  INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type)
  SELECT v_clinic, p.id, x.code, x.name, x.type
  FROM (VALUES
    ('1.1.1', 'Consultas',                 'receita', '1.1'),
    ('1.1.2', 'Tratamentos Odontológicos', 'receita', '1.1'),
    ('1.1.3', 'Convênios',                 'receita', '1.1'),
    ('1.1.4', 'Outras Receitas',           'receita', '1.1'),
    ('2.1.1', 'Aluguel',                   'despesa', '2.1'),
    ('2.1.2', 'Materiais Odontológicos',   'despesa', '2.1'),
    ('2.1.3', 'Salários e Encargos',       'despesa', '2.1'),
    ('2.1.4', 'Laboratório',               'despesa', '2.1'),
    ('2.1.5', 'Impostos e Taxas',          'despesa', '2.1'),
    ('2.1.6', 'Outras Despesas',           'despesa', '2.1')
  ) AS x(code, name, type, parent_code)
  JOIN public.chart_of_accounts p ON p.clinic_id = v_clinic AND p.code = x.parent_code;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2: Trigger seed_accounts_on_clinic
--   Name chosen so it fires BEFORE seed_categories_on_clinic alphabetically
--   (PostgreSQL fires AFTER triggers on same event in alphabetical order by name).
--   'seed_accounts_on_clinic' < 'seed_categories_on_clinic' — chart seeded first.
-- ---------------------------------------------------------------------------
CREATE TRIGGER seed_accounts_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_chart_of_accounts();

-- ---------------------------------------------------------------------------
-- STEP 3: CREATE OR REPLACE seed_financial_categories()
--   Re-creates the Phase 3 function to also map account_id after inserting
--   categories. Because seed_accounts_on_clinic runs first (Step 2), the
--   chart_of_accounts rows for this clinic already exist when this fires.
--   The original 10 INSERT VALUES are preserved; the UPDATE appended below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_financial_categories()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Receita categories (dental income)
  INSERT INTO public.financial_categories (tenant_id, name, type, is_default)
  VALUES
    (NEW.id, 'Consulta',                   'receita', true),
    (NEW.id, 'Tratamento Odontológico',    'receita', true),
    (NEW.id, 'Convênio',                   'receita', true),
    (NEW.id, 'Outros',                     'receita', true),
    -- Despesa categories (dental expenses)
    (NEW.id, 'Aluguel',                    'despesa', true),
    (NEW.id, 'Materiais Odontológicos',    'despesa', true),
    (NEW.id, 'Salários',                   'despesa', true),
    (NEW.id, 'Laboratório',                'despesa', true),
    (NEW.id, 'Impostos',                   'despesa', true),
    (NEW.id, 'Outros',                     'despesa', true);

  -- Map account_id to the leaf chart account by category name
  -- (chart already seeded by seed_accounts_on_clinic which runs first)
  UPDATE public.financial_categories fc
  SET account_id = coa.id
  FROM public.chart_of_accounts coa
  WHERE coa.clinic_id = NEW.id
    AND fc.tenant_id  = NEW.id
    AND fc.account_id IS NULL
    AND (
      (fc.name = 'Consulta'                AND coa.code = '1.1.1') OR
      (fc.name = 'Tratamento Odontológico' AND coa.code = '1.1.2') OR
      (fc.name = 'Convênio'               AND coa.code = '1.1.3') OR
      (fc.name = 'Outros' AND fc.type = 'receita' AND coa.code = '1.1.4') OR
      (fc.name = 'Aluguel'                AND coa.code = '2.1.1') OR
      (fc.name = 'Materiais Odontológicos' AND coa.code = '2.1.2') OR
      (fc.name = 'Salários'               AND coa.code = '2.1.3') OR
      (fc.name = 'Laboratório'            AND coa.code = '2.1.4') OR
      (fc.name = 'Impostos'               AND coa.code = '2.1.5') OR
      (fc.name = 'Outros' AND fc.type = 'despesa' AND coa.code = '2.1.6')
    );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 4: Backfill chart_of_accounts for EXISTING clinics
--   Idempotent: only inserts for clinics that have no chart rows yet.
--   Three batches: roots → subgroups → leaves (FK ordering).
-- ---------------------------------------------------------------------------

-- 4a. Roots
INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type)
SELECT c.id, NULL, x.code, x.name, 'grupo'
FROM public.clinics c
CROSS JOIN (VALUES ('1', 'Receitas'), ('2', 'Despesas')) AS x(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts coa WHERE coa.clinic_id = c.id
);

-- 4b. Subgroups (join on roots now inserted)
INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type)
SELECT c.id, p.id, x.code, x.name, 'grupo'
FROM public.clinics c
CROSS JOIN (VALUES
  ('1.1', 'Receitas Operacionais',  '1'),
  ('2.1', 'Despesas Operacionais',  '2')
) AS x(code, name, parent_code)
JOIN public.chart_of_accounts p ON p.clinic_id = c.id AND p.code = x.parent_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts coa WHERE coa.clinic_id = c.id AND coa.code = x.code
);

-- 4c. Leaves (join on subgroups now inserted)
INSERT INTO public.chart_of_accounts (clinic_id, parent_id, code, name, type)
SELECT c.id, p.id, x.code, x.name, x.type
FROM public.clinics c
CROSS JOIN (VALUES
  ('1.1.1', 'Consultas',                 'receita', '1.1'),
  ('1.1.2', 'Tratamentos Odontológicos', 'receita', '1.1'),
  ('1.1.3', 'Convênios',                 'receita', '1.1'),
  ('1.1.4', 'Outras Receitas',           'receita', '1.1'),
  ('2.1.1', 'Aluguel',                   'despesa', '2.1'),
  ('2.1.2', 'Materiais Odontológicos',   'despesa', '2.1'),
  ('2.1.3', 'Salários e Encargos',       'despesa', '2.1'),
  ('2.1.4', 'Laboratório',               'despesa', '2.1'),
  ('2.1.5', 'Impostos e Taxas',          'despesa', '2.1'),
  ('2.1.6', 'Outras Despesas',           'despesa', '2.1')
) AS x(code, name, type, parent_code)
JOIN public.chart_of_accounts p ON p.clinic_id = c.id AND p.code = x.parent_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts coa WHERE coa.clinic_id = c.id AND coa.code = x.code
);

-- ---------------------------------------------------------------------------
-- STEP 5: Map existing financial_categories.account_id by name
--   Idempotent: only updates rows where account_id IS NULL.
--   Uses tenant_id = clinic_id since financial_categories uses tenant_id.
-- ---------------------------------------------------------------------------
UPDATE public.financial_categories fc
SET account_id = coa.id
FROM public.chart_of_accounts coa
WHERE coa.clinic_id = fc.tenant_id
  AND fc.account_id IS NULL
  AND (
    (fc.name = 'Consulta'                AND coa.code = '1.1.1') OR
    (fc.name = 'Tratamento Odontológico' AND coa.code = '1.1.2') OR
    (fc.name = 'Convênio'               AND coa.code = '1.1.3') OR
    (fc.name = 'Outros' AND fc.type = 'receita' AND coa.code = '1.1.4') OR
    (fc.name = 'Aluguel'                AND coa.code = '2.1.1') OR
    (fc.name = 'Materiais Odontológicos' AND coa.code = '2.1.2') OR
    (fc.name = 'Salários'               AND coa.code = '2.1.3') OR
    (fc.name = 'Laboratório'            AND coa.code = '2.1.4') OR
    (fc.name = 'Impostos'               AND coa.code = '2.1.5') OR
    (fc.name = 'Outros' AND fc.type = 'despesa' AND coa.code = '2.1.6')
  );

-- ---------------------------------------------------------------------------
-- STEP 6: Seed 1 default CC per existing unit
--   Idempotent: NOT EXISTS guard replaces ON CONFLICT (partial unique index
--   conflict target syntax is awkward with WHERE clause).
-- ---------------------------------------------------------------------------
INSERT INTO public.cost_centers (clinic_id, unit_id, name, is_default, ativo)
SELECT u.clinic_id, u.id, u.name, true, true
FROM public.units u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cost_centers cc
    WHERE cc.unit_id = u.id AND cc.is_default = true
  );

-- ---------------------------------------------------------------------------
-- STEP 7: Trigger seed_default_cost_center() — seeds 1 default CC for each
--   new unit inserted (e.g., when the Phase 7 backfill trigger fires for new
--   clinics, or when admin adds a unit manually).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_cost_center()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cost_centers (clinic_id, unit_id, name, is_default, ativo)
  SELECT NEW.clinic_id, NEW.id, NEW.name, true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cost_centers cc
    WHERE cc.unit_id = NEW.id AND cc.is_default = true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_cost_center_on_unit
  AFTER INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_cost_center();

-- ---------------------------------------------------------------------------
-- STEP 8: Backfill financial_transactions.account_id via category
--   Idempotent: only updates rows where account_id IS NULL.
-- ---------------------------------------------------------------------------
UPDATE public.financial_transactions ft
SET account_id = fc.account_id
FROM public.financial_categories fc
WHERE ft.category_id = fc.id
  AND fc.account_id IS NOT NULL
  AND ft.account_id IS NULL;

-- ---------------------------------------------------------------------------
-- STEP 9: Backfill financial_transactions.cost_center_id via tenant default CC
--   financial_transactions has no unit_id — use the earliest default CC of the
--   tenant as universal fallback (RESEARCH Open Q2, D-03b).
--   Idempotent: only updates rows where cost_center_id IS NULL.
-- ---------------------------------------------------------------------------
UPDATE public.financial_transactions ft
SET cost_center_id = cc.id
FROM public.cost_centers cc
WHERE cc.clinic_id  = ft.tenant_id
  AND cc.is_default = true
  AND ft.cost_center_id IS NULL
  AND cc.id = (
    SELECT c2.id
    FROM public.cost_centers c2
    WHERE c2.clinic_id = ft.tenant_id AND c2.is_default = true
    ORDER BY c2.created_at
    LIMIT 1
  );

-- ---------------------------------------------------------------------------
-- STEP 10: Assertion — 0 legacy rows left without cost_center_id when a
--   resolvable default CC exists. RAISE EXCEPTION aborts the migration atomically
--   if any tenant has both transactions (cost_center_id IS NULL) and a default CC.
--   Rows whose tenant has NO default CC legitimately stay NULL (excluded by EXISTS).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_unresolved INT;
BEGIN
  SELECT count(*) INTO v_unresolved
  FROM public.financial_transactions ft
  WHERE ft.cost_center_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cost_centers cc
      WHERE cc.clinic_id = ft.tenant_id AND cc.is_default = true
    );

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'Phase14 backfill: % financial_transactions rows left without cost_center_id despite a default CC existing', v_unresolved;
  END IF;
END $$;
