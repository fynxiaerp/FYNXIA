---
phase: 19-relat-rios-or-amento-bi
plan: 03
subsystem: database
tags: [supabase, postgres, rls, migrations, budget, partner-shares, kpi, bi-alerts]

# Dependency graph
requires:
  - phase: 14-financeiro-cadastros-base
    provides: chart_of_accounts table (FK target for budget_targets.account_id)
  - phase: 16-contas-a-pagar-conciliacao-tributos
    provides: tax_tables vigência column shape replicated by partner_shares
  - phase: 10-ia-governada-l0-l4-auditoria-ocr
    provides: ai_agent_config table + L0-L4 autonomy_level convention (bi_forecast seed)
provides:
  - "budget_targets, partner_shares, kpi_targets, bi_alerts tables live on Supabase (sa-east-1)"
  - "RLS policies enforcing D-14 (sócio writes budget_targets), D-24/T-19-04 (sócio self-row-only partner_shares read), A1/T-19-05 (sócio cannot write partner_shares), T-19-06 (bi_alerts service-role-write-only)"
  - "ai_agent_config seeded with agent_key='bi_forecast', autonomy_level='L1', enabled=true for every active clinic (network-level, unit_id NULL)"
  - "Regenerated src/lib/supabase/database.types.ts including all 4 new tables — unblocks every Wave-2 backend plan (05-14) that type-checks against them"
affects: [19-05 (budget_targets Server Actions), 19-06 (partner_shares Server Actions), 19-08 (bi-forecast-agent.ts, kpi_targets/bi_alerts), all Wave-2/3/4 plans in phase 19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vigência table shape (vigencia_inicio/vigencia_fim DATE) replicated exactly from tax_tables migration"
    - "Partial unique indexes WHERE unit_id IS NULL / IS NOT NULL for network-vs-unit scoping (budget_targets, kpi_targets), mirrors ai_agent_config"
    - "Service-role-write-only table (bi_alerts) — zero authenticated INSERT/UPDATE/DELETE policy, mirrors stock_alerts/nps_responses"
    - "Truncation-guard type regen: gen types into a distinct step, verified for budget_targets/partner_shares/bi_alerts content before replacing database.types.ts"

key-files:
  created:
    - supabase/migrations/20260719000100_bi_tables.sql
    - supabase/migrations/20260719000200_bi_rls.sql
    - supabase/migrations/20260719000300_bi_seed.sql
  modified:
    - src/lib/supabase/database.types.ts

key-decisions:
  - "supabase db push executed by the orchestrator directly (not this executor sub-agent) after explicit user confirmation, per the plan's checkpoint:human-action gate — CLI-login-only per memory fynxia-cli-auth-only, never the MCP connector"
  - "43 pre-existing tsc --noEmit errors (tiss.test.ts, chart-of-accounts.test.ts, migrations-phase14.test.ts, ofx-parser.test.ts, payout-math.test.ts, reconciliation.test.ts, transaction-classification.test.ts, dre-math.test.ts — phases 14-16) are out of scope: verified pre-existing by re-running tsc with database.types.ts removed, identical 43-error count, zero errors reference budget_targets/partner_shares/kpi_targets/bi_alerts or any phase-19 source file"

patterns-established:
  - "bi_alerts: zero-authenticated-write table pattern extended to BI/forecast domain (agent/cron writes via service role only)"

requirements-completed: [REP-02, REP-03, BI-01, BI-02]

# Metrics
duration: ~4min
completed: 2026-07-19
---

# Phase 19 Plan 03: BI Schema Foundation (budget_targets, partner_shares, kpi_targets, bi_alerts) Summary

**4 new tables (budget_targets, partner_shares, kpi_targets, bi_alerts) + RLS + bi_forecast agent seed, applied to the live Supabase DB via `supabase db push` and reflected in a regenerated `database.types.ts` — schema foundation for every Wave-2+ backend plan in Phase 19.**

## Performance

- **Duration:** ~4 min (17:40:10 → 17:44:03 -03:00)
- **Started:** 2026-07-19T20:40:10Z
- **Completed:** 2026-07-19T20:44:03Z
- **Tasks:** 3
- **Files modified:** 4 (3 new migrations, 1 regenerated types file)

## Accomplishments
- `budget_targets` (D-12/D-13): meta per account + unit + ano + mês, with partial unique indexes for network-level (unit_id NULL) vs. unit-level rows.
- `partner_shares` (D-20): percentual per sócio with `vigencia_inicio`/`vigencia_fim`, replicating the `tax_tables` vigência column shape exactly.
- `kpi_targets` (D-30): meta per kpi_key + unit, same network/unit partial-unique pattern as `budget_targets`.
- `bi_alerts` (D-33/D-35): agent/cron-produced alerts with `approval_request_id` logical FK, `status` (active/dismissed), zero authenticated write policy.
- RLS: sócio can write `budget_targets` (D-14) but only read their own `partner_shares` row (D-24/T-19-04) and cannot write `partner_shares` at all (A1/T-19-05); `bi_alerts` has no authenticated INSERT/UPDATE/DELETE policy (T-19-06, service-role writes only).
- `ai_agent_config` seeded with `agent_key='bi_forecast'`, `autonomy_level='L1'`, `enabled=true` for every active clinic.
- Live database migrated (`supabase db push` — 3 migrations applied cleanly) and `src/lib/supabase/database.types.ts` regenerated to include all 4 new tables.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bi_tables.sql (4 tables + indexes)** - `b138082` (feat)
2. **Task 2: Create bi_rls.sql + bi_seed.sql** - `26d5514` (feat)
3. **Task 3: [BLOCKING] supabase db push + regenerate types** - `6c033fe` (chore)

**Plan metadata:** pending (this commit)

_Note: Task 3's `supabase db push` and `supabase gen types` commands were run by the orchestrator directly (checkpoint:human-action gate, human confirmation required for a live-DB push); this executor agent verified the result and committed the regenerated types file._

## Files Created/Modified
- `supabase/migrations/20260719000100_bi_tables.sql` - CREATE TABLE for budget_targets, partner_shares, kpi_targets, bi_alerts + indexes
- `supabase/migrations/20260719000200_bi_rls.sql` - RLS ENABLE + USING/WITH CHECK policies for all 4 tables per D-14/D-24/A1/T-19-04/T-19-05/T-19-06
- `supabase/migrations/20260719000300_bi_seed.sql` - `ai_agent_config` seed for `bi_forecast` agent, L1, network-level, every active clinic
- `src/lib/supabase/database.types.ts` - Regenerated from live schema post-push; first commit of this file in the repo (previously always regenerated fresh, never version-controlled)

## Decisions Made
- `supabase db push` + `supabase gen types` were executed by the orchestrator directly after explicit user confirmation (the plan's checkpoint:human-action gate), following the CLI-login-only convention (memory `fynxia-cli-auth-only`) — never the claude.ai/MCP Supabase connector, which is bound to the wrong account.
- The 43 pre-existing `tsc --noEmit` errors (all in phase 14-16 test files: tiss.test.ts, chart-of-accounts.test.ts, migrations-phase14.test.ts, ofx-parser.test.ts, payout-math.test.ts, reconciliation.test.ts, transaction-classification.test.ts, dre-math.test.ts) are explicitly out of scope for this plan — verified pre-existing by re-running `tsc --noEmit` with `database.types.ts` removed and observing the identical 43-error count; zero errors reference `budget_targets`/`partner_shares`/`kpi_targets`/`bi_alerts` or any phase-19 source file.

## Deviations from Plan

None - plan executed exactly as written. The database push (Task 3) is a `checkpoint:human-action` gate by design; it was carried out by the orchestrator with user confirmation rather than by this sub-agent, which is the intended flow for blocking live-DB operations.

## Issues Encountered
None.

## User Setup Required
None - the required external action (Supabase CLI login + DB push) was already completed by the orchestrator before this agent resumed.

## Next Phase Readiness
- Schema foundation is live; Wave-2 backend plans (19-05 budget_targets actions, 19-06 partner_shares actions, 19-08 bi-forecast-agent.ts + kpi_targets/bi_alerts) can now type-check against the real `database.types.ts` instead of a false-positive pre-push state.
- No blockers. The pre-existing 43 tsc errors in phase 14-16 test files remain tracked as known technical debt, unrelated to this plan's scope.

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260719000100_bi_tables.sql
- FOUND: supabase/migrations/20260719000200_bi_rls.sql
- FOUND: supabase/migrations/20260719000300_bi_seed.sql
- FOUND: src/lib/supabase/database.types.ts
- FOUND commit: b138082
- FOUND commit: 26d5514
- FOUND commit: 6c033fe
