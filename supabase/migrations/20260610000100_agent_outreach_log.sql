-- Phase 5: agent_outreach_log
-- Audit trail for AI-02 (confirmation agent) and AI-03 (collection agent).
-- Powers the /clinica/ia/agentes UI page (read-only table for staff).
-- Writes are service-role only (cron/webhook via createAdminClient) — mirrors message_outbox.

CREATE TABLE public.agent_outreach_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  agent_type          TEXT NOT NULL CHECK (agent_type IN ('confirmation', 'collection')),
  patient_id          UUID REFERENCES public.patients(id),
  appointment_id      UUID REFERENCES public.appointments(id),
  receivable_id       UUID REFERENCES public.receivables(id),
  status              TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent','delivered','responded','failed','ambiguous')),
  whatsapp_message_id TEXT,
  intent_result       TEXT,          -- AI-02: 'confirm' | 'cancel' | 'ambiguous'
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for UI query: last N per tenant, newest first (powers /clinica/ia/agentes)
CREATE INDEX idx_agent_outreach_log_tenant_created
  ON public.agent_outreach_log(tenant_id, created_at DESC);
