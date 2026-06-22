-- =============================================================================
-- Migration: 20260621000200_reconciliation_tables.sql
-- Phase: 16-contas-a-pagar-concilia-o-tributos / Plan 02
-- Purpose: Create bank statement reconciliation tables for FOP-02:
--   bank_statements  (D-05) — cabeçalho do extrato importado (OFX/Open Finance)
--   statement_lines  (D-05/D-11) — linhas do extrato com idempotência FITID
--
-- Requirements: FOP-02, D-11 (FITID idempotency)
-- Dependencies:
--   public.clinics(id), public.users(id)
--   public.bank_accounts(id)          — 20260619001100
--   public.financial_transactions(id) — 20260606000100
--
-- Conventions (CLAUDE.md):
--   - NUMERIC(12,2) for all money columns
--   - clinic_id indexed on every table
--   - No RLS here — all Phase 16 RLS is in 20260621000600_phase16_rls.sql
--
-- CRITICAL — Pitfall 1 (D-11 FITID idempotency):
--   FITID uniqueness uses PARTIAL unique INDEXES (not table CONSTRAINTS).
--   Table-level UNIQUE constraints treat NULLs as distinct → duplicate rows
--   when fitid/fitid_fallback is NULL. Partial indexes with WHERE IS NOT NULL
--   enforce uniqueness only for non-NULL values (correct behavior).
-- =============================================================================

-- ── bank_statements (D-05) ───────────────────────────────────────────────────
-- Cabeçalho de um extrato bancário importado. Cada import de OFX ou fetch de
-- Open Finance cria uma linha aqui; as transações individuais ficam em statement_lines.
CREATE TABLE public.bank_statements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  bank_account_id UUID        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  fonte           TEXT        NOT NULL DEFAULT 'ofx' CHECK (fonte IN ('ofx', 'open_finance')),
  periodo_inicio  DATE        NOT NULL,
  periodo_fim     DATE        NOT NULL,
  filename        TEXT,
  imported_by     UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_statements_clinic  ON public.bank_statements(clinic_id);
CREATE INDEX idx_bank_statements_account ON public.bank_statements(bank_account_id);

-- ── statement_lines (D-05/D-11) ──────────────────────────────────────────────
-- Linhas individuais do extrato bancário.
-- amount: positivo = crédito; negativo = débito (convenção OFX).
-- fitid: identificador único da transação no OFX (FITID tag). NULL quando o banco
--   não emite FITID (raro mas acontece em alguns OFX brasileiros).
-- fitid_fallback: SHA-256 de (bank_account_id || date || amount || memo) calculado
--   na camada de aplicação quando fitid é NULL — garante dedup mesmo sem FITID.
-- matched_transaction_ids: UUID[] para conciliação N:1 (D-09).
-- fee_transaction_id: transação de taxa bancária separada no caixa (D-09).
--
-- Pitfall 1 (D-11): uniqueness via PARTIAL indexes (WHERE IS NOT NULL), não
-- CONSTRAINT na tabela. PostgreSQL trata NULLs como distintos em UNIQUE constraints,
-- o que causaria duplicatas quando fitid é NULL. Partial indexes resolvem isso.
CREATE TABLE public.statement_lines (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  bank_account_id         UUID        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  bank_statement_id       UUID        NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  fitid                   TEXT,       -- NULL quando fallback
  fitid_fallback          TEXT,       -- SHA-256 de (bank_account_id||date||amount||memo) quando sem FITID
  transaction_date        DATE        NOT NULL,
  amount                  NUMERIC(12,2) NOT NULL,   -- positivo = crédito; negativo = débito
  memo                    TEXT,
  check_number            TEXT,
  reconciliation_status   TEXT        NOT NULL DEFAULT 'pendente'
                          CHECK (reconciliation_status IN ('pendente', 'conciliado', 'ignorado')),
  matched_transaction_ids UUID[],     -- array para N:1
  fee_transaction_id      UUID        REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pitfall 1 — partial unique indexes para FITID idempotency (D-11):
-- WHERE IS NOT NULL garante que apenas valores não-nulos são verificados para unicidade.
-- Equivalente semântico a CONSTRAINT UNIQUE (bank_account_id, fitid) mas sem falha em NULLs.
-- Equivalente semântico a CONSTRAINT UNIQUE (bank_account_id, fitid_fallback) mas sem falha em NULLs.
CREATE UNIQUE INDEX uq_statement_line_fitid
  ON public.statement_lines(bank_account_id, fitid)
  WHERE fitid IS NOT NULL;

CREATE UNIQUE INDEX uq_statement_line_fitid_fallback
  ON public.statement_lines(bank_account_id, fitid_fallback)
  WHERE fitid_fallback IS NOT NULL;

CREATE INDEX idx_statement_lines_clinic  ON public.statement_lines(clinic_id);
CREATE INDEX idx_statement_lines_account ON public.statement_lines(bank_account_id);
CREATE INDEX idx_statement_lines_date    ON public.statement_lines(bank_account_id, transaction_date);
CREATE INDEX idx_statement_lines_recon   ON public.statement_lines(clinic_id, reconciliation_status)
  WHERE reconciliation_status = 'pendente';
