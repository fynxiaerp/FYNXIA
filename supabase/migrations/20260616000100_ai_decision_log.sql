-- Phase 10 Plan 02: ai_decision_log — immutable AI decision audit log (AIG-03)
-- INSERT-only via createAdminClient (service role bypasses RLS).
-- No client INSERT/UPDATE/DELETE policy — append-only for all authenticated/anon clients (T-10-01).
-- No FK on clinic_id: immutable log must survive tenant delete (mirrors audit_logs design).

CREATE TABLE public.ai_decision_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL,                -- no FK: immutable log survives tenant delete
  agent_key       TEXT        NOT NULL,
  action          TEXT        NOT NULL,
  autonomy_level  TEXT        NOT NULL,
  decision        TEXT        NOT NULL
                  CHECK (decision IN ('execute','suggest','block','pending_approval')),
  actor_id        UUID,                                -- NULL for cron/system
  reason          TEXT,
  payload         JSONB,                               -- masked/sanitized only (Pitfall 3)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_decision_log_clinic ON public.ai_decision_log(clinic_id, created_at DESC);
CREATE INDEX idx_ai_decision_log_agent  ON public.ai_decision_log(clinic_id, agent_key);

ALTER TABLE public.ai_decision_log ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own clinic's AI decisions (AIG-03 audit trail)
CREATE POLICY "ai_decision_log_tenant_read" ON public.ai_decision_log
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- IMMUTABLE: deliberately NO INSERT/UPDATE/DELETE policy.
-- Writes go through createAdminClient (service role bypasses RLS).
-- This makes the log append-only for all authenticated/anon clients (T-10-01 Tampering mitigation).
