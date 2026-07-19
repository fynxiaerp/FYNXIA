---
phase: 19-relat-rios-or-amento-bi
plan: 06
subsystem: api
tags: [supabase, server-actions, zod, vitest, tdd, financeiro, societario]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 01)
    provides: pure partner-share math (resolveActiveShares, validateSharesSumTo100, distributeResult) in src/lib/financeiro/partner-share-math.ts
  - phase: 19-relat-rios-or-amento-bi (Plan 03)
    provides: partner_shares table + RLS (self-row read for socio, admin/superadmin write)
provides:
  - "listSocios/listPartnerShares/createPartnerShareVigencia/closePartnerShareVigencia/getPartnerDistribution Server Actions in src/actions/partner-shares.ts"
  - "partnerShareSetSchema Zod validation in src/lib/financeiro/partner-share-schema.ts"
affects: [19-12 (Societário screen consumes getPartnerDistribution/listPartnerShares/listSocios)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vigência history preservation: close prior open rows (vigencia_fim = day-before) before inserting new vigente rows — never mutates/deletes history (mirrors tax_tables pattern)"
    - "Sum-to-100% gate enforced in Server Action BEFORE any write, wrapping Plan 01 pure math (assertSharesValid)"
    - "Consolidated financial resultado computed inline (no cost_center filter) to keep this plan decoupled from the DRE action (Plan 04)"

key-files:
  created:
    - src/lib/financeiro/partner-share-schema.ts
    - src/actions/partner-shares.ts
    - src/actions/__tests__/partner-shares.test.ts
  modified: []

key-decisions:
  - "priorCloseDate/assertSharesValid exported as async functions (not plain sync) — every top-level export of a 'use server' file must be async (D-141/D-142/D-143 precedent)"
  - "priorCloseDate uses Date.UTC arithmetic (not lexicographic string compare) because it computes a new date, unlike the resolution/comparison logic in partner-share-math.ts which stays lexicographic"
  - "getPartnerDistribution relies entirely on partner_shares RLS to scope rows per caller (admin all, socio own) — no additional client-trusted filtering layered on top (T-19-02)"

requirements-completed: [REP-03]

# Metrics
duration: 6min
completed: 2026-07-19
---

# Phase 19 Plan 06: Societário Server Actions Summary

**Partner-share vigência CRUD with a blocking 100%-sum gate and history-preserving close-then-insert writes, plus R$-per-sócio distribution computed inline from the consolidated (all-units) financial result.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T18:10:49-03:00
- **Completed:** 2026-07-19T18:16:24-03:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `createPartnerShareVigencia` rejects any proposed set that doesn't sum to exactly 100% (tolerance 0.0001) before touching the database, and — once valid — closes all currently-open vigências (`vigencia_fim = day-before-new-inicio`) before inserting the new vigente rows, preserving full history
- `getPartnerDistribution` computes the consolidated resultado directly from `financial_transactions` (no `cost_center_id` filter, includes NULL-cost-center rows) and distributes it via the Plan 01 pure `distributeResult`, preserving negative signs per sócio
- Write access (`createPartnerShareVigencia`/`closePartnerShareVigencia`) is gated in-action to `admin`/`superadmin` as defense-in-depth on top of the Plan 03 RLS write policy
- `listSocios` resolves sócios as `users` rows with `role='socio'` in the caller's tenant

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Task 1; Task 2 landed in the same GREEN commit since it extends the same file):

1. **Task 1: partner-share-schema.ts + vigência CRUD with 100% validation** — RED `f534871` (test), GREEN `6759451` (feat)
2. **Task 2: getPartnerDistribution over consolidated result** — included in `6759451` (feat, same file)

_Note: Task 2 was implemented in the same commit as Task 1's GREEN phase because both tasks modify the single `src/actions/partner-shares.ts` file and were developed together for coherence; all of Task 2's acceptance criteria are independently verified below._

## Files Created/Modified
- `src/lib/financeiro/partner-share-schema.ts` - `partnerShareSetSchema` Zod schema (vigenciaInicio + shares[], no `.default()`)
- `src/actions/partner-shares.ts` - `'use server'` module: `SHARE_WRITE_ROLES`, `priorCloseDate`, `assertSharesValid`, `listSocios`, `listPartnerShares`, `createPartnerShareVigencia`, `closePartnerShareVigencia`, `getPartnerDistribution`
- `src/actions/__tests__/partner-shares.test.ts` - 12 tests: `assertSharesValid` (valid/invalid/rounding), `priorCloseDate` (month-end, year rollover), write role gate, `getPartnerDistribution` no-write assertion

## Decisions Made
- `priorCloseDate`/`assertSharesValid` exported as `async` (not plain sync functions) to satisfy the Next.js `'use server'` constraint that every top-level export must be an async function — mirrors the `isMonthLocked`/`computeBudgetCell` precedent in `budget-targets.ts`
- Date arithmetic in `priorCloseDate` uses `Date.UTC(...)` construction/mutation rather than the lexicographic string comparison used for vigência *resolution* in `partner-share-math.ts` — the two are different operations (compute a new date vs. compare two dates) and only the latter is safe/specified as string-lexicographic
- `getPartnerDistribution` does zero additional server-side filtering on top of RLS-scoped `partner_shares` rows — a `socio` caller naturally receives only their own row because RLS already filtered it (T-19-02)

## Deviations from Plan

None — plan executed as written. One test-infrastructure fix was needed during TDD GREEN (Rule 1 — the test's own mock, not production code):

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock returned the wrong shape when `listSocios` and `getActor` both queried the `users` table**
- **Found during:** Task 1/2 GREEN verification (`getPartnerDistribution` test)
- **Issue:** The shared `makeQueryBuilder` mock always resolved `'users'` queries to the single actor object, regardless of whether the calling code expected a single row (`getActor`, uses `.single()`) or an array (`listSocios`, uses `.order()` with no `.single()`) — causing `(data ?? []).map is not a function` when the mock's actor object flowed into `listSocios`'s array-mapping code
- **Fix:** Disambiguated the mock's `'users'` branch by inspecting the `select()` columns argument — `tenant_id` present → actor lookup shape, absent → empty-array socios-list shape. Also corrected two test fixtures using non-UUID placeholder `userId` values (`'u-2'`) to valid UUID strings so `partnerShareSetSchema` would accept them instead of failing shape validation before reaching the sum-to-100% assertion under test
- **Files modified:** `src/actions/__tests__/partner-shares.test.ts` (test-only change; no production code affected)
- **Verification:** `npx vitest run src/actions/__tests__/partner-shares.test.ts` — 12/12 passing
- **Committed in:** `6759451` (part of the GREEN task commit)

---

**Total deviations:** 1 auto-fixed (test-mock bug, Rule 1)
**Impact on plan:** Test-only fix; no production code scope creep.

## Issues Encountered
None beyond the test-mock fix documented above.

## Verification

- `npx vitest run src/actions/__tests__/partner-shares.test.ts` — 12/12 passing
- `npx vitest run` (full suite) — 1821/1825 passing; the 4 pre-existing failures are all in `src/__tests__/governance/bi-forecast-agent.test.ts`, an intentionally-committed RED governance scaffold for the not-yet-built Plan 19-08 agent (per STATE.md decision "Governance guard for bi-forecast-agent.ts committed RED before the agent exists"), unrelated to this plan
- `npx tsc --noEmit` — 43 errors, identical to the documented pre-existing baseline (phase 14-16 test files, per STATE.md decision "43 pre-existing tsc --noEmit errors ... accepted as out-of-scope") — zero new errors from this plan's files
- Acceptance criteria: `'use server'` present, `SHARE_WRITE_ROLES = ['admin', 'superadmin']` (no `'socio'`), `validateSharesSumTo100` used, `createPartnerShareVigencia`/`getPartnerDistribution` exported, `distributeResult` used, no `.from('financial_transactions').insert` anywhere in the file, `partner-share-schema.ts` has no `.default(` in actual schema code (a design-rationale code comment mentions the string but does not invoke it)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- REP-03 data layer is complete: `getPartnerDistribution`, `listPartnerShares`, `listSocios`, `createPartnerShareVigencia`, `closePartnerShareVigencia` are ready for the Societário screen (Plan 12) to import directly
- No blockers for Plan 12

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

All created files verified to exist on disk; both commit hashes (`f534871`, `6759451`) verified present in git log.
