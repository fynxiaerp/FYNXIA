-- Phase 10 Plan 02: audit_logs indexes + defensive partitions (AUD-01/03, T-10-10)
--
-- EXISTING partitions (do NOT recreate):
--   audit_logs_2026_06 (20260603000000_initial_schema.sql)
--   audit_logs_2026_07 (20260604000300_clinics_users_phase1.sql)
--   audit_logs_2026_08 (20260604000300_clinics_users_phase1.sql)
--   audit_logs_2026_09 (20260605000300_clinical_audit_partitions.sql)

-- AUD-03: entity/table_name filtering currently lacks indexes.
-- Add indexes with IF NOT EXISTS guards (idempotent).
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
  ON public.audit_logs(tenant_id, table_name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id
  ON public.audit_logs(tenant_id, table_name, record_id);

-- Defensive forward partitions — 2026-10 and 2026-11.
-- Guards against audit INSERT failure when the phase runs past September (T-10-10 DoS mitigation).
-- CREATE TABLE ... PARTITION OF ... IF NOT EXISTS is valid in PostgreSQL 9.6+ and is idempotent.
CREATE TABLE IF NOT EXISTS public.audit_logs_2026_10 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS public.audit_logs_2026_11 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
