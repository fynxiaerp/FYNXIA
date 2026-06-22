-- =============================================================================
-- Migration: 20260621000300_payout_rpa_tables.sql
-- Phase: 16-contas-a-pagar-conciliacao-tributos / Plan 03 — Task 1
-- Purpose: Create 6 tables for professional payouts, RPA records, Reinf events,
--          and competência management.
--
-- Requirements: TRIB-01 (professional_payouts/payout_items), TRIB-02 (rpa_records,
--   unit_rpa_counters, competencia_fechamentos), TRIB-03 (reinf_events)
-- D-26: unit_rpa_counters + competencia_fechamentos (sequential numbering + closure)
--
-- NOTE: forward-ref FKs deferred to Plan 03 alters (20260621000500):
--   - payables.payout_id → professional_payouts(id)
--   - rpa_records.reinf_event_id → reinf_events(id)
-- Both are plain UUID columns here; ALTER TABLE ADD CONSTRAINT in the alters file.
--
-- Security:
--   T-16-06: clinic_id index on every tenant-scoped table (CLAUDE.md rule)
--   T-16-08: next_rpa_number SECURITY DEFINER in 20260621000500_phase16_alters.sql
--   RLS: enabled in 20260621000600_phase16_rls.sql
-- =============================================================================

-- ── professional_payouts (TRIB-01, D-13/D-14/D-15) ──────────────────────────
CREATE TABLE public.professional_payouts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID          REFERENCES public.units(id),
  professional_id UUID          NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  competencia     TEXT          NOT NULL,   -- 'YYYY-MM'
  valor_bruto     NUMERIC(12,2) NOT NULL,
  deducoes        JSONB         NOT NULL DEFAULT '{}',  -- {lab: 0, materiais: 0, taxa_cartao: 0, ...}
  valor_base      NUMERIC(12,2) NOT NULL,   -- bruto - deduções
  percentual      NUMERIC(5,4)  NOT NULL,   -- ex: 0.5000 para 50%
  valor_repasse   NUMERIC(12,2) NOT NULL,   -- base * percentual
  status          TEXT          NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'aprovado', 'pago')),
  payable_id      UUID          REFERENCES public.payables(id) ON DELETE SET NULL,  -- CP gerado D-15
  created_by      UUID          REFERENCES public.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, professional_id, competencia)
);

CREATE INDEX idx_payouts_clinic       ON public.professional_payouts(clinic_id);
CREATE INDEX idx_payouts_professional ON public.professional_payouts(professional_id);

-- ── payout_items (TRIB-01, D-13) ─────────────────────────────────────────────
CREATE TABLE public.payout_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payout_id           UUID          NOT NULL REFERENCES public.professional_payouts(id) ON DELETE CASCADE,
  service_order_id    UUID          REFERENCES public.service_orders(id) ON DELETE SET NULL,
  statement_line_id   UUID          REFERENCES public.statement_lines(id) ON DELETE SET NULL,
  descricao           TEXT          NOT NULL,
  valor_recebido      NUMERIC(12,2) NOT NULL,
  valor_base_item     NUMERIC(12,2) NOT NULL,   -- após deduções item-level
  percentual_item     NUMERIC(5,4)  NOT NULL,
  valor_repasse_item  NUMERIC(12,2) NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_items_payout ON public.payout_items(payout_id);
CREATE INDEX idx_payout_items_clinic ON public.payout_items(clinic_id);

-- ── rpa_records (TRIB-02, D-20) ──────────────────────────────────────────────
CREATE TABLE public.rpa_records (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id           UUID          REFERENCES public.units(id),
  supplier_id       UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  professional_id   UUID          REFERENCES public.professionals(id) ON DELETE SET NULL,
  payout_id         UUID          REFERENCES public.professional_payouts(id) ON DELETE SET NULL,
  numero            TEXT          NOT NULL,     -- 'RPA-000001' via next_rpa_number() (per-unit sequential)
  competencia       TEXT          NOT NULL,     -- 'YYYY-MM'
  data_pagamento    DATE          NOT NULL,
  valor_bruto       NUMERIC(12,2) NOT NULL,
  valor_inss        NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_irrf        NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_iss         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_liquido     NUMERIC(12,2) NOT NULL,
  aliquota_inss     NUMERIC(5,4),
  aliquota_irrf     NUMERIC(5,4),
  aliquota_iss      NUMERIC(5,4),
  municipio_ibge    TEXT,        -- para ISS
  regime_tributario TEXT,        -- snapshot do regime na data de emissão
  -- D-27: NUNCA retornar ao cliente; signed URL TTL=60s — Pitfall 7 (mirrors NFS-e storage_path)
  pdf_storage_path  TEXT,
  status            TEXT          NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho', 'emitido', 'cancelado')),
  payable_id        UUID          REFERENCES public.payables(id) ON DELETE SET NULL,
  reinf_event_id    UUID,        -- FK adicionada após reinf_events (ver 20260621000500_phase16_alters.sql)
  modalidade_inss   TEXT,
  created_by        UUID          REFERENCES public.users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpa_clinic      ON public.rpa_records(clinic_id);
CREATE INDEX idx_rpa_supplier    ON public.rpa_records(supplier_id);
CREATE INDEX idx_rpa_competencia ON public.rpa_records(clinic_id, competencia);
CREATE UNIQUE INDEX idx_rpa_numero ON public.rpa_records(clinic_id, numero);

-- ── reinf_events (TRIB-03, D-18/D-22) ────────────────────────────────────────
CREATE TABLE public.reinf_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id),
  tipo            TEXT        NOT NULL CHECK (tipo IN ('R2010', 'R4020')),
  competencia     TEXT        NOT NULL,
  provider_ref    TEXT,        -- stub: 'stub-reinf:...'
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'transmitido', 'erro', 'retificado')),
  protocolo       TEXT,
  payload         JSONB       NOT NULL,   -- campos do evento para geração eventual do XML
  error_message   TEXT,
  idempotency_key TEXT        NOT NULL,
  created_by      UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, idempotency_key)
);

CREATE INDEX idx_reinf_clinic      ON public.reinf_events(clinic_id);
CREATE INDEX idx_reinf_competencia ON public.reinf_events(clinic_id, competencia);

-- ── unit_rpa_counters (D-26 — per-unit sequential RPA numbering) ──────────────
-- Mirrors unit_os_counters from 20260620000200_faturamento_os_tables.sql.
-- next_rpa_number() SECURITY DEFINER function defined in 20260621000500_phase16_alters.sql.
CREATE TABLE public.unit_rpa_counters (
  unit_id         UUID  PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id       UUID  NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  last_rpa_number INT   NOT NULL DEFAULT 0
);

-- ── competencia_fechamentos (D-26 — monthly period closure) ──────────────────
-- INSERT INTO competencia_fechamentos blocks new repasses/RPAs for that competência.
-- Conciliações após o fechamento: competencia = next_competencia(fechado).
CREATE TABLE public.competencia_fechamentos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id     UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  competencia TEXT        NOT NULL,   -- 'YYYY-MM'
  fechado_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_por UUID        REFERENCES public.users(id),
  UNIQUE(clinic_id, unit_id, competencia)
);

CREATE INDEX idx_competencia_clinic ON public.competencia_fechamentos(clinic_id);
