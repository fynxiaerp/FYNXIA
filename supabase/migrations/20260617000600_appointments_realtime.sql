-- Phase 11 Plan 03: enable Supabase Realtime publication for appointments (RES-03)
--
-- Enables postgres_changes events for the /painel TV panel (Plan 08).
-- Without this, the supabase_realtime publication does not include appointments and
-- the Realtime channel would silently receive no events (Pitfall 6 in 11-RESEARCH.md).
--
-- Idempotency note: ALTER PUBLICATION ... ADD TABLE errors if the table is already
-- present in the publication. This is a one-time additive migration applied via the
-- single db push in Plan 05. If re-running locally after a reset, this is idempotent
-- (the migration will not exist yet in a fresh DB).

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
