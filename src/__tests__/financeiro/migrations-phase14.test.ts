/**
 * Phase 14 — Financeiro Cadastros Base — Migration source-inspection (FCAD-01, FCAD-02)
 * Test type: source-inspection via readFileSync (Phase 3 pattern)
 *
 * All assertions are intentionally RED until Plans 02/03 create the 3 migration files.
 * Empty-string fallback (existsSync guard) ensures tests FAIL (not skip) while files are absent.
 *
 * Requirements encoded:
 *   FCAD-01 — chart_of_accounts, cost_centers, bank_accounts tables + indexes + seed
 *   FCAD-02 — financial_transactions expansion (account_id, cost_center_id, bank_account_id, backfill)
 *   T-14-01 — RLS SELECT: clinic_id = get_my_tenant_id() on all 3 tables
 *   T-14-02 — RLS WRITE: get_my_role() IN ('admin','superadmin') in BOTH USING and WITH CHECK
 *   T-14-03 — required classification (account_id/cost_center_id) encoded in Zod (Plan 03)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── File paths ──────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

const TABLES_FILE = join(MIGRATIONS_DIR, '20260619001100_financial_cadastros_tables.sql')
const RLS_FILE    = join(MIGRATIONS_DIR, '20260619001200_financial_cadastros_rls.sql')
const SEED_FILE   = join(MIGRATIONS_DIR, '20260619001300_financial_cadastros_seed.sql')

// Empty string when missing → assertions FAIL RED (desired Wave 0 state)
const tablesSQL = existsSync(TABLES_FILE) ? readFileSync(TABLES_FILE, 'utf-8') : ''
const rlsSQL    = existsSync(RLS_FILE)    ? readFileSync(RLS_FILE,    'utf-8') : ''
const seedSQL   = existsSync(SEED_FILE)   ? readFileSync(SEED_FILE,   'utf-8') : ''

// ─── Tables migration (20260619001100) ───────────────────────────────────────

describe('Phase 14 tables migration (20260619001100) — chart_of_accounts', () => {
  it('creates the chart_of_accounts table', () => {
    expect(tablesSQL).toMatch(/CREATE TABLE public\.chart_of_accounts/)
  })

  it('has self-referential parent_id with ON DELETE RESTRICT', () => {
    expect(tablesSQL).toMatch(
      /parent_id\s+UUID\s+REFERENCES public\.chart_of_accounts\(id\) ON DELETE RESTRICT/
    )
  })

  it('has code column TEXT NOT NULL', () => {
    expect(tablesSQL).toMatch(/code\s+TEXT\s+NOT NULL/)
  })

  it('has type CHECK constrained to grupo/receita/despesa', () => {
    expect(tablesSQL).toMatch(
      /type\s+TEXT\s+NOT NULL CHECK \(type IN \('grupo', 'receita', 'despesa'\)\)/
    )
  })

  it('has clinic_id NOT NULL FK to clinics with ON DELETE CASCADE', () => {
    expect(tablesSQL).toMatch(
      /clinic_id\s+UUID\s+NOT NULL REFERENCES public\.clinics\(id\) ON DELETE CASCADE/
    )
  })

  it('has ativo BOOLEAN NOT NULL DEFAULT true', () => {
    expect(tablesSQL).toMatch(/ativo\s+BOOLEAN\s+NOT NULL DEFAULT true/)
  })

  it('has idx_chart_of_accounts_clinic index', () => {
    expect(tablesSQL).toMatch(/idx_chart_of_accounts_clinic/)
  })

  it('has unique index idx_chart_of_accounts_code on (clinic_id, code)', () => {
    expect(tablesSQL).toMatch(
      /CREATE UNIQUE INDEX idx_chart_of_accounts_code ON public\.chart_of_accounts\(clinic_id, code\)/
    )
  })
})

describe('Phase 14 tables migration (20260619001100) — cost_centers', () => {
  it('creates the cost_centers table', () => {
    expect(tablesSQL).toMatch(/CREATE TABLE public\.cost_centers/)
  })

  it('has unit_id NOT NULL FK to units', () => {
    expect(tablesSQL).toMatch(
      /unit_id\s+UUID\s+NOT NULL REFERENCES public\.units\(id\)/
    )
  })

  it('has is_default BOOLEAN NOT NULL DEFAULT false', () => {
    expect(tablesSQL).toMatch(/is_default\s+BOOLEAN\s+NOT NULL DEFAULT false/)
  })

  it('has partial unique index idx_cost_centers_one_default WHERE is_default = true', () => {
    expect(tablesSQL).toMatch(
      /CREATE UNIQUE INDEX idx_cost_centers_one_default ON public\.cost_centers\(unit_id\) WHERE is_default = true/
    )
  })

  it('has idx_cost_centers_clinic index', () => {
    expect(tablesSQL).toMatch(/idx_cost_centers_clinic/)
  })
})

describe('Phase 14 tables migration (20260619001100) — bank_accounts', () => {
  it('creates the bank_accounts table', () => {
    expect(tablesSQL).toMatch(/CREATE TABLE public\.bank_accounts/)
  })

  it('has saldo_inicial NUMERIC(12,2) (CLAUDE.md: money = NUMERIC(12,2))', () => {
    expect(tablesSQL).toMatch(/saldo_inicial\s+NUMERIC\(12,2\)/)
  })

  it('has idx_bank_accounts_clinic index', () => {
    expect(tablesSQL).toMatch(/idx_bank_accounts_clinic/)
  })
})

describe('Phase 14 tables migration (20260619001100) — financial_transactions ALTERs (FCAD-02)', () => {
  it('ALTERs financial_transactions table', () => {
    expect(tablesSQL).toMatch(/ALTER TABLE public\.financial_transactions/)
  })

  it('adds account_id UUID referencing chart_of_accounts', () => {
    expect(tablesSQL).toMatch(
      /ADD COLUMN IF NOT EXISTS account_id\s+UUID REFERENCES public\.chart_of_accounts\(id\)/
    )
  })

  it('adds cost_center_id UUID referencing cost_centers', () => {
    expect(tablesSQL).toMatch(
      /ADD COLUMN IF NOT EXISTS cost_center_id\s+UUID REFERENCES public\.cost_centers\(id\)/
    )
  })

  it('adds bank_account_id UUID referencing bank_accounts', () => {
    expect(tablesSQL).toMatch(
      /ADD COLUMN IF NOT EXISTS bank_account_id\s+UUID REFERENCES public\.bank_accounts\(id\)/
    )
  })

  it('has partial index idx_financial_transactions_account WHERE account_id IS NOT NULL', () => {
    expect(tablesSQL).toMatch(
      /idx_financial_transactions_account[\s\S]*WHERE account_id IS NOT NULL/s
    )
  })

  it('has partial index idx_financial_transactions_cost_center WHERE cost_center_id IS NOT NULL', () => {
    expect(tablesSQL).toMatch(
      /idx_financial_transactions_cost_center[\s\S]*WHERE cost_center_id IS NOT NULL/s
    )
  })

  it('account_id column is NOT added with NOT NULL constraint (D-03b: stays NULLABLE)', () => {
    // Columns must be NULLABLE — NOT NULL on financial_transactions new cols is forbidden
    expect(tablesSQL).not.toMatch(/account_id\s+UUID[^,]*NOT NULL/)
  })

  it('cost_center_id column is NOT added with NOT NULL constraint (D-03b: stays NULLABLE)', () => {
    expect(tablesSQL).not.toMatch(/cost_center_id\s+UUID[^,]*NOT NULL/)
  })
})

describe('Phase 14 tables migration (20260619001100) — financial_categories ALTER', () => {
  it('ALTERs financial_categories to add account_id', () => {
    expect(tablesSQL).toMatch(
      /ALTER TABLE public\.financial_categories[\s\S]*ADD COLUMN IF NOT EXISTS account_id\s+UUID REFERENCES public\.chart_of_accounts\(id\)/
    )
  })
})

// ─── RLS migration (20260619001200) ──────────────────────────────────────────

describe('Phase 14 RLS migration (20260619001200) — chart_of_accounts', () => {
  it('enables RLS on chart_of_accounts', () => {
    expect(rlsSQL).toMatch(
      /ALTER TABLE public\.chart_of_accounts ENABLE ROW LEVEL SECURITY/
    )
  })

  it('has tenant read policy using clinic_id = get_my_tenant_id()', () => {
    expect(rlsSQL).toMatch(
      /"chart_of_accounts_tenant_read"[\s\S]*FOR SELECT USING \(clinic_id = get_my_tenant_id\(\)\)/
    )
  })

  it('has admin write policy with BOTH USING and WITH CHECK (T-14-02)', () => {
    expect(rlsSQL).toMatch(
      /"chart_of_accounts_admin_write"[\s\S]*FOR ALL[\s\S]*USING \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)[\s\S]*WITH CHECK \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)/
    )
  })
})

describe('Phase 14 RLS migration (20260619001200) — cost_centers', () => {
  it('enables RLS on cost_centers', () => {
    expect(rlsSQL).toMatch(
      /ALTER TABLE public\.cost_centers ENABLE ROW LEVEL SECURITY/
    )
  })

  it('has tenant read policy', () => {
    expect(rlsSQL).toMatch(
      /"cost_centers_tenant_read"[\s\S]*FOR SELECT USING \(clinic_id = get_my_tenant_id\(\)\)/
    )
  })

  it('has admin write policy with BOTH USING and WITH CHECK', () => {
    expect(rlsSQL).toMatch(
      /"cost_centers_admin_write"[\s\S]*FOR ALL[\s\S]*USING \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)[\s\S]*WITH CHECK \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)/
    )
  })
})

describe('Phase 14 RLS migration (20260619001200) — bank_accounts', () => {
  it('enables RLS on bank_accounts', () => {
    expect(rlsSQL).toMatch(
      /ALTER TABLE public\.bank_accounts ENABLE ROW LEVEL SECURITY/
    )
  })

  it('has tenant read policy', () => {
    expect(rlsSQL).toMatch(
      /"bank_accounts_tenant_read"[\s\S]*FOR SELECT USING \(clinic_id = get_my_tenant_id\(\)\)/
    )
  })

  it('has admin write policy with BOTH USING and WITH CHECK', () => {
    expect(rlsSQL).toMatch(
      /"bank_accounts_admin_write"[\s\S]*FOR ALL[\s\S]*USING \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)[\s\S]*WITH CHECK \([\s\S]*clinic_id = get_my_tenant_id\(\)[\s\S]*get_my_role\(\) IN \('admin', 'superadmin'\)/
    )
  })
})

// ─── Seed migration (20260619001300) ─────────────────────────────────────────

describe('Phase 14 seed migration (20260619001300) — chart of accounts seed', () => {
  it('inserts into chart_of_accounts', () => {
    expect(seedSQL).toMatch(/INSERT INTO public\.chart_of_accounts/)
  })

  it('includes root code 1 Receitas', () => {
    expect(seedSQL).toMatch(/'1'.*'Receitas'/)
  })

  it('includes root code 2 Despesas', () => {
    expect(seedSQL).toMatch(/'2'.*'Despesas'/)
  })

  it('includes leaf 1.1.1 Consultas', () => {
    expect(seedSQL).toMatch(/'1\.1\.1'.*'Consultas'/)
  })

  it('includes leaf 2.1.4 Laboratório', () => {
    expect(seedSQL).toMatch(/'2\.1\.4'.*'Laboratório'/)
  })
})

describe('Phase 14 seed migration (20260619001300) — trigger ordering (Pitfall 5)', () => {
  it('creates trigger seed_accounts_on_clinic AFTER INSERT ON clinics', () => {
    expect(seedSQL).toMatch(
      /CREATE TRIGGER seed_accounts_on_clinic\s+AFTER INSERT ON public\.clinics/
    )
  })

  it('references function seed_chart_of_accounts', () => {
    expect(seedSQL).toMatch(/FUNCTION public\.seed_chart_of_accounts\(\)/)
  })
})

describe('Phase 14 seed migration (20260619001300) — seed_financial_categories update', () => {
  it('re-creates seed_financial_categories function to include account_id mapping', () => {
    expect(seedSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.seed_financial_categories\(\)/
    )
  })
})

describe('Phase 14 seed migration (20260619001300) — cost_centers default seed', () => {
  it('inserts default CC per unit via SELECT FROM units', () => {
    expect(seedSQL).toMatch(/INSERT INTO public\.cost_centers[\s\S]*FROM public\.units/)
  })
})

describe('Phase 14 seed migration (20260619001300) — backfill', () => {
  it('backfills financial_categories.account_id', () => {
    expect(seedSQL).toMatch(/UPDATE public\.financial_categories[\s\S]*SET account_id/)
  })

  it('backfills financial_transactions.account_id via category', () => {
    expect(seedSQL).toMatch(/UPDATE public\.financial_transactions[\s\S]*SET account_id = fc\.account_id/)
  })

  it('backfills financial_transactions.cost_center_id via default CC', () => {
    expect(seedSQL).toMatch(/UPDATE public\.financial_transactions[\s\S]*SET cost_center_id/)
  })

  it('backfill references is_default = true for CC resolution', () => {
    expect(seedSQL).toMatch(/is_default = true/)
  })

  it('has a DO block or RAISE/ASSERT confirming cost_center backfill completeness', () => {
    // Backfill assertion block — verifies 0 unresolved rows or raises exception
    expect(seedSQL).toMatch(/ASSERT|RAISE EXCEPTION|0 rows/)
  })
})
