-- =============================================================================
-- Migration: 20260703000100_estoque_tables.sql
-- Phase: 17-estoque-materiais / Plan 02
-- Purpose: Create the 6 Estoque & Materiais tables:
--   products                   (EST-01) — produto de estoque da rede (clinic-level)
--   product_batches            (EST-01) — lote de produto por unidade (FIFO, ANVISA)
--   stock_entries              (EST-01) — entrada de estoque (recebimento)
--   stock_draws                (EST-02) — baixa de estoque (automática + manual)
--   service_material_templates (EST-02) — template de consumo: service → product
--   stock_alerts               (EST-03) — alertas de mínimo e validade (UI only)
--
-- Requirements: EST-01, EST-02, EST-03
-- Dependencies:
--   public.clinics(id)
--   public.units(id)             — 20260614000100_units.sql
--   public.users(id)             — 20260604000300_clinics_users_phase1.sql
--   public.suppliers(id)         — 20260621000100_payables_tables.sql
--   public.services(id)          — 20260620000100_faturamento_catalog_tables.sql
--   public.appointment_procedures(id) — 20260620000200_faturamento_os_tables.sql
--
-- Conventions (CLAUDE.md):
--   - NUMERIC(12,4) for quantities and unit costs in stock (fractionable, custo médio precision)
--   - NUMERIC(12,2) not used here: stock costs use NUMERIC(12,4) per D-02 (custo médio móvel)
--   - clinic_id + unit_id indexed on every operational table
--   - deleted_at TIMESTAMPTZ for soft delete (LGPD) — EXCEPT stock_draws + stock_alerts (append-only)
--   - NO RLS here — all Phase 17 RLS is in 20260703000300_estoque_rls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. products — produto de estoque (rede, clinic_id; saldo por unidade em stock_entries)
-- ---------------------------------------------------------------------------
-- D-01: tabela separada de `services`. `services` = o que cobra do paciente;
--        `products` = o que consome internamente.
-- D-03: category TEXT CHECK com 3 valores; enforcement de campos adicionais no Server Action/Zod.
-- D-04: preferred_supplier_id → FK para suppliers (reusar Fase 16).
-- D-05: estoque_minimo obrigatório; estoque_maximo opcional (para cálculo de reposição).
-- custo_medio denormalizado (network-level, por produto) — custo_medio_apos por unidade em stock_entries.
CREATE TABLE public.products (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name                  TEXT          NOT NULL,
  sku                   TEXT,
  category              TEXT          NOT NULL CHECK (category IN ('insumo', 'medicamento', 'implante')),
  unidade_medida        TEXT          NOT NULL DEFAULT 'un',
  custo_medio           NUMERIC(12,4) NOT NULL DEFAULT 0,
  estoque_minimo        NUMERIC(12,4) NOT NULL DEFAULT 0,
  estoque_maximo        NUMERIC(12,4),
  preferred_supplier_id UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  numero_anvisa         TEXT,         -- ANVISA opcional no produto; obrigatório por entrada p/ implante (Zod/Server Action)
  ativo                 BOOLEAN       NOT NULL DEFAULT true,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_clinic    ON public.products(clinic_id);
CREATE INDEX idx_products_supplier  ON public.products(preferred_supplier_id) WHERE preferred_supplier_id IS NOT NULL;
-- SKU único por clínica (ignora NULLs)
CREATE UNIQUE INDEX idx_products_sku ON public.products(clinic_id, sku) WHERE sku IS NOT NULL;

COMMENT ON TABLE  public.products                    IS 'Produtos de estoque da rede (clinic). Saldo operado por unidade via stock_entries/stock_draws.';
COMMENT ON COLUMN public.products.custo_medio        IS 'Custo médio móvel denormalizado (atualizado a cada stock_entry). NUMERIC(12,4) para precisão de 4 casas.';
COMMENT ON COLUMN public.products.numero_anvisa      IS 'Número de registro ANVISA do produto. Obrigatório apenas para implante (enforced no Zod/Server Action, não no CHECK de banco).';
COMMENT ON COLUMN public.products.preferred_supplier_id IS 'Fornecedor preferido para reposição (D-04). Agente de compras L2 usa para criar rascunho de CP.';

-- ---------------------------------------------------------------------------
-- 2. product_batches — lote de produto por unidade (FIFO, rastreabilidade ANVISA)
-- ---------------------------------------------------------------------------
-- D-11: lote = entrada de compra (N unidades). FIFO automático na Server Action de baixa.
-- D-12: vínculo ANVISA via stock_draws.batch_id + stock_draws.appointment_procedure_id.
-- unit_id: saldo por unidade (D-23 — estoque independente por unidade).
CREATE TABLE public.product_batches (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID          NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id       UUID          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  numero_lote      TEXT          NOT NULL,
  numero_anvisa    TEXT,         -- snapshot do nº ANVISA no momento da entrada (D-12)
  data_validade    DATE,         -- obrigatória para implante/medicamento; opcional para insumo
  qtd_inicial      NUMERIC(12,4) NOT NULL,
  saldo_disponivel NUMERIC(12,4) NOT NULL,
  custo_unitario   NUMERIC(12,4) NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_batches_clinic   ON public.product_batches(clinic_id);
CREATE INDEX idx_product_batches_unit     ON public.product_batches(unit_id);
CREATE INDEX idx_product_batches_product  ON public.product_batches(product_id);
-- Índice de validade para cron semanal de validade (D-16)
CREATE INDEX idx_product_batches_validade ON public.product_batches(data_validade) WHERE data_validade IS NOT NULL;

COMMENT ON TABLE  public.product_batches                  IS 'Lotes de produtos por unidade. FIFO automático na baixa. Rastreabilidade ANVISA de implantes.';
COMMENT ON COLUMN public.product_batches.saldo_disponivel IS 'Saldo disponível no lote. Decrementado atomicamente na baixa via CAS guard (Pitfall 2 RESEARCH).';
COMMENT ON COLUMN public.product_batches.data_validade    IS 'Validade do lote. Varrida pelo cron /api/cron/estoque-validade (D-16). DATE type para simplificar comparação.';

-- ---------------------------------------------------------------------------
-- 3. stock_entries — entrada de estoque (recebimento)
-- ---------------------------------------------------------------------------
-- D-10: entrada manual via formulário de recebimento.
--        Atualiza saldo e custo médio móvel no produto (Server Action).
-- custo_medio_apos: custo médio do produto após esta entrada (NUMERIC(12,4) para precisão D-02).
CREATE TABLE public.stock_entries (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID          NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id       UUID          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id         UUID          REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  supplier_id      UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  qtd              NUMERIC(12,4) NOT NULL,
  custo_unitario   NUMERIC(12,4) NOT NULL,
  custo_medio_apos NUMERIC(12,4) NOT NULL,   -- custo médio do produto após esta entrada (D-02)
  nota_fiscal      TEXT,
  created_by       UUID          REFERENCES public.users(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_entries_clinic  ON public.stock_entries(clinic_id);
CREATE INDEX idx_stock_entries_unit    ON public.stock_entries(unit_id);
CREATE INDEX idx_stock_entries_product ON public.stock_entries(product_id);

COMMENT ON TABLE  public.stock_entries                  IS 'Entradas de estoque (recebimento). Cada entrada atualiza saldo + custo médio móvel do produto.';
COMMENT ON COLUMN public.stock_entries.custo_medio_apos IS 'Custo médio do produto após esta entrada. Calculado em Server Action: (saldo_ant × custo_ant + qtd × custo_unit) / novo_saldo.';

-- ---------------------------------------------------------------------------
-- 4. stock_draws — baixa de estoque (automática por procedimento e manual)
-- ---------------------------------------------------------------------------
-- D-08: registra baixa com appointment_procedure_id (automática) ou motivo (manual).
-- D-09: saldo negativo permitido — batch_id pode ser NULL se nenhum lote disponível.
-- Append-only: sem deleted_at (histórico imutável para rastreabilidade ANVISA — D-12).
-- appointment_procedure_id: ON DELETE RESTRICT (Pitfall 5 RESEARCH — impede deleção de procedimento com baixa).
CREATE TABLE public.stock_draws (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                  UUID          NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id               UUID          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id                 UUID          REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  appointment_procedure_id UUID          REFERENCES public.appointment_procedures(id) ON DELETE RESTRICT,
  qtd                      NUMERIC(12,4) NOT NULL,
  custo_unitario_snapshot  NUMERIC(12,4) NOT NULL,   -- custo médio no momento da baixa
  motivo                   TEXT,         -- obrigatório para baixas manuais (D-19); enforce no Server Action
  tipo                     TEXT          NOT NULL DEFAULT 'automatico'
                           CHECK (tipo IN ('automatico', 'manual')),
  created_by               UUID          REFERENCES public.users(id),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
  -- Sem deleted_at: stock_draws é append-only (rastreabilidade ANVISA imutável)
);

CREATE INDEX idx_stock_draws_clinic    ON public.stock_draws(clinic_id);
CREATE INDEX idx_stock_draws_unit      ON public.stock_draws(unit_id);
CREATE INDEX idx_stock_draws_product   ON public.stock_draws(product_id);
CREATE INDEX idx_stock_draws_procedure ON public.stock_draws(appointment_procedure_id) WHERE appointment_procedure_id IS NOT NULL;
CREATE INDEX idx_stock_draws_batch     ON public.stock_draws(batch_id) WHERE batch_id IS NOT NULL;

COMMENT ON TABLE  public.stock_draws                          IS 'Baixas de estoque. Append-only (sem deleted_at) para rastreabilidade ANVISA imutável (D-12).';
COMMENT ON COLUMN public.stock_draws.batch_id                IS 'Lote FIFO selecionado. NULL = saldo negativo permitido (D-09): sem lote disponível, atendimento não é bloqueado.';
COMMENT ON COLUMN public.stock_draws.appointment_procedure_id IS 'FK com ON DELETE RESTRICT: impede deleção de procedimento que tenha baixa registrada (Pitfall 5).';
COMMENT ON COLUMN public.stock_draws.motivo                  IS 'Obrigatório para baixa manual (perda, quebra, vencimento, ajuste). Enforced no Server Action, não no banco.';

-- ---------------------------------------------------------------------------
-- 5. service_material_templates — template de consumo por serviço
-- ---------------------------------------------------------------------------
-- D-07: admin configura via aba "Materiais utilizados" no ServiceForm (/config/servicos).
--        No atendimento, dentista pode ajustar qtd (qtd_padrao é o valor inicial editável).
-- UNIQUE (service_id, product_id): 1 template por produto por serviço.
CREATE TABLE public.service_material_templates (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  service_id UUID          NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id UUID          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qtd_padrao NUMERIC(12,4) NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (service_id, product_id)   -- 1 template por produto por serviço (deduplicação inline aceitável aqui)
);

CREATE INDEX idx_smt_clinic   ON public.service_material_templates(clinic_id);
CREATE INDEX idx_smt_service  ON public.service_material_templates(service_id);
CREATE INDEX idx_smt_product  ON public.service_material_templates(product_id);

COMMENT ON TABLE public.service_material_templates IS 'Templates de consumo de materiais por serviço. Pré-preenche a seção "Materiais utilizados" no prontuário (D-07).';

-- ---------------------------------------------------------------------------
-- 6. stock_alerts — alertas de estoque mínimo e validade (UI only)
-- ---------------------------------------------------------------------------
-- D-14: alerta real-time de mínimo após cada stock_draw.
-- D-16: alerta de validade gerado pelo cron semanal.
-- D-17: canal UI only — sem WhatsApp/e-mail nesta fase.
-- Append-only: sem deleted_at (histórico de alertas imutável).
--
-- IMPORTANTE (Pitfall DDL): Postgres não aceita DATE() function em UNIQUE inline de tabela.
-- Usado índice de expressão parcial em vez de UNIQUE inline:
--   CREATE UNIQUE INDEX uq_stock_alerts_daily ... (((created_at AT TIME ZONE 'America/Sao_Paulo')::date))
-- Garante idempotência: no máximo 1 alerta por produto/unidade/tipo/dia.
CREATE TABLE public.stock_alerts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id    UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  product_id UUID        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id   UUID        REFERENCES public.product_batches(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('minimo', 'validade')),
  resolvido  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Sem deleted_at: stock_alerts é append-only
);

-- Índice de expressão para unicidade diária por produto/unidade/tipo
-- Dia local BR sem hora — 1 alerta por produto/unidade/tipo/dia.
-- created_at é timestamptz: (created_at::date) NÃO é IMMUTABLE (depende do TimeZone da
-- sessão) e o Postgres recusa em índice (42P17). timezone('America/Sao_Paulo', created_at)
-- é IMMUTABLE e ::date sobre timestamp também — expressão canônica para índice de data.
CREATE UNIQUE INDEX uq_stock_alerts_daily
  ON public.stock_alerts (product_id, unit_id, clinic_id, tipo, ((created_at AT TIME ZONE 'America/Sao_Paulo')::date));

CREATE INDEX idx_stock_alerts_clinic   ON public.stock_alerts(clinic_id);
CREATE INDEX idx_stock_alerts_unit     ON public.stock_alerts(unit_id);
CREATE INDEX idx_stock_alerts_produto  ON public.stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_resolvido ON public.stock_alerts(clinic_id, resolvido) WHERE resolvido = false;

COMMENT ON TABLE  public.stock_alerts         IS 'Alertas de estoque mínimo e validade. Append-only. Exibidos no dashboard /clinica/estoque (D-17, UI only).';
COMMENT ON COLUMN public.stock_alerts.resolvido IS 'Marcado true pelo admin/operacional ao reconhecer/resolver o alerta. Filtro de dashboard.';
COMMENT ON COLUMN public.stock_alerts.batch_id  IS 'Preenchido para alertas de validade (tipo=validade); NULL para alertas de mínimo (tipo=minimo).';
