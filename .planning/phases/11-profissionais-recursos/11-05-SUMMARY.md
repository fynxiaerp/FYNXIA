# Plan 11-05 Summary — [BLOCKING] DB push + gen types

**Wave:** 3 | **Status:** complete | **Date:** 2026-06-15

## What happened
Single [BLOCKING] migration checkpoint for Phase 11. Executed inline by the orchestrator after Supabase CLI re-auth (recurring gotcha: CLI had logged out / hit the 20-personal-access-token limit; user cleared excess tokens and re-logged). Account verified as FYNXIA org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` (● LINKED) before the push.

## Actions
1. `npx supabase db push --dry-run` — confirmed exactly the 6 expected migrations pending.
2. `npx supabase db push` — applied to FYNXIA production:
   - `20260617000100_professionals.sql`
   - `20260617000200_professionals_rls.sql`
   - `20260617000300_resources.sql`
   - `20260617000400_resources_rls.sql`
   - `20260617000500_appointment_resource_checkin.sql` (resource_id, presence_status, 4 timestamps)
   - `20260617000600_appointments_realtime.sql` (publication)
3. `gen types` via temp-file truncation guard: 2771 lines (>1000), all 3 new tables present, `presence_status` x3 (Row/Insert/Update) → only then overwrote `src/types/database.types.ts`.
4. `npx tsc --noEmit` exit 0.

## Verification
- `migration list --linked` shows 000100–000600 applied on both local + remote.
- Sacred appointments GIST + status CHECK unchanged (regression guard GREEN).
- Commit: `51cb040`.

## Notes
- Realtime publication added; anon `/painel` relies on a 15s polling fallback (RLS blocks anon postgres_changes) — see WR-01 fix.
