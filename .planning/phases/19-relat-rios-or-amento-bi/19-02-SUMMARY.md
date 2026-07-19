---
phase: 19-relat-rios-or-amento-bi
plan: 02
subsystem: bi
tags: [ols, linear-regression, forecasting, governance, vitest, tdd]

# Dependency graph
requires:
  - phase: 17-estoque-materiais
    provides: withAgentPolicy per-clinic call convention (stock-agent.ts template)
  - phase: 10-ia-governada-l0-l4-auditoria-ocr
    provides: withAgentPolicy / approval_requests governance framework
provides:
  - "src/lib/bi/forecast-math.ts: computeLinearTrend (OLS) + isDecliningVsTrend, pure/zero-dependency"
  - "RED source-inspection governance guard for the future bi-forecast-agent.ts (Plan 08 target)"
affects: [19-08 (BI forecast agent + cron), 19-relat-rios-or-amento-bi wave 2/3 plans consuming forecast-math]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure hand-rolled OLS linear regression (deliberate exception to Don't-Hand-Roll — 19-RESEARCH) mirrors payout-math.ts convention"
    - "RED governance source-inspection guard pre-committed before the agent exists, mirrors approvals.test.ts SRC()-helper + D-144 absolute-path existsSync guard"

key-files:
  created:
    - src/lib/bi/forecast-math.ts
    - src/lib/bi/__tests__/forecast-math.test.ts
    - src/__tests__/governance/bi-forecast-agent.test.ts
  modified: []

key-decisions:
  - "Hand-rolled OLS (no simple-statistics/regression package) — 19-RESEARCH 'Don't Hand-Roll' deliberate exception, ~15 lines, trivially unit-testable, avoids new dependency for a nightly cron job"
  - "ys[i] ?? 0 guard added in computeLinearTrend's reduce callback to satisfy tsconfig strict indexed-access checking (TS2532) — no behavior change, i is always in-bounds"

patterns-established:
  - "Pattern 4 (19-RESEARCH): governance guard committed as RED before the agent it targets is built, documenting the exact per-clinic withAgentPolicy + approval_requests-only-mutation contract Plan 08 must satisfy"

requirements-completed: [BI-01, BI-02]

# Metrics
duration: 2min
completed: 2026-07-19
---

# Phase 19 Plan 02: BI Forecast Math + Governance Guard Summary

**Hand-rolled OLS linear trend (slope/intercept/projectedNext) and decline-vs-trend detection in `src/lib/bi/forecast-math.ts`, plus a pre-committed RED governance guard for the Plan 08 BI forecast agent's per-clinic `withAgentPolicy` contract.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-19T17:34:38-03:00
- **Completed:** 2026-07-19T17:36:23-03:00
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- `computeLinearTrend`: ordinary least squares (x=0..n-1, y=monthly value) matching hand-verified known values (slope=10/intercept=10/projectedNext=50 for a perfectly increasing 4-point series; flat series → slope=0); `insufficientData=true` below 3 points per D-32, with `projectedNext` falling back to the last known value (or 0 for an empty series).
- `isDecliningVsTrend`: fires only when `actual` is more than 15% below `projected` (D-33b default threshold via `DECLINE_THRESHOLD_PCT`), with a divide-by-zero guard when `projected <= 0`.
- A RED source-inspection governance test (`src/__tests__/governance/bi-forecast-agent.test.ts`) that pre-commits the contract Plan 08's `bi-forecast-agent.ts` must satisfy: calls `withAgentPolicy`, registers `agentKey: 'bi_forecast'`, never passes a literal `clinicId: null`, and mutates only `approval_requests` (never `budget_targets` directly, per D-34).

## Task Commits

Each task was committed atomically (TDD RED→GREEN split per task 1):

1. **Task 1 RED: forecast-math failing test** - `0ee7bba` (test)
2. **Task 1 GREEN: forecast-math implementation** - `84dea7c` (feat)
3. **Task 2: RED governance guard for BI forecast agent** - `7f8c89c` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/lib/bi/forecast-math.ts` - Pure OLS trend (`computeLinearTrend`) + decline detector (`isDecliningVsTrend`) + `DECLINE_THRESHOLD_PCT` constant; no I/O, no `'use server'`, no Supabase import
- `src/lib/bi/__tests__/forecast-math.test.ts` - 9 passing unit tests covering increasing/flat/insufficient(2pt)/empty trend cases and all 4 decline-threshold cases
- `src/__tests__/governance/bi-forecast-agent.test.ts` - Source-inspection guard, RED by design (agent file doesn't exist yet) until Plan 08

## Decisions Made
- Hand-rolled OLS instead of adding a stats/regression package — matches 19-RESEARCH's explicit "Deliberate exception" call-out; keeps the BI forecasting surface fully unit-testable and dependency-free.
- Added a `?? 0` fallback on `ys[i]` inside the OLS reduce loop to satisfy this repo's strict TypeScript indexed-access checking (no logical change — `i` is always a valid index within the same-length `xs`/`ys` arrays).

## Deviations from Plan

None - plan executed exactly as written. The `ys[i] ?? 0` type-safety addition is a mechanical strict-TypeScript compliance fix (Rule 1 — bug/compile-error prevention), not a behavior or scope change; documented above for completeness.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `forecast-math.ts` is ready to be imported by the Plan 08 `bi-forecast-agent.ts` and by the `/api/cron/bi-previsoes` route (19-RESEARCH Pattern 5).
- The governance guard (`bi-forecast-agent.test.ts`) stays intentionally RED — this is expected Wave-1 state, not a defect. It will turn GREEN when Plan 08 creates `src/lib/agents/bi-forecast-agent.ts` following the stock-agent.ts template (per-clinic `withAgentPolicy`, `agentKey: 'bi_forecast'`, mutating only `approval_requests`).
- No blockers for downstream Phase 19 plans (DRE/Orçamento/Societário math already landed in Plan 01; this plan's forecast-math.ts is an independent, already-consumable pure module).

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/lib/bi/forecast-math.ts
- FOUND: src/lib/bi/__tests__/forecast-math.test.ts
- FOUND: src/__tests__/governance/bi-forecast-agent.test.ts
- FOUND commit: 0ee7bba
- FOUND commit: 84dea7c
- FOUND commit: 7f8c89c
