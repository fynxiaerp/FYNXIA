# Phase 07 Plan 04: [BLOCKING] DB Push + Type Regeneration — Summary

**One-liner:** Applied the 8 Phase-7 migrations to the live Supabase DB (sa-east-1, FYNXIA) and regenerated `database.types.ts` from the real schema — the foundation tables are now live.

---

## Tasks Completed

| Task | Name | Result |
|------|------|--------|
| 1 | [BLOCKING] `supabase db push` (human-action checkpoint) | 8 migrations applied to production; CLI already authed/linked to org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` (re-auth gotcha did NOT recur this time — user approved the push) |
| 2 | `supabase gen types typescript` + post-push checks | types regenerated (1866 lines); units/user_units/certificates/ai_agent_config/regime_tributario present; tsc exit 0 |

## Migrations applied (live)
- `20260614000100_units_table.sql` · `20260614000150_clinics_regime.sql` · `20260614000200_units_rls.sql` · `20260614000300_user_units.sql` (+ `get_my_unit_ids()`) · `20260614000400_role_expansion.sql` (role CHECK +6 on users+invitations) · `20260614000500_certificates.sql` (+ private `icp-certificates` bucket) · `20260614000600_ai_agent_config.sql` (partial unique indexes) · `20260614000700_operational_unit_id.sql` (ADD NULL→backfill→SET NOT NULL on appointments/charges/receivables)

## Verification
- `npx supabase db push --yes` → "Finished supabase db push." (8/8 applied)
- `database.types.ts` regenerated from `--linked` live schema
- `npx vitest run` phase-7 tests: **86/86 GREEN**
- `npx tsc --noEmit`: exit 0
- `npx next build`: green

## Notes
- Commit: `(types)` regen committed; migration SQL committed in 07-02/07-03.
- Existing v1 clinics each got 1 default unit; dentist/receptionist users assigned to their clinic's default unit via backfill.

## Self-Check: PASSED
