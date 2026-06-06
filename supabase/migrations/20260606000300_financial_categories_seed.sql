-- Phase 3: financial_categories seed function + trigger (D-05)
-- Creates default dental income and expense categories for each new clinic.
-- Also backfills existing clinics that have no categories yet.

-- ============ seed_financial_categories trigger function ============
CREATE OR REPLACE FUNCTION public.seed_financial_categories()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
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
  RETURN NEW;
END;
$$;

-- ============ trigger: seed on new clinic creation ============
CREATE TRIGGER seed_categories_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_financial_categories();

-- ============ backfill: seed for existing clinics with no categories ============
INSERT INTO public.financial_categories (tenant_id, name, type, is_default)
SELECT
  c.id,
  cat.name,
  cat.type,
  true
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('Consulta',                'receita'),
    ('Tratamento Odontológico', 'receita'),
    ('Convênio',                'receita'),
    ('Outros',                  'receita'),
    ('Aluguel',                 'despesa'),
    ('Materiais Odontológicos', 'despesa'),
    ('Salários',                'despesa'),
    ('Laboratório',             'despesa'),
    ('Impostos',                'despesa'),
    ('Outros',                  'despesa')
) AS cat(name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_categories fc
  WHERE fc.tenant_id = c.id
);
