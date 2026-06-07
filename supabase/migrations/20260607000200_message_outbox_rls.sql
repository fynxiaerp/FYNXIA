-- Phase 4: RLS for communications tables
-- Mirrors Phase 2/3 RLS pattern: tenant_id USING + WITH CHECK via get_my_tenant_id()
-- Worker uses createAdminClient() (service role) for UPDATE/status transitions — no client UPDATE/DELETE policies.

-- ============ message_outbox ============
-- Staff can read their tenant's outbox (for debug/admin views).
-- Staff may INSERT to enqueue messages.
-- The worker uses createAdminClient() (service role) for UPDATE/status transitions.
-- Deliberately NO UPDATE/DELETE policy — satisfies T-4-outbox-T (no client tampering of send status).
ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_outbox_tenant_read" ON public.message_outbox
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "message_outbox_staff_insert" ON public.message_outbox
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id()
              AND get_my_role() IN ('admin','dentist','receptionist','superadmin'));

-- ============ message_log ============
-- Staff can read their tenant's message log.
-- Staff may INSERT log entries (cron worker logs via service role, but also allow staff inserts).
-- No UPDATE/DELETE — message_log is append-only for dedup integrity.
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_log_tenant_read" ON public.message_log
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "message_log_staff_insert" ON public.message_log
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id()
              AND get_my_role() IN ('admin','dentist','receptionist','superadmin'));
