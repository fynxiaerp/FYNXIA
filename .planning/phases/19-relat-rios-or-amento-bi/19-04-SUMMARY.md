---
phase: 19-relat-rios-or-amento-bi
plan: 04
subsystem: backend
tags: [server-actions, dre, financeiro, rbac, supabase]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi
    plan: 01
    provides: "aggregateDre pure function + DreResult/DreTxRow/DreLine types (src/lib/financeiro/dre-math.ts)"
  - phase: 19-relat-rios-or-amento-bi
    plan: 03
    provides: "budget_targets/partner_shares/kpi_targets/bi_alerts schema live on Supabase (unblocks type-checking; DRE itself reads only pre-existing financial_transactions/chart_of_accounts/cost_centers)"
  - phase: 14-financeiro-cadastros-base
    provides: "chart_of_accounts (type: grupo/receita/despesa), cost_centers (unit_id FK)"
  - phase: 07-sistema-multiunidade-pap-is
    provides: "units table + listUnits() Server Action"
provides:
  - "src/actions/dre.ts — getDre/getDreByUnit/getDreYoY/getDreDrilldown Server Actions, all gated to admin/socio/superadmin (DRE_ROLES)"
  - "resolveDreCostCenterFilter + computeYoyAvailability pure helpers, unit-tested independent of Supabase"
affects: [19-10 (DRE UI page — imports getDre/getDreByUnit/getDreYoY/getDreDrilldown from src/actions/dre.ts)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-144 absolute-path dynamic-import + existsSync-guard test scaffold, extended from bank-statements.test.ts to a new src/actions/__tests__ location"
    - "Pure decision logic wrapped in async functions exported from a 'use server' file (resolveDreCostCenterFilter, computeYoyAvailability) — satisfies the Next.js 'use server' async-export-only constraint (D-141/D-142/D-143 precedent) without a separate lib file"
    - "String year-shift (slice + arithmetic on YYYY-MM-DD) for YoY period math — no Date object parsing, avoids timezone drift (mirrors partner-share vigência lexicographic-compare pattern, D-287)"

key-files:
  created:
    - src/actions/dre.ts
    - src/actions/__tests__/dre.test.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "vitest.config.ts include glob extended with 'src/actions/**/__tests__/**/*.test.ts' (Rule 3 — blocking fix): the plan's stated verify command (`npx vitest run src/actions/__tests__/dre.test.ts`) silently found 0 test files under the pre-existing config, which only included src/__tests__/** and src/lib/**/__tests__/**; confirmed by reproducing with a throwaway smoke test before touching real code"
  - "Pure resolveDreCostCenterFilter/computeYoyAvailability kept as exported async functions inside dre.ts itself (not a new lib file) — 'use server' requires every top-level export to be an async function; wrapping trivial pure logic in async satisfies that constraint while staying within the plan's declared files_modified (src/actions/dre.ts, src/actions/__tests__/dre.test.ts only)"
  - "getDre re-invoked internally by getDreByUnit (per unit) and getDreYoY (current + prior period, via Promise.all) rather than extracting a shared non-actor-gated core — each call re-runs the DRE_ROLES gate, which is cheap (in-memory) and keeps every entry point independently safe against direct invocation"

patterns-established:
  - "Manual-Only DB-query-touching verification deferred to 19-VALIDATION.md (per plan's <behavior> note) — unit tests target only the pure resolution/gate/YoY-availability decisions, matching the phase's Wave-0 test-coverage plan"

requirements-completed: [REP-01]

# Metrics
duration: ~20min
completed: 2026-07-19
---

# Phase 19 Plan 04: DRE Read-Time Aggregation Server Actions Summary

**`src/actions/dre.ts` — 4 role-gated Server Actions (getDre, getDreByUnit, getDreYoY, getDreDrilldown) that thinly wrap the Plan 01 `aggregateDre` pure function over live `financial_transactions`, with a TDD-covered pure unit→cost-center resolver and YoY-availability decision.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-19

## What Was Built

`src/actions/dre.ts` ('use server') exports:

- **`getDre({ from, to, unitId? })`** — D-01/D-02/D-03: queries `financial_transactions` joined to `chart_of_accounts(name, type, parent_id)` for the period, applies the unit/consolidated cost-center filter, and returns `aggregateDre(rows)` (receitaTotal/despesaTotal/resultado/margem/lines). Consolidated ("Todas", no `unitId`) applies **no** `cost_center_id` filter — includes NULL-cost-center rows (D-03/A4). A specific unit resolves `unitId → cost_center_ids` via `cost_centers` and filters `IN` those ids; 0 cost centers short-circuits to an empty `DreResult` with no `financial_transactions` query.
- **`getDreByUnit({ from, to })`** — D-04: calls `listUnits()` then `getDre()` per unit, returns a ranking array sorted by `resultado` descending for the consolidated comparative table.
- **`getDreYoY({ from, to, unitId? })`** — D-11: fetches the earliest `transaction_date` for the tenant, decides availability via `computeYoyAvailability`, and — only when available — runs the prior-year and current-year `getDre()` calls in parallel, returning `{ available: true, dre: <prior-year DreResult>, resultadoDelta }`. When history is `<12` months, returns `{ success: true, available: false }` so the UI can render "comparação indisponível" without erroring.
- **`getDreDrilldown({ from, to, unitId?, accountId })`** — D-05: the only export that ships row-level `financial_transactions` data to the client, scoped to one `account_id` + period + unit/consolidated filter.

All four are gated by `DRE_ROLES = ['admin', 'socio', 'superadmin']` at the action layer (T-19-01, D-09) — `financial_transactions` RLS grants SELECT to all tenant roles with no role filter, so this in-code gate is the only enforcement point, mirroring the `COST_ROLES` pattern from `setLabOrderCost` (Phase 13).

Two pure helpers are exported for testability (both wrapped in `async` to satisfy the Next.js `'use server'` all-exports-must-be-async constraint, since no I/O is otherwise needed):

- **`resolveDreCostCenterFilter(unitId, costCenterIdsForUnit)`** → `{ mode: 'consolidated' | 'unit' | 'empty', costCenterIds? }`
- **`computeYoyAvailability(earliestTransactionDate, from, to)`** → `{ available, shiftedFrom?, shiftedTo? }` — shifts `from`/`to` exactly one year earlier via string year-arithmetic (no `Date` parsing, no timezone drift), and is available only when the tenant's earliest transaction predates `from` by ≥12 months (inclusive).

## TDD Flow

1. **RED** (`0b5b611`): wrote `src/actions/__tests__/dre.test.ts` (10 tests, D-144 absolute-path dynamic-import pattern) before `dre.ts` existed — confirmed all 10 failed with "Cannot find module".
2. **GREEN** (`00604b0`): implemented `src/actions/dre.ts` — all 10 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `vitest.config.ts` did not include `src/actions/**` — the plan's own verify command found 0 tests**
- **Found during:** Task 1, before writing the RED test
- **Issue:** `vitest.config.ts`'s `test.include` only listed `src/__tests__/**/*.test.ts` and `src/lib/**/__tests__/**/*.test.ts`. The plan's stated `<verify>` command, `npx vitest run src/actions/__tests__/dre.test.ts`, would silently report "No test files found, exiting with code 1" regardless of the test file's content — reproduced this with a throwaway smoke-test file before touching real code.
- **Fix:** Added `'src/actions/**/__tests__/**/*.test.ts'` to `test.include` in `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Commit:** `0b5b611`

No other deviations — plan executed as written otherwise.

## Verification

- `npx vitest run src/actions/__tests__/dre.test.ts` — 10/10 passed
- `npx vitest run` (full suite) — 1795/1799 passed; the 4 failures are in `src/__tests__/governance/bi-forecast-agent.test.ts`, a pre-existing RED scaffold committed in Plan 19-02 targeting Plan 19-08 (not yet executed) — unrelated to this plan, confirmed via `git log` on that file.
- `npx tsc --noEmit` — 43 pre-existing errors, identical set/count to the baseline documented in 19-03-SUMMARY.md (phase 14-16 test files); zero errors in `src/actions/dre.ts` or `src/actions/__tests__/dre.test.ts`.

## Self-Check: PASSED

- FOUND: src/actions/dre.ts
- FOUND: src/actions/__tests__/dre.test.ts
- FOUND commit: 0b5b611 (RED)
- FOUND commit: 00604b0 (GREEN)
