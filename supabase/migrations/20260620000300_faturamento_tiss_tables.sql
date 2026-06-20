-- =============================================================================
-- Migration: 20260620000300_faturamento_tiss_tables.sql
-- Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 03
-- Purpose: Create TISS domain tables: tiss_lotes, tiss_guides, tiss_guide_items.
--
-- Depends on: 20260620000100 (glosa_motivos), 20260620000200 (insurers, service_orders,
--             service_order_items)
--
-- Requirements: CONV-02, CONV-03, D-13, D-22, D-28
--
-- D-27 CHECK constraints (verbatim locked):
--   TISS status (lotes + guides): 'em_analise', 'autorizada', 'glosada', 'paga', 'recurso'
--   glosa_status (items):         'pendente', 'glosada', 'em_recurso', 'paga'
--
-- NOTE: No RLS here — all RLS is in 20260620000400_faturamento_rls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. tiss_lotes (D-22, CONV-02)
--    TISS lote per operadora per competência period.
--    insurer_id ON DELETE RESTRICT: cannot delete insurer with open lotes.
--    xml_storage_path: D-17 bucket path for the lote XML.
-- ---------------------------------------------------------------------------
CREATE TABLE public.tiss_lotes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurer_id       UUID        NOT NULL REFERENCES public.insurers(id) ON DELETE RESTRICT,
  numero           TEXT        NOT NULL,
  competencia      TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'em_analise'
                   CHECK (status IN ('em_analise', 'autorizada', 'glosada', 'paga', 'recurso')),
  protocolo        TEXT,
  valor_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_envio       TIMESTAMPTZ,
  provider_ref     TEXT,
  xml_storage_path TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiss_lotes_clinic   ON public.tiss_lotes(clinic_id);
CREATE INDEX idx_tiss_lotes_insurer  ON public.tiss_lotes(insurer_id);

-- ---------------------------------------------------------------------------
-- 2. tiss_guides (D-13, D-22, CONV-02)
--    GTO (Guia de Tratamento Odontológico) per OS per operadora.
--    lote_id ON DELETE SET NULL: guide stays if lote is deleted (reassignable).
--    service_order_id NOT NULL ON DELETE RESTRICT: guide requires an OS.
--    insurer_id ON DELETE RESTRICT: cannot delete insurer with guides.
--    patient_id ON DELETE RESTRICT: patient record must persist with guide.
--    valor_glosado: cumulative glosa amount (D-28 — calculated from item level).
-- ---------------------------------------------------------------------------
CREATE TABLE public.tiss_guides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lote_id          UUID        REFERENCES public.tiss_lotes(id) ON DELETE SET NULL,
  service_order_id UUID        NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  insurer_id       UUID        NOT NULL REFERENCES public.insurers(id) ON DELETE RESTRICT,
  patient_id       UUID        REFERENCES public.patients(id) ON DELETE RESTRICT,
  numero_guia      TEXT        NOT NULL,
  numero_carteira  TEXT,
  registro_ans     TEXT,
  status           TEXT        NOT NULL DEFAULT 'em_analise'
                   CHECK (status IN ('em_analise', 'autorizada', 'glosada', 'paga', 'recurso')),
  valor_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_autorizado NUMERIC(12,2),
  valor_glosado    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pago       NUMERIC(12,2),
  protocolo        TEXT,
  provider_ref     TEXT,
  xml_storage_path TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiss_guides_clinic   ON public.tiss_guides(clinic_id);
CREATE INDEX idx_tiss_guides_lote     ON public.tiss_guides(lote_id);
CREATE INDEX idx_tiss_guides_os       ON public.tiss_guides(service_order_id);
CREATE INDEX idx_tiss_guides_status   ON public.tiss_guides(clinic_id, status);

-- ---------------------------------------------------------------------------
-- 3. tiss_guide_items (D-28, CONV-03)
--    Items of a TISS guide (one per procedure line). Glosa is per item (D-28).
--    guide_id ON DELETE CASCADE: items deleted with parent guide.
--    service_order_item_id ON DELETE SET NULL: item stays if OS item is deleted (audit).
--    motivo_glosa_id ON DELETE SET NULL: preserve history if motivo is removed.
--    valor_glosado: glosa amount for this individual item (D-28 glosa-by-item).
-- ---------------------------------------------------------------------------
CREATE TABLE public.tiss_guide_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  guide_id              UUID        NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  service_order_item_id UUID        REFERENCES public.service_order_items(id) ON DELETE SET NULL,
  tuss_code             TEXT,
  description           TEXT        NOT NULL,
  quantity              INT         NOT NULL DEFAULT 1,
  dente                 TEXT,
  face                  TEXT,
  valor_unitario        NUMERIC(12,2) NOT NULL,
  valor_total           NUMERIC(12,2) NOT NULL,
  valor_glosado         NUMERIC(12,2) NOT NULL DEFAULT 0,
  motivo_glosa_id       UUID        REFERENCES public.glosa_motivos(id) ON DELETE SET NULL,
  glosa_status          TEXT
                        CHECK (glosa_status IN ('pendente', 'glosada', 'em_recurso', 'paga')),
  recurso_texto         TEXT,
  recurso_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiss_guide_items_clinic ON public.tiss_guide_items(clinic_id);
CREATE INDEX idx_tiss_guide_items_guide  ON public.tiss_guide_items(guide_id);
