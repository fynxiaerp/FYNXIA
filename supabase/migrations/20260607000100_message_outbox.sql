-- Phase 4: async communications queue + appointment-reminder dedup
-- Provides: message_outbox (durable queue for WhatsApp/email sends) + message_log (reminder dedup)

CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'email');
CREATE TYPE public.message_status  AS ENUM ('pending', 'sent', 'failed');

-- message_outbox: durable queue drained by the Vercel Cron worker (D-01)
-- Worker uses createAdminClient() (service role) for status transitions — no client UPDATE/DELETE policy.
-- idempotency_key UNIQUE prevents double-enqueue on at-least-once cron delivery (RESEARCH §Pitfall 5).
CREATE TABLE public.message_outbox (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID            NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  channel           message_channel NOT NULL,
  status            message_status  NOT NULL DEFAULT 'pending',
  attempts          INT             NOT NULL DEFAULT 0,
  max_attempts      INT             NOT NULL DEFAULT 3,
  payload           JSONB           NOT NULL,
  idempotency_key   TEXT            NOT NULL,
  scheduled_for     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT message_outbox_idempotency_key_unique UNIQUE (idempotency_key)
);
CREATE INDEX idx_message_outbox_tenant      ON public.message_outbox(tenant_id);
CREATE INDEX idx_message_outbox_status      ON public.message_outbox(status, scheduled_for);
CREATE INDEX idx_message_outbox_idempotency ON public.message_outbox(idempotency_key);

-- message_log: appointment-reminder dedup keyed by (appointment_id, channel, type) (D-04)
-- Separate from collection_log (which is receivable-scoped).
-- type = '24h' for the 24h-before reminder window.
-- Re-running the daily cron does not re-enqueue due to this UNIQUE constraint.
CREATE TABLE public.message_log (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID            NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID            NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel        message_channel NOT NULL,
  type           TEXT            NOT NULL,
  sent_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT message_log_dedup_unique UNIQUE (appointment_id, channel, type)
);
CREATE INDEX idx_message_log_tenant ON public.message_log(tenant_id);
