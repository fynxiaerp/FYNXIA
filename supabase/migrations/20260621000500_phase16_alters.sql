-- =============================================================================
-- Migration: 20260621000500_phase16_alters.sql
-- Phase: 16-contas-a-pagar-conciliacao-tributos / Plan 03 — Task 2
-- Purpose: ALTER existing tables for Phase 16 features + next_rpa_number SECURITY DEFINER
--          + forward-ref FKs deferred from Plan 02 and Task 1.
--
-- Requirements: FOP-03, TRIB-01, TRIB-02, TRIB-03, D-26
-- BLOCKING: requires db push (Plan 05) to take effect in production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. financial_transactions: add reconciliation_status + statement_line_id (FOP-03, D-08)
--    reconciliation_status tracks position in the conciliation pipeline:
--      pendente   = not yet matched against any bank statement line
--      baixado    = matched manually or by rule (1:1 or N:1)
--      conciliado = confirmed by the exact-match or fuzzy-match pipeline
--    Partial index on non-conciliado rows keeps the conciliation query fast.
--    statement_line_id: FK to the statement_lines row that closed this transaction.
-- ---------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT
    NOT NULL DEFAULT 'pendente'
    CHECK (reconciliation_status IN ('pendente', 'baixado', 'conciliado')),
  ADD COLUMN IF NOT EXISTS statement_line_id UUID
    REFERENCES public.statement_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ft_reconciliation_status
  ON public.financial_transactions(tenant_id, reconciliation_status)
  WHERE reconciliation_status != 'conciliado';

-- ---------------------------------------------------------------------------
-- 2. bank_accounts: add data_abertura + saldo_atual (D-12)
--    saldo_atual: derived on write (updated by reconciliation actions); default 0.
--    data_abertura: account opening date; nullable (may not be known for imported accounts).
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS data_abertura DATE,
  ADD COLUMN IF NOT EXISTS saldo_atual   NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. professionals: add supplier_id FK (D-01 link — professional as RPA supplier)
--    Professional who is also a registered supplier (autonomo/pj) links here so
--    RPA records can reference both professional_id and supplier_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS supplier_id UUID
    REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. integration_connectors.type CHECK: add 'reinf' and 'open_finance' (D-22, TRIB-03)
--    The original inline CHECK constraint in 20260615000400_integration_connectors.sql
--    was created WITHOUT an explicit name, so PostgreSQL auto-generated:
--    integration_connectors_type_check
--    We drop the auto-named constraint and replace with a named one that includes
--    the two new connector types required for Phase 16.
--    ConnectorType in src/lib/integrations/types.ts must be updated in a separate
--    application-code plan to add 'reinf' | 'open_finance' to the union.
-- ---------------------------------------------------------------------------
ALTER TABLE public.integration_connectors
  DROP CONSTRAINT IF EXISTS integration_connectors_type_check;

ALTER TABLE public.integration_connectors
  ADD CONSTRAINT integration_connectors_type_check
    CHECK (type IN ('asaas', 'whatsapp', 'email', 'nfse', 'banco', 'tiss', 'reinf', 'open_finance'));

-- ---------------------------------------------------------------------------
-- 5. Forward-ref FKs (deferred from Plan 02 / Task 1 — both target tables now exist)
--
--    a) payables.payout_id → professional_payouts(id)
--       payables was created in 20260621000100 with payout_id as a plain UUID.
--       A comment in that file marks it as "deferred FK — see Plan 03 alters".
--
--    b) rpa_records.reinf_event_id → reinf_events(id)
--       rpa_records was created in 20260621000300 with reinf_event_id as a plain UUID.
-- ---------------------------------------------------------------------------
ALTER TABLE public.payables
  ADD CONSTRAINT fk_payables_payout
    FOREIGN KEY (payout_id) REFERENCES public.professional_payouts(id) ON DELETE SET NULL;

ALTER TABLE public.rpa_records
  ADD CONSTRAINT fk_rpa_reinf_event
    FOREIGN KEY (reinf_event_id) REFERENCES public.reinf_events(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 6. next_rpa_number(p_unit_id UUID) — SECURITY DEFINER atomic sequential RPA number (D-26)
--    Mirrors next_os_number() from 20260620000200_faturamento_os_tables.sql exactly.
--    T-16-08: SECURITY DEFINER + fixed search_path prevents race conditions (Pitfall 2).
--    Uses INSERT ON CONFLICT to auto-initialize the counter on first call per unit.
--    Returns 'RPA-' || LPAD(seq, 6, '0') — e.g., 'RPA-000001'.
--    No unit token in the string: the uniqueness is enforced by UNIQUE INDEX on (clinic_id, numero).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_rpa_number(p_unit_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.unit_rpa_counters (unit_id, clinic_id, last_rpa_number)
  SELECT u.id, u.clinic_id, 0 FROM public.units u WHERE u.id = p_unit_id
  ON CONFLICT (unit_id) DO NOTHING;

  UPDATE public.unit_rpa_counters
    SET last_rpa_number = last_rpa_number + 1
    WHERE unit_id = p_unit_id
  RETURNING last_rpa_number INTO next_num;

  RETURN 'RPA-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;
