-- =============================================================================
-- Migration: 20260621000100_payables_tables.sql
-- Phase: 16-contas-a-pagar-concilia-o-tributos / Plan 02
-- Purpose: Create payable-side tables for FOP-01 (Contas a Pagar):
--   suppliers         (D-01)  — cadastro de fornecedores com suporte a autônomos/PJ
--   payables          (D-02/D-04) — contas a pagar com parcelas e origem rastreável
--   payable_installments (D-04) — parcelas de uma conta a pagar
--   recorrente_templates (D-02b) — templates para geração de despesas recorrentes
--
-- Requirements: FOP-01
-- Dependencies:
--   public.clinics(id), public.units(id), public.users(id)
--   public.bank_accounts(id)     — 20260619001100
--   public.chart_of_accounts(id) — 20260619001100
--   public.cost_centers(id)      — 20260619001100
--   public.financial_transactions(id) — 20260606000100
--   public.professionals(id)     — 20260617000100
--   public.prosthetic_labs(id)   — 20260619000300
--   public.lab_orders(id)        — 20260619000300
--
-- Conventions (CLAUDE.md):
--   - NUMERIC(12,2) for all money columns
--   - clinic_id indexed on every table
--   - USING + WITH CHECK on RLS (RLS applied in 20260621000600_phase16_rls.sql)
--   - No RLS here — all Phase 16 RLS is in 20260621000600
--
-- Deferred FKs (Plan 03 — 20260621000500_phase16_alters.sql):
--   payables.payout_id → professional_payouts(id)   (D-02d: forward reference)
--   payables.recorrente_template_id → recorrente_templates(id) (D-02b: circular)
-- =============================================================================

-- ── suppliers (D-01) ─────────────────────────────────────────────────────────
-- Fornecedores incluem laboratórios, prestadores de materiais, serviços, autônomos e PJ.
-- modalidade_inss e iss_retido_fonte/iss_override são configuráveis por fornecedor
-- (RESEARCH Open Questions 1/2 — não hardcoded para suportar ambos os regimes).
CREATE TABLE public.suppliers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('laboratorio', 'material', 'servico', 'autonomo', 'pj', 'outro')),
  cnpj_cpf        TEXT,
  pix_key         TEXT,
  banco           TEXT,
  agencia         TEXT,
  conta           TEXT,
  vinculo         TEXT        CHECK (vinculo IN ('clt', 'pj', 'autonomo')),  -- para profissionais
  professional_id UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,  -- link D-01
  lab_id          UUID        REFERENCES public.prosthetic_labs(id) ON DELETE SET NULL, -- link D-01
  -- INSS: '11pct' = 11% flat com teto (Lei 8.212/91 art.21 §2 — autônomo p/ empresa)
  -- 'progressivo' = tabela progressiva 7,5%–14% (autônomo p/ pessoa física)
  modalidade_inss TEXT        NOT NULL DEFAULT '11pct'
                  CHECK (modalidade_inss IN ('11pct', 'progressivo')),
  iss_retido_fonte BOOLEAN    NOT NULL DEFAULT false,
  iss_override    NUMERIC(5,4),   -- alíquota ISS específica do fornecedor; NULL = usa tabela ISS
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_clinic   ON public.suppliers(clinic_id);
CREATE INDEX idx_suppliers_cnpj_cpf ON public.suppliers(cnpj_cpf) WHERE cnpj_cpf IS NOT NULL;

-- ── payables (D-02, D-04) ────────────────────────────────────────────────────
-- Contas a pagar geradas manualmente, via recorrência, lab, repasse ou tributo.
-- payout_id: FK to professional_payouts added in 20260621000500 (Plan 03) — D-02d forward ref.
-- recorrente_template_id: FK to recorrente_templates added in 20260621000500 — D-02b circular ref.
CREATE TABLE public.payables (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                UUID        REFERENCES public.units(id),
  supplier_id            UUID        REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  account_id             UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id         UUID        REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  bank_account_id        UUID        REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  descricao              TEXT        NOT NULL,
  valor_total            NUMERIC(12,2) NOT NULL,
  origem                 TEXT        NOT NULL DEFAULT 'manual'
                         CHECK (origem IN ('manual', 'recorrente', 'lab', 'repasse', 'tributo')),
  lab_order_id           UUID        REFERENCES public.lab_orders(id) ON DELETE SET NULL,   -- D-02c
  -- FK to professional_payouts added in 20260621000500_phase16_alters.sql (D-02d forward ref)
  payout_id              UUID,
  status                 TEXT        NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  -- FK to recorrente_templates added in 20260621000500_phase16_alters.sql (D-02b circular ref)
  recorrente_template_id UUID,
  competencia            TEXT,       -- 'YYYY-MM' para tributos/repasses
  notes                  TEXT,
  document_id            UUID,       -- D-27 anexo (bucket Fase 8)
  created_by             UUID        REFERENCES public.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payables_clinic   ON public.payables(clinic_id);
CREATE INDEX idx_payables_supplier ON public.payables(supplier_id);
CREATE INDEX idx_payables_status   ON public.payables(clinic_id, status);
CREATE INDEX idx_payables_unit     ON public.payables(unit_id);

-- ── payable_installments (D-04) ──────────────────────────────────────────────
-- Parcelas de uma conta a pagar. Uma payable com pagamento à vista terá 1 parcela.
-- financial_transaction_id: link à transação de caixa criada no baixa (baixarPayable).
CREATE TABLE public.payable_installments (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payable_id               UUID        NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  numero                   INT         NOT NULL DEFAULT 1,
  valor                    NUMERIC(12,2) NOT NULL,
  due_date                 DATE        NOT NULL,
  paid_at                  TIMESTAMPTZ,
  valor_pago               NUMERIC(12,2),
  financial_transaction_id UUID        REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  status                   TEXT        NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payable_inst_clinic  ON public.payable_installments(clinic_id);
CREATE INDEX idx_payable_inst_payable ON public.payable_installments(payable_id);
CREATE INDEX idx_payable_inst_due     ON public.payable_installments(clinic_id, due_date);

-- ── recorrente_templates (D-02b) ─────────────────────────────────────────────
-- Templates para geração automática de contas a pagar recorrentes (ex: aluguel, mensalidades).
-- dia_vencimento BETWEEN 1 AND 28: 28 = dia máximo seguro (evita fevereiro com 28 dias).
-- payables geradas apontam para recorrente_template_id (FK adicionada em Plan 03).
CREATE TABLE public.recorrente_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id),
  supplier_id     UUID        REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  account_id      UUID        REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id  UUID        REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  descricao       TEXT        NOT NULL,
  valor           NUMERIC(12,2) NOT NULL,
  dia_vencimento  SMALLINT    NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),  -- 28 = max safe
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recorrente_clinic ON public.recorrente_templates(clinic_id);
