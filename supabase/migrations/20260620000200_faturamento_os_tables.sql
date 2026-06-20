-- =============================================================================
-- Migration: 20260620000200_faturamento_os_tables.sql
-- Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 03
-- Purpose: Create OS domain tables: insurers, appointment_procedures,
--          service_orders, service_order_items, nfse_records, unit_os_counters.
--          Includes next_os_number() SECURITY DEFINER function, charges ALTER
--          (D-20 caixa path), and deferred FK from insurer_prices → insurers.
--
-- Depends on: 20260620000100 (services, insurer_prices, glosa_motivos, unit_fiscal_config)
--
-- Requirements: OS-01, OS-02, OS-03, CONV-01, D-09, D-10, D-11, D-12, D-17,
--               D-25, D-27, D-29, D-30
--
-- D-27 CHECK constraints (verbatim locked):
--   OS status:    'rascunho', 'faturada', 'cancelada'
--   pagador:      'particular', 'convenio'
--   NFS-e status: 'processando', 'emitida', 'cancelada', 'erro'
--
-- NOTE: No RLS here — all RLS is in 20260620000400_faturamento_rls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. insurers (D-26, CONV-01)
--    Cadastro de operadoras de convênio.
--    connector_id links to integration hub (Phase 9) — nullable until configured.
--    prazo_pagamento_dias: default 30 days for TISS payment terms.
-- ---------------------------------------------------------------------------
CREATE TABLE public.insurers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  cnpj                 TEXT,
  registro_ans         TEXT,
  tiss_version         TEXT        NOT NULL DEFAULT '3.05.00',
  prazo_pagamento_dias INT         NOT NULL DEFAULT 30,
  contato_email        TEXT,
  contato_phone        TEXT,
  connector_id         UUID        REFERENCES public.integration_connectors(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'ativo'
                       CHECK (status IN ('ativo', 'em_negociacao', 'inativo')),
  ativo                BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insurers_clinic ON public.insurers(clinic_id);

-- ---------------------------------------------------------------------------
-- 2. appointment_procedures (D-09, OS-01)
--    Procedimentos executados em um atendimento.
--    Base for OS line items (snapshot at faturar time) and future Phase 17 stock draw.
--    service_id ON DELETE RESTRICT: prevents service deletion with procedure history.
--    professional_id ON DELETE SET NULL: safe — professional record stays in history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointment_procedures (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id   UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id       UUID        NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  quantity         INT         NOT NULL DEFAULT 1,
  valor_unitario   NUMERIC(12,2) NOT NULL,
  desconto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota             TEXT,
  dente            TEXT,
  face             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_procedures_clinic      ON public.appointment_procedures(clinic_id);
CREATE INDEX idx_appointment_procedures_appointment ON public.appointment_procedures(appointment_id);

-- ---------------------------------------------------------------------------
-- 3. service_orders (D-10, D-11, D-12, D-25, D-27, D-30, OS-01)
--    Ordem de Serviço. 1 per concluded appointment (or manual).
--    UNIQUE (clinic_id, numero): number unique per tenant.
--    Partial unique on appointment_id: exactly 1 OS per appointment (Pitfall 6 backstop).
--    Partial unique on idempotency_key: prevents duplicate faturar (D-30).
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id) ON DELETE RESTRICT,
  numero           TEXT        NOT NULL,
  patient_id       UUID        REFERENCES public.patients(id) ON DELETE RESTRICT,
  appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  pagador          TEXT        NOT NULL DEFAULT 'particular'
                   CHECK (pagador IN ('particular', 'convenio')),
  insurer_id       UUID        REFERENCES public.insurers(id) ON DELETE RESTRICT,
  status           TEXT        NOT NULL DEFAULT 'rascunho'
                   CHECK (status IN ('rascunho', 'faturada', 'cancelada')),
  desconto_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  acrescimo_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  idempotency_key  TEXT,
  faturada_at      TIMESTAMPTZ,
  cancelada_at     TIMESTAMPTZ,
  cancel_reason    TEXT,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, numero)
);

CREATE INDEX idx_service_orders_clinic  ON public.service_orders(clinic_id);
CREATE INDEX idx_service_orders_patient ON public.service_orders(patient_id);
CREATE INDEX idx_service_orders_status  ON public.service_orders(clinic_id, status);

-- OS-01: exactly 1 OS per appointment (Pitfall 6 — DB-level backstop for race condition T-15-09)
CREATE UNIQUE INDEX idx_service_orders_appointment
  ON public.service_orders(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- D-30: idempotency key unique — prevents duplicate faturar on double-click (T-15-10)
CREATE UNIQUE INDEX idx_service_orders_idem
  ON public.service_orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. service_order_items (D-25, D-29)
--    Lines of the OS (snapshots of appointment_procedures at faturar time, or manual).
--    professional_id: recorded for D-29 repasse (distribution) base (Phase 17).
--    account_id / cost_center_id: FCAD-02 classification (Phase 14).
--    service_order_id ON DELETE CASCADE: items deleted with parent OS.
--    service_id ON DELETE RESTRICT: prevents service deletion with item history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_order_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  service_order_id UUID        NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  service_id       UUID        REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id  UUID        REFERENCES public.professionals(id) ON DELETE SET NULL,
  description      TEXT        NOT NULL,
  tuss_code        TEXT,
  quantity         INT         NOT NULL DEFAULT 1,
  valor_unitario   NUMERIC(12,2) NOT NULL,
  desconto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total      NUMERIC(12,2) NOT NULL,
  dente            TEXT,
  face             TEXT,
  account_id       UUID        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id   UUID        REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_order_items_clinic ON public.service_order_items(clinic_id);
CREATE INDEX idx_service_order_items_os     ON public.service_order_items(service_order_id);

-- ---------------------------------------------------------------------------
-- 5. nfse_records (D-17, OS-02)
--    NFS-e per OS. 1 row per fiscal emission attempt.
--    D-27 NFS-e status enum: processando, emitida, cancelada, erro.
--    service_order_id ON DELETE RESTRICT: fiscal records must outlive OS for audit.
--    xml_storage_path / pdf_storage_path: D-17 bucket paths for storage.
-- ---------------------------------------------------------------------------
CREATE TABLE public.nfse_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id) ON DELETE RESTRICT,
  service_order_id UUID        REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  provider_ref     TEXT,
  numero           TEXT,
  serie            TEXT,
  valor_servicos   NUMERIC(12,2) NOT NULL,
  aliquota_iss     NUMERIC(5,4) NOT NULL,
  valor_iss        NUMERIC(12,2) NOT NULL,
  iss_retido       BOOLEAN      NOT NULL DEFAULT false,
  valor_liquido    NUMERIC(12,2) NOT NULL,
  tomador_nome     TEXT,
  status           TEXT        NOT NULL DEFAULT 'processando'
                   CHECK (status IN ('processando', 'emitida', 'cancelada', 'erro')),
  error_message    TEXT,
  xml_storage_path TEXT,
  pdf_storage_path TEXT,
  emitida_at       TIMESTAMPTZ,
  cancelada_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfse_records_clinic ON public.nfse_records(clinic_id);
CREATE INDEX idx_nfse_records_os     ON public.nfse_records(service_order_id);
CREATE INDEX idx_nfse_records_status ON public.nfse_records(clinic_id, status);

-- ---------------------------------------------------------------------------
-- 6. unit_os_counters — atomic per-unit OS sequential numbering (D-25/A1)
--    Separate from unit_fiscal_config.proximo_numero_rps (RPS ≠ OS).
--    One row per unit, auto-inserted on first next_os_number() call.
--    ON CONFLICT (unit_id) DO NOTHING on first use → then UPDATE increments.
-- ---------------------------------------------------------------------------
CREATE TABLE public.unit_os_counters (
  unit_id         UUID        PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  last_os_number  INT         NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 7. next_os_number(p_unit_id UUID) — SECURITY DEFINER atomic sequential OS number
--    D-25/A1: returns 'OS-000001', 'OS-000002', ... per unit.
--    T-15-11: SECURITY DEFINER + fixed search_path prevents cross-unit allocation.
--    Uses INSERT ... ON CONFLICT to auto-initialize the counter on first call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_os_number(p_unit_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.unit_os_counters (unit_id, clinic_id, last_os_number)
  SELECT u.id, u.clinic_id, 0 FROM public.units u WHERE u.id = p_unit_id
  ON CONFLICT (unit_id) DO NOTHING;

  UPDATE public.unit_os_counters
    SET last_os_number = last_os_number + 1
    WHERE unit_id = p_unit_id
  RETURNING last_os_number INTO next_num;

  RETURN 'OS-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. charges link (OS-03, D-20 caixa path)
--    ALTER charges to add service_order_id FK (nullable — existing charges have no OS).
--    ON DELETE SET NULL: charge stays valid if OS is somehow deleted (audit trail).
--    Index: for efficient charge lookup by OS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS service_order_id UUID
    REFERENCES public.service_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charges_service_order
  ON public.charges(service_order_id);

-- ---------------------------------------------------------------------------
-- 9. Deferred FK from Plan 02: insurer_prices.insurer_id → insurers
--    insurer_prices was created in 20260620000100 WITHOUT the FK because insurers
--    did not exist yet. Now that insurers exists, we add the constraint.
--    ON DELETE CASCADE: if an insurer is deleted, its price overrides are removed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.insurer_prices
  ADD CONSTRAINT fk_insurer_prices_insurer
  FOREIGN KEY (insurer_id)
  REFERENCES public.insurers(id)
  ON DELETE CASCADE;
