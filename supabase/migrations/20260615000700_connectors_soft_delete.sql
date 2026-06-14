-- Phase 9 WR-02: add deleted_at to integration_connectors for LGPD soft-delete convention.
-- Mirrors soft-delete pattern from initial_schema (patients, clinics, units).
-- Hard DELETE was replaced with soft-delete in deleteConnector action so that
-- the integration_events.connector_id FK is preserved for audit trail continuity.
--
-- NOTE: After applying this migration via `supabase db push`, the RLS read policy
-- is updated to exclude soft-deleted rows from tenant-visible SELECT results.
-- System-sentinel rows (clinic_id IS NULL) are already excluded by the existing
-- tenant_read policy; this change only adds the deleted_at filter on top.
--
-- IMPORTANT: requires `supabase db push` — orchestrator runs this, not the fixer.

-- 1. Add deleted_at column (nullable TIMESTAMPTZ — NULL means "not deleted")
ALTER TABLE public.integration_connectors
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- 2. Replace the tenant read policy to exclude soft-deleted rows.
--    admin_write policy remains unchanged — soft-deleted rows can still be
--    updated (e.g., un-deleted by superadmin) via the service-role admin client.
DROP POLICY IF EXISTS "integration_connectors_tenant_read" ON public.integration_connectors;
CREATE POLICY "integration_connectors_tenant_read" ON public.integration_connectors
  FOR SELECT USING (
    clinic_id = get_my_tenant_id()
    AND deleted_at IS NULL
  );
