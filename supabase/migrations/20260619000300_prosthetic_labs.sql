-- =============================================================================
-- Migration: 20260619000300_prosthetic_labs.sql
-- Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 03
-- Purpose: Laboratório de Prótese tables (LAB-01/LAB-02):
--   - public.prosthetic_labs: reusable supplier record (D-03)
--   - public.lab_orders:      OS protética — tipo, lab, prazo, stages JSONB,
--                             status enviado→prova→concluído, cost, and
--                             financial_transaction_id FK linking the LAB-02
--                             despesa back to the OS (D-04)
--
-- Security: RLS in 20260619000400_lab_orders_rls.sql
-- CRITICAL: Do NOT alter public.financial_transactions (only ADD FK column ON lab_orders)
--           Do NOT touch public.appointments or its GIST (frozen in Phase 1)
-- NOTE: db push happens in Plan 05 (BLOCKING step) — NOT here.
-- =============================================================================

-- ─── public.prosthetic_labs ───────────────────────────────────────────────────
-- Reusable dental lab supplier record, scoped per clinic (D-03).
-- Soft-deleted via deleted_at (LGPD).
-- RLS: ENABLE ROW LEVEL SECURITY + policies in 20260619000400_lab_orders_rls.sql

CREATE TABLE public.prosthetic_labs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  cnpj          TEXT,
  contato_nome  TEXT,
  telefone      TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ                       -- LGPD soft delete
);

-- Mandatory index (CLAUDE.md: index every clinic_id column)
CREATE INDEX idx_prosthetic_labs_clinic ON public.prosthetic_labs(clinic_id);

-- ─── public.lab_orders ───────────────────────────────────────────────────────
-- OS protética (Ordem de Serviço para laboratório de prótese) — LAB-01/LAB-02.
-- stages JSONB: array of { nome, prevista?, concluida_em? } (etapas de prova)
-- status CHECK: enviado → prova → concluido
-- cost NUMERIC(12,2): when set → Plan 04 action inserts a despesa in
--   financial_transactions and backfills financial_transaction_id (LAB-02).
-- financial_transaction_id: FK pointing AT financial_transactions(id).
--   This plan ONLY adds the FK column ON lab_orders — financial_transactions
--   itself is NOT altered (T-13-11).
-- Soft-deleted via deleted_at (LGPD).
-- RLS: ENABLE ROW LEVEL SECURITY + policies in 20260619000400_lab_orders_rls.sql

CREATE TABLE public.lab_orders (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                   UUID        REFERENCES public.units(id),
  lab_id                    UUID        NOT NULL REFERENCES public.prosthetic_labs(id),
  patient_id                UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id            UUID        REFERENCES public.appointments(id),
  order_number              TEXT,                    -- optional human label e.g. OS-YYYY-####
  prosthesis_type           TEXT        NOT NULL,    -- tipo de prótese (free text)
  due_date                  DATE,                    -- prazo previsto de entrega
  stages                    JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- etapas de prova
  status                    TEXT        NOT NULL DEFAULT 'enviado'
                            CHECK (status IN ('enviado', 'prova', 'concluido')),
  cost                      NUMERIC(12,2),           -- custo do lab; quando definido → gera despesa (LAB-02)
  financial_transaction_id  UUID        REFERENCES public.financial_transactions(id),  -- D-04: links the despesa back to the OS
  notes                     TEXT,
  created_by                UUID        REFERENCES public.users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ              -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every clinic_id; multi-column where useful)
CREATE INDEX idx_lab_orders_clinic  ON public.lab_orders(clinic_id);
CREATE INDEX idx_lab_orders_lab     ON public.lab_orders(lab_id);
CREATE INDEX idx_lab_orders_patient ON public.lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status  ON public.lab_orders(clinic_id, status);
CREATE INDEX idx_lab_orders_unit    ON public.lab_orders(unit_id)
  WHERE unit_id IS NOT NULL;
CREATE INDEX idx_lab_orders_fin_txn ON public.lab_orders(financial_transaction_id)
  WHERE financial_transaction_id IS NOT NULL;
