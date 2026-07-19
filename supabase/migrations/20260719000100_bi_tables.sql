-- =============================================================================
-- Migration: 20260719000100_bi_tables.sql
-- Phase: 19-relat-rios-or-amento-bi / Plan 03
-- Purpose: Create 4 new BI/orçamento/societário tables:
--   budget_targets  — meta orçamentária por conta + unidade + ano + mês (REP-02, D-12/D-13)
--   partner_shares  — percentual de cota societária por sócio com vigência (REP-03, D-20)
--   kpi_targets     — meta por indicador (kpi_key) + unidade (BI-01, D-30)
--   bi_alerts       — alertas gerados por agente/cron de previsão (BI-02, D-33/D-35)
--
-- Requirements: REP-02, REP-03, BI-01, BI-02
-- Dependencies:
--   public.clinics             — 20260604000300_clinics_users_phase1.sql
--   public.units                — 20260614000100_units_table.sql
--   public.chart_of_accounts    — 20260619001100_financial_cadastros_tables.sql
--   public.users                — 20260604000300_clinics_users_phase1.sql
--
-- NAMING (Pitfall 4 / CLAUDE.md): all 4 tables use `clinic_id` (not `tenant_id`).
-- Money = NUMERIC(12,2). Percentual = NUMERIC(5,4).
--
-- RLS: applied in the next migration (20260719000200_bi_rls.sql).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. budget_targets — meta orçamentária (REP-02, D-12/D-13)
--    Grain: clinic_id + account_id + ano + mes + unit_id (NULL unit_id = consolidado/rede).
--    Two partial unique indexes mirror the ai_agent_config network/unit pattern:
--    PostgreSQL treats NULL as DISTINCT in a plain UNIQUE constraint, so unit-level
--    and network-level (unit_id IS NULL) rows need separate partial unique indexes.
-- ---------------------------------------------------------------------------
CREATE TABLE public.budget_targets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id     UUID          REFERENCES public.units(id) ON DELETE CASCADE,  -- NULL = consolidado/rede
  account_id  UUID          NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  ano         INTEGER       NOT NULL,
  mes         SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by  UUID          REFERENCES public.users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Partial unique indexes (mirrors uq_ai_agent_config_network / uq_ai_agent_config_unit)
CREATE UNIQUE INDEX uq_budget_targets_unit
  ON public.budget_targets (clinic_id, account_id, ano, mes, unit_id)
  WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX uq_budget_targets_network
  ON public.budget_targets (clinic_id, account_id, ano, mes)
  WHERE unit_id IS NULL;

CREATE INDEX idx_budget_targets_clinic ON public.budget_targets(clinic_id, unit_id, ano);

-- ---------------------------------------------------------------------------
-- 2. partner_shares — cota societária por sócio (REP-03, D-20)
--    Replicates the tax_tables vigência shape: vigencia_inicio/vigencia_fim DATE,
--    vigencia_fim NULL = vigente. user_id ON DELETE RESTRICT: cannot delete a
--    user who still has an equity-share history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.partner_shares (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  percentual       NUMERIC(5,4)  NOT NULL CHECK (percentual > 0 AND percentual <= 1),
  vigencia_inicio  DATE          NOT NULL,
  vigencia_fim     DATE,                          -- NULL = vigente
  created_by       UUID          REFERENCES public.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_shares_clinic    ON public.partner_shares(clinic_id);
CREATE INDEX idx_partner_shares_vigencia  ON public.partner_shares(clinic_id, vigencia_inicio, vigencia_fim);

-- ---------------------------------------------------------------------------
-- 3. kpi_targets — meta por indicador (BI-01, D-30)
--    kpi_key values: ocupacao, ticket_medio, consultas_mes, nps, cpl, cac,
--    conversao_leads, glosa_taxa, atraso_pagamento (application-level enum, no CHECK
--    to keep the KPI catalog extensible without a migration).
--    Same network/unit partial-unique-index pattern as budget_targets.
-- ---------------------------------------------------------------------------
CREATE TABLE public.kpi_targets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id     UUID          REFERENCES public.units(id) ON DELETE CASCADE,  -- NULL = consolidado/rede
  kpi_key     TEXT          NOT NULL,
  meta_valor  NUMERIC(12,2) NOT NULL,
  created_by  UUID          REFERENCES public.users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_kpi_targets_unit
  ON public.kpi_targets (clinic_id, kpi_key, unit_id)
  WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX uq_kpi_targets_network
  ON public.kpi_targets (clinic_id, kpi_key)
  WHERE unit_id IS NULL;

CREATE INDEX idx_kpi_targets_clinic ON public.kpi_targets(clinic_id);

-- ---------------------------------------------------------------------------
-- 4. bi_alerts — alertas de previsão/desvio gerados por agente/cron (BI-02, D-33/D-35)
--    Zero authenticated write policy — writes only via service role (cron/agent),
--    mirroring stock_alerts/nps_responses (T-19-06). See RLS migration.
--    approval_request_id: logical FK (no constraint), mirrors campaigns.approval_request_id;
--    set ONLY when the alert results in a concrete action (D-35).
-- ---------------------------------------------------------------------------
CREATE TABLE public.bi_alerts (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id               UUID          REFERENCES public.units(id) ON DELETE CASCADE,
  kpi_key               TEXT          NOT NULL,
  severity              TEXT          NOT NULL CHECK (severity IN ('info','verde','amarelo','vermelho')),
  trigger_type          TEXT          NOT NULL CHECK (trigger_type IN ('budget_deviation','revenue_decline','kpi_off_target','payment_delay')),
  narrative             TEXT,
  projected_value       NUMERIC(12,2),
  actual_value          NUMERIC(12,2),
  approval_request_id   UUID,          -- logical FK (no constraint) — set only on concrete action (D-35)
  status                TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed')),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_bi_alerts_clinic ON public.bi_alerts(clinic_id, status, created_at);
