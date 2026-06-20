-- =============================================================================
-- Migration: 20260619001100_financial_cadastros_tables.sql
-- Phase: 14-financeiro-cadastros-base / Plan 02
-- Purpose: Create 3 new cadastro-de-rede tables (chart_of_accounts, cost_centers,
--          bank_accounts) and expand financial_transactions / financial_categories
--          with NULLABLE classification columns.
-- FCAD-01: chart_of_accounts (adjacency list, clinic_id-scoped, hierarchical)
-- FCAD-01: cost_centers (unit_id FK, 1 default per unit via partial unique index)
-- FCAD-01: bank_accounts (saldo_inicial NUMERIC(12,2))
-- FCAD-02: financial_transactions: account_id, cost_center_id, bank_account_id (NULLABLE)
-- FCAD-02: financial_categories: account_id column added
-- SEC:     TIMESTAMPTZ on all timestamps; ativo soft-delete (no PII => no deleted_at).
-- INDEXES: clinic_id indexed on all 3 tables (CLAUDE.md: index every clinic_id).
--          Partial unique index for is_default=true on cost_centers(unit_id).
--          Unique index (clinic_id, code) on chart_of_accounts.
--          Partial indexes WHERE IS NOT NULL on new financial_transactions cols.
-- AUDIT:   audit_units_changes() trigger attached to all 3 new tables
--          (uses NEW.clinic_id — compatible with all 3 tables).
-- IMPORTANT: New cols on financial_transactions are NULLABLE by design (D-03b).
--            Enforcing required classification is done in the Server Action only.
--            Backfill runs in 20260619001300_financial_cadastros_seed.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. chart_of_accounts — hierarchical plan of accounts (adjacency list)
--    parent_id ON DELETE RESTRICT: prevents deleting a node that has children.
--    clinic_id ON DELETE CASCADE: removes all accounts when the tenant is deleted.
--    Unique (clinic_id, code): prevents duplicate account codes within a tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE public.chart_of_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('grupo', 'receita', 'despesa')),
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. cost_centers — cost centers tied to a unit within the rede
--    unit_id ON DELETE RESTRICT: prevents deleting a unit that has cost centers.
--    clinic_id ON DELETE CASCADE: removes all CCs when the tenant is deleted.
--    Partial unique (unit_id) WHERE is_default = true: 1 default CC per unit.
-- ---------------------------------------------------------------------------
CREATE TABLE public.cost_centers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id     UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. bank_accounts — bank account cadastro for the rede
--    clinic_id ON DELETE CASCADE: removes all bank accounts when tenant deleted.
--    saldo_inicial NUMERIC(12,2): CLAUDE.md money convention.
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  banco         TEXT,
  agencia       TEXT,
  conta         TEXT,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. ALTER financial_transactions — NULLABLE classification columns (FCAD-02, D-03b)
--    account_id and cost_center_id are NULLABLE here; Server Action enforces
--    required for manual entries only (webhook auto-posts may legitimately have NULL).
-- ---------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS account_id      UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cost_center_id  UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. ALTER financial_categories — add account_id mapping (FCAD-01, D-02a)
--    ON DELETE SET NULL: if a chart account is deleted, category mapping clears.
--    Backfill by name match runs in the seed migration (20260619001300).
-- ---------------------------------------------------------------------------
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Indexes on chart_of_accounts
-- ---------------------------------------------------------------------------
-- Tenant-scoped lookups (mandatory — CLAUDE.md: index every clinic_id)
CREATE INDEX idx_chart_of_accounts_clinic ON public.chart_of_accounts(clinic_id);

-- Parent lookups within a clinic (tree traversal)
CREATE INDEX idx_chart_of_accounts_parent ON public.chart_of_accounts(clinic_id, parent_id);

-- Unique: code is unique per tenant
CREATE UNIQUE INDEX idx_chart_of_accounts_code ON public.chart_of_accounts(clinic_id, code);

-- ---------------------------------------------------------------------------
-- Indexes on cost_centers
-- ---------------------------------------------------------------------------
CREATE INDEX idx_cost_centers_clinic ON public.cost_centers(clinic_id);
CREATE INDEX idx_cost_centers_unit   ON public.cost_centers(unit_id);

-- Partial unique: only one default cost center per unit (D-01a)
CREATE UNIQUE INDEX idx_cost_centers_one_default ON public.cost_centers(unit_id) WHERE is_default = true;

-- ---------------------------------------------------------------------------
-- Indexes on bank_accounts
-- ---------------------------------------------------------------------------
CREATE INDEX idx_bank_accounts_clinic ON public.bank_accounts(clinic_id);

-- ---------------------------------------------------------------------------
-- Partial indexes on financial_transactions new columns
-- WHERE IS NOT NULL: efficient since most legacy rows start NULL until backfill
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account
  ON public.financial_transactions(account_id) WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_cost_center
  ON public.financial_transactions(cost_center_id) WHERE cost_center_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Audit triggers on the 3 new tables
-- All 3 tables use clinic_id (not tenant_id) — audit_units_changes() reads
-- NEW.clinic_id (verified in 20260614000100_units_table.sql) and is compatible.
-- SECURITY DEFINER inserts into audit_logs as the function owner.
-- ---------------------------------------------------------------------------
CREATE TRIGGER audit_chart_of_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_units_changes();

CREATE TRIGGER audit_cost_centers
  AFTER INSERT OR UPDATE OR DELETE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.audit_units_changes();

CREATE TRIGGER audit_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_units_changes();
