-- Phase 3: financial tables
-- financial_categories, charges, receivables, financial_transactions,
-- webhook_events, collection_rules, collection_log
-- + patients.asaas_customer_id amendment + audit trigger on financial_transactions

-- ============ financial_categories (D-05) ============
CREATE TABLE public.financial_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_categories_tenant ON public.financial_categories(tenant_id);
-- RLS: all roles SELECT; only admin INSERT/UPDATE/DELETE (see 20260606000200_financial_rls.sql)

-- ============ charges: provider-agnostic charge record (D-01, FIN-04, FIN-05, FIN-06) ============
CREATE TABLE public.charges (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id              UUID        REFERENCES public.patients(id),
  provider                TEXT        NOT NULL DEFAULT 'asaas',
  provider_charge_id      TEXT,                           -- Asaas pay_xxx
  provider_installment_id TEXT,                           -- Asaas inst_xxx (if parcelado)
  billing_type            TEXT        NOT NULL CHECK (billing_type IN ('PIX', 'BOLETO', 'CREDIT_CARD')),
  description             TEXT,
  total_value             NUMERIC(12,2) NOT NULL,
  installment_count       INT         NOT NULL DEFAULT 1,
  status                  TEXT        NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente', 'pago', 'cancelado', 'estornado')),
  created_by              UUID        REFERENCES public.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_charges_tenant           ON public.charges(tenant_id);
CREATE INDEX idx_charges_patient          ON public.charges(patient_id);
CREATE INDEX idx_charges_provider_charge_id ON public.charges(provider_charge_id);

-- ============ receivables: one row per parcel (FIN-03, FIN-06, D-03, D-04) ============
-- vencido is NEVER stored — derived at read time (D-04)
CREATE TABLE public.receivables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  charge_id           UUID        NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  patient_id          UUID        REFERENCES public.patients(id),
  provider_charge_id  TEXT,                       -- Asaas pay_xxx for THIS parcel
  installment_number  INT         NOT NULL DEFAULT 1,
  value               NUMERIC(12,2) NOT NULL,
  due_date            DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'pago', 'estornado')),
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_receivables_tenant              ON public.receivables(tenant_id);
CREATE INDEX idx_receivables_charge              ON public.receivables(charge_id);
CREATE INDEX idx_receivables_due_date            ON public.receivables(tenant_id, due_date);
CREATE INDEX idx_receivables_provider_charge_id  ON public.receivables(provider_charge_id);

-- ============ financial_transactions: cash flow entries (D-08, FIN-01, FIN-02) ============
-- Audit trigger attached (reuses Phase 2 SEC-03 audit_table_changes() function)
CREATE TABLE public.financial_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category_id      UUID        REFERENCES public.financial_categories(id),
  receivable_id    UUID        REFERENCES public.receivables(id),   -- set for auto-posted income
  type             TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  amount           NUMERIC(12,2) NOT NULL,
  description      TEXT,
  transaction_date DATE        NOT NULL,
  posted_by        UUID        REFERENCES public.users(id),         -- null for auto-posted (webhook)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_transactions_tenant ON public.financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_date   ON public.financial_transactions(tenant_id, transaction_date);

-- Audit trigger: reuses the Phase 2 SEC-03 audit_table_changes() SECURITY DEFINER function
CREATE TRIGGER audit_financial_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- ============ webhook_events: idempotency dedup table (FIN-09, D-07) ============
-- No tenant_id — webhook handler uses service role; events are global
CREATE TABLE public.webhook_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id  TEXT        NOT NULL UNIQUE,
  event_type      TEXT        NOT NULL,
  processed       BOOLEAN     NOT NULL DEFAULT false,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No RLS — service-role-only table (see 20260606000200_financial_rls.sql)

-- ============ collection_rules: per-tenant collection ruler config (FIN-07, D-10) ============
CREATE TABLE public.collection_rules (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  due_date_reminder_enabled   BOOLEAN     NOT NULL DEFAULT false,
  overdue_reminder_enabled    BOOLEAN     NOT NULL DEFAULT false,
  overdue_interval_days       INT         NOT NULL DEFAULT 7,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_rules_tenant ON public.collection_rules(tenant_id);

-- ============ collection_log: idempotency for sent reminders (FIN-07, D-10) ============
CREATE TABLE public.collection_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  receivable_id   UUID        NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  milestone       TEXT        NOT NULL,   -- 'due_date' | 'overdue_7' | 'overdue_14' etc.
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel         TEXT        NOT NULL DEFAULT 'email',
  UNIQUE (receivable_id, milestone, channel)
);
CREATE INDEX idx_collection_log_tenant ON public.collection_log(tenant_id);

-- ============ patients amendment: asaas_customer_id (D-06) ============
ALTER TABLE public.patients
  ADD COLUMN asaas_customer_id TEXT;
CREATE INDEX idx_patients_asaas_customer ON public.patients(asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
