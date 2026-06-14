# Phase 09 Plan 04: [BLOCKING] DB Push + Type Regen — Summary

**One-liner:** Applied the 3 integration-hub migrations to the live Supabase DB and regenerated types (guarded).

## Task
| Task | Result |
|------|--------|
| [BLOCKING] supabase db push + gen types (human-action checkpoint) | 3 migrations applied; CLI already on FYNXIA (●, org kczvihafddupruvsrrsc); types regenerated via temp-file guard (2221 lines; integration_connectors/integration_events present) |

## Migrations applied (live)
- `20260615000400_integration_connectors.sql` — connector registry (clinic_id NULLABLE system rows, credential_enc AES, status, config jsonb), RLS USING+WITH CHECK, index clinic_id, seed asaas/whatsapp/email disabled placeholders
- `20260615000500_integration_events.sql` — event log (connector_id FK SET NULL, clinic_id NULLABLE, direction, status TEXT CHECK pending/sent/failed, attempts, last_error, payload_ref), RLS, 3 indexes
- `20260615000600_integration_revoke.sql` — REVOKE SELECT (credential_enc) FROM authenticated, anon

## Verification
- `npx supabase db push --yes` → 3/3 applied
- types regenerated (temp-file truncation guard), tsc exit 0
- 72 integration tests GREEN; `next build` green (/api/cron/integration-retry present)

## Self-Check: PASSED
