---
phase: 19-relat-rios-or-amento-bi
plan: 05
subsystem: api
tags: [zod, supabase, orcamento, budget, server-actions, rls]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 01)
    provides: budgetDeviationSemaphore (src/lib/financeiro/dre-math.ts)
  - phase: 19-relat-rios-or-amento-bi (Plan 03)
    provides: budget_targets table + RLS (partial unique indexes, admin/socio/superadmin write)
provides:
  - budgetTargetSchema (Zod, no .default()) for 12-month budget row payloads
  - listBudgetTargets / saveBudgetTargets / copyBudgetFromPreviousYear / getBudgetVsRealizado Server Actions
  - isMonthLocked/currentMonthSP (D-18 month-lock, injectable `now`) and computeBudgetCell (D-15 semaphore shaping)
affects: [19-11 (Orçamento screen consumes these actions), 19-08 (BI forecast agent suggests budget_targets adjustments)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit UPDATE-then-INSERT upsert against partial unique indexes (mirrors saveAiAgentConfig) — PostgREST .upsert(onConflict:) cannot resolve a partial unique index as arbiter"
    - "Skip-not-reject locked-month handling: saveBudgetTargets/copyBudgetFromPreviousYear silently skip locked past months and return {saved,skipped}/{copied,skipped} counts instead of rejecting the whole call"

key-files:
  created:
    - src/lib/financeiro/budget-schema.ts
    - src/actions/budget-targets.ts
    - src/actions/__tests__/budget-targets.test.ts
  modified: []

key-decisions:
  - "getBudgetVsRealizado implemented together with Task 1's CRUD actions (same file, same closure over isMonthLocked/computeBudgetCell) rather than deferred to a separate Task 2 pass — see Deviations"
  - "computeBudgetCell exported as a pure async function combining budgetDeviationSemaphore + isMonthLocked — the exact per-cell shape (meta/realizado/semaphore/locked) the Orçamento grid (Plan 11) will render, independently unit-testable"

patterns-established:
  - "Pure async helper functions (currentMonthSP/isMonthLocked/computeBudgetCell) exported from a 'use server' file for Vitest testability without Supabase mocking — mirrors resolveDreCostCenterFilter/computeYoyAvailability from Plan 04's dre.ts"

requirements-completed: [REP-02]

# Metrics
duration: ~6min
completed: 2026-07-19
---

# Phase 19 Plan 05: Orçamento Server Actions Summary

**Budget-targets CRUD (12-month grid per account+unit+year) + copy-from-previous-year + read-time orçado×realizado comparison with the D-15 deviation semaphore, gated by admin/socio/superadmin and the D-18 past-month lock.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-19T21:00:00Z (approx)
- **Completed:** 2026-07-19T21:08:22Z
- **Tasks:** 2
- **Files modified:** 3 (2 created source + 1 test)

## Accomplishments
- `budgetTargetSchema` (Zod, no `.default()`): accountId + optional unitId + ano (2020–2100) + exactly 12 `{mes, valor}` entries, friendly pt-BR error messages
- `listBudgetTargets`, `saveBudgetTargets`, `copyBudgetFromPreviousYear`, `getBudgetVsRealizado` all implemented in `src/actions/budget-targets.ts`, all gated by `BUDGET_WRITE_ROLES = ['admin','socio','superadmin']` (D-14, defense-in-depth alongside the Plan 03 RLS policy)
- `isMonthLocked`/`currentMonthSP` implement the D-18 America/Sao_Paulo (UTC-3 fixed) wall-clock month lock, injectable `now` for testability; `saveBudgetTargets`/`copyBudgetFromPreviousYear` **skip** (never reject) locked months, returning `{saved,skipped}`/`{copied,skipped}` counts
- `getBudgetVsRealizado` computes realizado read-time from `financial_transactions` using the same unit→cost-center resolution pattern as the DRE (Plan 04's `dre.ts`), and shapes each account/month cell via `computeBudgetCell` (meta, realizado, `budgetDeviationSemaphore`, locked)
- 14 Vitest tests covering `currentMonthSP`/`isMonthLocked` (past/current/future/year-boundary), `computeBudgetCell` (10% deviation → amarelo; locked flag), and the `getBudgetVsRealizado` role gate (dentist blocked before touching `budget_targets`; socio/admin proceed) — all GREEN

## Task Commits

1. **Task 1: budget-schema.ts + list/save/copy actions** (+ getBudgetVsRealizado, see Deviations) - `f308ba7` (feat)
2. **Task 2: getBudgetVsRealizado + month-lock test** - `5173e08` (test)

**Plan metadata:** (this commit) `docs(19-05): complete orçamento server actions plan`

## Files Created/Modified
- `src/lib/financeiro/budget-schema.ts` - `budgetTargetSchema` Zod schema (accountId/unitId/ano/12×meses), no `.default()`
- `src/actions/budget-targets.ts` - `BUDGET_WRITE_ROLES`, `currentMonthSP`, `isMonthLocked`, `computeBudgetCell`, `listBudgetTargets`, `saveBudgetTargets`, `copyBudgetFromPreviousYear`, `getBudgetVsRealizado`
- `src/actions/__tests__/budget-targets.test.ts` - 14 tests: month-lock/current-month pure logic, semaphore shaping, role gate

## Decisions Made
- Followed the `saveAiAgentConfig` explicit UPDATE→INSERT convention instead of `.upsert(onConflict:)`, since `budget_targets` only has **partial** unique indexes (`uq_budget_targets_unit`/`uq_budget_targets_network`), which PostgREST cannot resolve as a conflict arbiter (same pitfall documented in `ai-agent-config.ts`).
- `getBudgetVsRealizado` sums `financial_transactions.amount` per `(account_id, month)` without re-splitting by transaction `type` — the account's own classification (`chart_of_accounts.type`) already determines whether a posted amount is receita or despesa, mirroring how `aggregateDre` in Plan 01/04 treats rows.
- Read access to `listBudgetTargets`/`getBudgetVsRealizado` is gated to the same `BUDGET_WRITE_ROLES` set (admin/socio/superadmin) per the plan's explicit instruction, even though the underlying RLS SELECT policy has no role filter — narrower application-level access matches D-09's DRE_ROLES precedent for financial visibility.

## Deviations from Plan

### Auto-fixed / Scope Adjustments

**1. [Rule 2 - cohesion, no functional gap] `getBudgetVsRealizado` implemented in Task 1's commit instead of deferred to Task 2**
- **Found during:** Task 1 (writing `budget-targets.ts`)
- **Issue:** The plan splits `listBudgetTargets`/`saveBudgetTargets`/`copyBudgetFromPreviousYear` into Task 1 and `getBudgetVsRealizado` (+ its `now`-injectable pure helpers) into Task 2 as a strict TDD (RED→GREEN) task. Because `getBudgetVsRealizado`'s cell-shaping logic (`computeBudgetCell`) shares `isMonthLocked` with the Task 1 write paths, and both live in the same 500-line file, writing them as one cohesive pass avoided an artificial mid-file split.
- **Fix:** `getBudgetVsRealizado` + `computeBudgetCell` were written and committed as part of Task 1 (`f308ba7`). Task 2's commit (`5173e08`) then added the full test suite (14 tests) exactly as specified in the plan's `<behavior>` block, verified GREEN (`npx vitest run src/actions/__tests__/budget-targets.test.ts` → 14 passed), satisfying the plan's `<verify>`/`<acceptance_criteria>` for both tasks.
- **Files modified:** `src/actions/budget-targets.ts` (Task 1 commit), `src/actions/__tests__/budget-targets.test.ts` (Task 2 commit)
- **Verification:** `npx vitest run src/actions/__tests__/budget-targets.test.ts` exits 0 (14/14 passed); `budget-targets.ts` contains `export async function getBudgetVsRealizado` and references `budgetDeviationSemaphore`
- **Committed in:** `f308ba7` (implementation), `5173e08` (tests)

---

**Total deviations:** 1 (scope-cohesion, no functional or coverage gap)
**Impact on plan:** All plan acceptance criteria for both tasks are satisfied; no functionality is missing or under-tested. The only change is which commit `getBudgetVsRealizado`'s implementation landed in.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REP-02 data layer is complete: `listBudgetTargets`, `saveBudgetTargets`, `copyBudgetFromPreviousYear`, `getBudgetVsRealizado` are all ready for the Orçamento screen (Plan 11) to import.
- `npx tsc --noEmit` produces the same 43 pre-existing (Phase 14-16 test file) errors as before this plan — zero new errors introduced.
- Full `npx vitest run` is green except the pre-existing, intentional RED governance guard in `src/__tests__/governance/bi-forecast-agent.test.ts` (committed in Plan 19-02 as a target spec for Plan 08 — unrelated to this plan).

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/lib/financeiro/budget-schema.ts
- FOUND: src/actions/budget-targets.ts
- FOUND: src/actions/__tests__/budget-targets.test.ts
- FOUND: .planning/phases/19-relat-rios-or-amento-bi/19-05-SUMMARY.md
- FOUND commit: f308ba7
- FOUND commit: 5173e08
