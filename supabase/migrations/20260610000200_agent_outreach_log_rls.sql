-- Phase 5: RLS for agent_outreach_log
-- Tenant members read their own log (powers /clinica/ia/agentes).
-- Writes are service-role only (cron/webhook via createAdminClient) — mirrors message_outbox decision.
-- Deliberately NO INSERT/UPDATE/DELETE policy — satisfies T-5-02 (no client tampering of audit log).

ALTER TABLE public.agent_outreach_log ENABLE ROW LEVEL SECURITY;

-- Tenant members (all roles) can read their clinic's outreach audit log
CREATE POLICY "agent_outreach_log_tenant_read" ON public.agent_outreach_log
  FOR SELECT USING (tenant_id = get_my_tenant_id());
