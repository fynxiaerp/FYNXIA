---
task: 260718-x6c
type: quick
subsystem: crc-marketing
tags: [nextjs, server-actions, build-fix, typescript]

requires:
  - phase: 18-crc-marketing
    provides: referrals.ts Server Actions (linkReferral/listReferrals/listRewardsBalance/creditReferralReward)
provides:
  - "Production build no longer fails on referrals.ts 'use server' export violation"
  - "REFERRAL_REWARD_DEFAULT relocated to src/lib/validators/crc.ts"
affects: [crc-marketing, deploy]

tech-stack:
  added: []
  patterns:
    - "Constants used inside 'use server' files must live in a separate non-'use server' module (mirrors D-197 ai-agent-config-types.ts precedent)"

key-files:
  created: []
  modified:
    - src/lib/validators/crc.ts
    - src/actions/referrals.ts

key-decisions:
  - "REFERRAL_REWARD_DEFAULT moved to src/lib/validators/crc.ts (already imported by referrals.ts for referralSchema) instead of a new file — zero new import statements, single named import added"

patterns-established:
  - "Pattern: non-async constants/values consumed by a 'use server' Server Action file must be declared in a plain (non-'use server') sibling module and imported, never declared locally — Next.js only permits async function value exports from 'use server' files"

requirements-completed: []

duration: 5min
completed: 2026-07-18
---

# Quick Task 260718-x6c: Fix production build break in referrals.ts Summary

**Moved `REFERRAL_REWARD_DEFAULT` constant out of the `'use server'` file `src/actions/referrals.ts` into `src/lib/validators/crc.ts`, restoring a clean production build.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19T02:52:00Z
- **Completed:** 2026-07-19T02:57:54Z
- **Tasks:** 2 (Task 2 was verification-only, no additional code changes needed)
- **Files modified:** 2

## Accomplishments
- Restored a working production build: `src/actions/referrals.ts` (a `'use server'` module) no longer exports a non-async `const`, which was violating Next.js's rule that only async functions may be exported from `'use server'` files.
- Eliminated the cascading compile failure that caused `listReferrals`/`listRewardsBalance` imports to fail in `src/app/(dashboard)/clinica/crc/indicacoes/page.tsx`.
- Verified all four `REFERRAL_REWARD_DEFAULT` usage sites inside `creditReferralReward` (CAS update, ledger insert amount, audit log details) remained untouched — same fixed value `50.0` preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move REFERRAL_REWARD_DEFAULT to crc.ts and update referrals.ts** - `a0f68b2` (fix)
2. **Task 2: Verify no non-async exports remain / build-relevant imports resolve** - verification-only, no code change, folded into Task 1's commit (`a0f68b2`)

## Files Created/Modified
- `src/lib/validators/crc.ts` - Added `export const REFERRAL_REWARD_DEFAULT = 50.0`, co-located below `referralSchema` in the "Referral program (CRC-05, D-16)" section, with a comment explaining why it lives here (mirrors D-197).
- `src/actions/referrals.ts` - Removed the local `export const REFERRAL_REWARD_DEFAULT = 50.0` declaration; updated the import line to `import { referralSchema, REFERRAL_REWARD_DEFAULT } from '@/lib/validators/crc'`. No other exports or call sites changed.

## Decisions Made
- Relocated the constant to the existing `src/lib/validators/crc.ts` (already imported by `referrals.ts` for `referralSchema`) rather than creating a new file — zero new import statements needed, following the exact precedent of D-197 (`AUTONOMY_LEVELS`/`AGENT_KEYS` extracted from `ai-agent-config.ts` to `ai-agent-config-types.ts` for the identical `'use server'` export-restriction reason).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npx tsc --noEmit` reports pre-existing, unrelated errors in test files (`src/__tests__/faturamento/tiss.test.ts`, `src/__tests__/financeiro/*.test.ts`, `src/lib/financeiro/__tests__/*.test.ts`) — all `TS2532`/`TS1501` errors unrelated to this task's files. Confirmed via targeted grep that zero errors reference `referrals.ts`, `validators/crc.ts`, or the `indicacoes/page.tsx` file, satisfying the plan's verification criteria. These pre-existing test errors are out of scope for this quick task (SCOPE BOUNDARY — not caused by this change) and were not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Production build for the CRC/Marketing referral program (`/clinica/crc/indicacoes`) should now compile cleanly on Vercel.
- No blockers introduced. The pre-existing unrelated test-file TypeScript errors remain (out of scope) and should be addressed separately if they block CI.

---
*Task: 260718-x6c*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/lib/validators/crc.ts
- FOUND: src/actions/referrals.ts
- FOUND: a0f68b2 (commit)
