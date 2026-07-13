# Deferred Items — Phase 18 CRC & Marketing

Out-of-scope discoveries found during execution but not fixed (Scope Boundary rule:
only auto-fix issues directly caused by the current task's changes).

## From Plan 02 (migrations + db push + type regen)

**41 pre-existing `tsc --noEmit` errors in unrelated Phase 14-16 financeiro test files**
- Found during: Task 3 (type regeneration truncation guard / tsc verification)
- Files: `src/__tests__/faturamento/tiss.test.ts`, `src/__tests__/financeiro/chart-of-accounts.test.ts`,
  `src/__tests__/financeiro/migrations-phase14.test.ts`, `src/__tests__/financeiro/transaction-classification.test.ts`,
  `src/__tests__/financeiro16/payables.test.ts`, `src/lib/financeiro/__tests__/ofx-parser.test.ts`,
  `src/lib/financeiro/__tests__/payout-math.test.ts`, `src/lib/financeiro/__tests__/reconciliation.test.ts`
- Errors: `TS2532: Object is possibly 'undefined'` (array-index access without optional chaining in tests) and
  `TS1501: This regular expression flag is only available when targeting 'es2018' or later` (`/s` dotAll flag,
  same class of issue previously fixed in `approvals.test.ts` per STATE.md decision log 2026-06-14).
- Confirmed pre-existing (not caused by this plan): ran `git stash push -- src/types/database.types.ts`,
  re-ran `tsc --noEmit`, diffed output against the post-regen run — byte-for-byte identical (41 errors, same
  lines) both before and after the CRC type regeneration. None of the 41 errors reference `database.types.ts`,
  `leads`, `campaigns`, `nps_responses`, `referrals`, `referral_rewards`, or any Phase 18 file.
- Not fixed: entirely outside Phase 18's file scope (Phase 14-16 test files).
- Recommendation: fix in a dedicated Phase 14-16 test-hygiene pass, or when those tests are next touched.
