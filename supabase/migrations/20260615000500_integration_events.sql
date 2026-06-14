-- Phase 9 Plan 02: integration_events table + indexes + RLS
-- Generalizes message_outbox pattern for integration hub event tracking.
-- Uses TEXT CHECK constraints (NOT new ENUMs) to avoid Postgres ENUM lock complexity (Pitfall 3).
-- Do NOT reference message_status / message_channel ENUMs from message_outbox (naming collision risk).
-- clinic_id is NULLABLE to handle the WhatsApp unresolved-tenant path (Open Q2) and system events.
-- connector_id FK ON DELETE SET NULL: event log survives connector deletion.

-- ============ integration_events table (INT-03) ============

CREATE TABLE public.integration_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID                 REFERENCES public.clinics(id) ON DELETE CASCADE,  -- NULLABLE (WhatsApp unresolved-tenant path; system events)
  connector_id      UUID                 REFERENCES public.integration_connectors(id) ON DELETE SET NULL,  -- NULLABLE: event logged before connector row exists
  direction         TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status            TEXT        NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'processed', 'failed')),
  event_type        TEXT,                                   -- e.g. 'PAYMENT_RECEIVED', 'message', 'nfse_emitted'
  external_event_id TEXT,                                   -- provider dedup key (nullable for outbound)
  payload_ref       TEXT,                                   -- opaque ref: webhook_events.id as TEXT (do NOT FK into webhook_events)
  attempts          INT         NOT NULL DEFAULT 0,
  max_attempts      INT         NOT NULL DEFAULT 3,
  last_error        TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_events_clinic    ON public.integration_events(clinic_id);
CREATE INDEX idx_integration_events_connector ON public.integration_events(connector_id);
CREATE INDEX idx_integration_events_status    ON public.integration_events(status, created_at);

-- ============ RLS — integration_events ============

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

-- Tenant members read their own events (panel + health derivation).
-- NULL clinic_id rows are server-only — not exposed to tenant users.
CREATE POLICY "integration_events_tenant_read" ON public.integration_events
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- No client write policy: only the service role (createAdminClient) writes events.
-- Webhook handlers + cron worker always write via admin client (bypass RLS).
-- Mirrors webhook_events and whatsapp_inbound_events being service-role-only.
