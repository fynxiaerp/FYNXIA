-- =============================================================================
-- Migration: 20260620000100_faturamento_catalog_tables.sql
-- Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 02
-- Purpose: Create catalog & fiscal-config layer for Phase 15 billing domain.
--   D-16: unit_fiscal_config  — per-unit NFS-e emitente/série/ISS settings
--   D-04/D-05: services       — service catalog with TUSS code + ISS overrides
--   D-06: insurer_prices      — operadora × serviço × valor (price overrides particular)
--   D-14: glosa_motivos       — ANS Tabela 38 motivos seed target (nullable clinic_id = shared)
--
-- NOTE: No RLS in this file — all RLS is added in 20260620000400_faturamento_rls.sql
--
-- CROSS-FILE FK: insurer_prices.insurer_id references public.insurers which is created
--   in 20260620000200_faturamento_os_tables.sql (runs AFTER this file, 000100 < 000200).
--   Resolution: column insurer_id UUID NOT NULL exists here WITHOUT the inline FK constraint.
--   The FK is emitted as ALTER TABLE at the END of 20260620000200 to resolve the forward
--   reference. See: [DEFERRED FK: fk_insurer_prices_insurer] marker below.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. unit_fiscal_config (D-16)
--    Config fiscal per unit (1 row per unit — UNIQUE unit_id).
--    Reuses clinics.regime_tributario for regime (added in 20260614000150_clinics_regime.sql).
--    emitente_cnpj, municipio_codigo_ibge are required for NFS-e emission.
--    regime_emissao: competencia (NFS-e on billing) vs caixa (NFS-e on payment via webhook).
-- ---------------------------------------------------------------------------
CREATE TABLE public.unit_fiscal_config (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                 UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  emitente_cnpj           TEXT        NOT NULL,
  emitente_inscricao_mun  TEXT,
  municipio_codigo_ibge   TEXT        NOT NULL,
  serie_rps               TEXT        NOT NULL DEFAULT 'A1',
  proximo_numero_rps      INT         NOT NULL DEFAULT 1,
  aliquota_iss_padrao     NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  item_lista_servico      TEXT        NOT NULL DEFAULT '11.02',
  regime_emissao          TEXT        NOT NULL DEFAULT 'competencia'
                          CHECK (regime_emissao IN ('competencia', 'caixa')),
  ativo                   BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);

CREATE INDEX idx_unit_fiscal_config_clinic ON public.unit_fiscal_config(clinic_id);

-- ---------------------------------------------------------------------------
-- 2. services (D-04, D-05)
--    Catalog de serviços/procedimentos da rede. 1 row per service.
--    account_id: links to chart_of_accounts (Phase 14); set to NULL until classified.
--    aliquota_iss_override: per-service ISS rate override (overrides unit_fiscal_config).
--    item_lista_servico_override: per-service LC 116 code override.
--    Partial unique index: code is unique per tenant WHEN code IS NOT NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE public.services (
  id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                    UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name                         TEXT         NOT NULL,
  code                         TEXT,
  tuss_code                    TEXT,
  description                  TEXT,
  valor_particular             NUMERIC(12,2) NOT NULL DEFAULT 0,
  account_id                   UUID         REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  aliquota_iss_override        NUMERIC(5,4),
  item_lista_servico_override  TEXT,
  ativo                        BOOLEAN      NOT NULL DEFAULT true,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_clinic ON public.services(clinic_id);
CREATE UNIQUE INDEX idx_services_code ON public.services(clinic_id, code) WHERE code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. insurer_prices (D-06, CONV-01)
--    Preço do convênio por serviço (sobrepõe valor_particular da OS quando
--    pagador = 'convenio' e esta operadora está vinculada à OS).
--
--    [DEFERRED FK: fk_insurer_prices_insurer]
--    insurer_id UUID NOT NULL — column exists here but the FK constraint
--    REFERENCES public.insurers(id) ON DELETE CASCADE is added at the END of
--    20260620000200_faturamento_os_tables.sql where insurers table is created.
--    See: ALTER TABLE public.insurer_prices ADD CONSTRAINT fk_insurer_prices_insurer ...
-- ---------------------------------------------------------------------------
CREATE TABLE public.insurer_prices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  insurer_id  UUID        NOT NULL,
  service_id  UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  valor       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_id, service_id)
);

CREATE INDEX idx_insurer_prices_clinic   ON public.insurer_prices(clinic_id);
CREATE INDEX idx_insurer_prices_insurer  ON public.insurer_prices(insurer_id);

-- ---------------------------------------------------------------------------
-- 4. glosa_motivos (D-14, CONV-03)
--    ANS Tabela 38 rejection motivos seed target.
--    clinic_id NULLABLE: NULL = system-wide shared ANS codes (public reference data,
--    no PII — T-15-05 accepted). Non-NULL = per-clinic custom motivos (editable copy).
--    Seeded in 20260620000500_faturamento_seed.sql.
-- ---------------------------------------------------------------------------
CREATE TABLE public.glosa_motivos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        REFERENCES public.clinics(id) ON DELETE CASCADE,
  codigo_ans  TEXT        NOT NULL,
  descricao   TEXT        NOT NULL,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_glosa_motivos_clinic ON public.glosa_motivos(clinic_id);
