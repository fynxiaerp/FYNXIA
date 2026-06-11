-- Phase 5: whatsapp_inbound_events
-- Inbound WhatsApp message dedup table. Service-role only (webhook uses createAdminClient) — NO RLS,
-- mirrors webhook_events (Phase 3). UNIQUE(wamid) is the idempotency constraint (T-5-03).
-- Prevents duplicate status updates when Meta retries webhook delivery (at-least-once).

CREATE TABLE public.whatsapp_inbound_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid       TEXT UNIQUE NOT NULL,
  from_phone  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  processed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
