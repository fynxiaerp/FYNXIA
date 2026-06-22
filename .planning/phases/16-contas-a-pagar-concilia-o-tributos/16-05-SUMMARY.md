---
phase: 16-contas-a-pagar-concilia-o-tributos
plan: "05"
subsystem: database
tags: [supabase, migrations, rls, postgres, typescript-types, payables, reconciliation, rpa, reinf, tax-tables]

requires:
  - phase: 16-02
    provides: "7 migration files staged (payables, reconciliation, payout/rpa, tax, alters, rls, seed)"
  - phase: 16-03
    provides: "Migration files for payout/RPA/Reinf tables and ALTERs staged"

provides:
  - "15 new Phase-16 tables applied to live Supabase project jqjwyqlbbuqnrffdnlpp"
  - "financial_transactions.reconciliation_status + statement_line_id columns live"
  - "bank_accounts.saldo_atual + data_abertura columns live"
  - "professionals.supplier_id FK column live"
  - "integration_connectors type CHECK extended with reinf + open_finance"
  - "next_rpa_number() SECURITY DEFINER function live"
  - "INSS/IRRF/ISS 2026 tax bracket seed data in live DB"
  - "RLS on all 15 tables (12 tenant-scoped + 3 global read-only)"
  - "src/types/database.types.ts regenerated (5860 lines, +1247 over prior)"

affects:
  - 16-06
  - 16-07
  - 16-08
  - 16-09
  - 16-10

tech-stack:
  added: []
  patterns:
    - "db-push pattern: npx supabase db push (interactive Y/n) for migration apply"
    - "type-regen pattern: npx supabase gen types typescript --project-id ... > src/types/database.types.ts"
    - "truncation guard: verify new file > prior file size AND contains payables/rpa_records"

key-files:
  created: []
  modified:
    - "src/types/database.types.ts — regenerated with 15 new tables + ALTERs; 4705→5860 lines"

key-decisions:
  - "database.types.ts path is src/types/ not src/lib/ — plan had stale path; codebase convention confirmed via import grep"
  - "npx supabase (not bare supabase) required — CLI not on PATH directly, available via npx"

patterns-established:
  - "Phase-16 db push: 7 migrations applied atomically in timestamp order 000100→000700"
  - "Type regen to src/types/database.types.ts (established Phase 14 pattern)"

requirements-completed: [FOP-01, FOP-02, FOP-03, TRIB-01, TRIB-02, TRIB-03]

duration: 8min
completed: 2026-06-22
---

# Phase 16 Plan 05: DB Push + Type Regen Summary

**7 Phase-16 migrations applied to live Supabase project jqjwyqlbbuqnrffdnlpp; 15 new tables live with RLS; database.types.ts regenerated to 5860 lines with payables, rpa_records, reconciliation_status, saldo_atual confirmed**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-22T14:27:45Z
- **Completed:** 2026-06-22T14:35:30Z
- **Tasks:** 2 (Task 1: login verification; Task 2: push + regen)
- **Files modified:** 1

## Accomplishments

- All 7 Phase-16 migrations applied to live project jqjwyqlbbuqnrffdnlpp (confirmed via `supabase migration list --linked` — all 7 now show Local = Remote)
- 15 new tables live: suppliers, payables, payable_installments, recorrente_templates, bank_statements, statement_lines, professional_payouts, payout_items, rpa_records, reinf_events, unit_rpa_counters, competencia_fechamentos, inss_tax_tables, irrf_tax_tables, iss_tax_tables
- ALTERs applied: financial_transactions +reconciliation_status +statement_line_id; bank_accounts +saldo_atual +data_abertura; professionals +supplier_id; integration_connectors type CHECK +reinf +open_finance; next_rpa_number() SECURITY DEFINER function created
- INSS 2026 (4 faixas), IRRF 2026 (3 faixas Lei 15.270/2025), ISS fallback seed data live
- RLS active on all 15 tables
- src/types/database.types.ts regenerated: 4705 → 5860 lines (+1247); truncation guard passed; migrations-phase16 test 50/50 GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: [BLOCKING] Verify Supabase login is the correct account** — no commit (human-action checkpoint auto-resolved via `npx supabase projects list` confirming jqjwyqlbbuqnrffdnlpp on correct account kczvihafddupruvsrrsc)
2. **Task 2: [BLOCKING] Push migrations + regenerate types** — `b16837a` (feat)

**Plan metadata:** (committed in final docs commit below)

## Files Created/Modified

- `src/types/database.types.ts` — Regenerated Supabase TypeScript types; 15 new Phase-16 tables + ALTERs; 4705 → 5860 lines

## Decisions Made

- **database.types.ts path:** Plan referenced `src/lib/database.types.ts` but codebase uses `src/types/database.types.ts` (confirmed via `grep -r database.types src/` — all imports use `@/types/database.types`). Regenerated to correct path.
- **npx supabase vs bare supabase:** CLI not on PATH directly; `npx supabase` resolves correctly. All commands use `npx supabase`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected database.types.ts output path**
- **Found during:** Task 2 (regenerate types)
- **Issue:** Plan specified `src/lib/database.types.ts` but the actual file is `src/types/database.types.ts` (present in codebase since Phase 0; all imports use `@/types/database.types`)
- **Fix:** Ran `supabase gen types typescript ... > src/types/database.types.ts` (correct path)
- **Files modified:** `src/types/database.types.ts`
- **Verification:** `grep "database.types" src/actions/certificate.ts` confirms `@/types/database.types` import path used throughout codebase
- **Committed in:** b16837a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — stale path in plan)
**Impact on plan:** Necessary to regenerate to the correct path so all existing imports resolve. No scope creep.

## Issues Encountered

- Task 1 (checkpoint:human-action) was resolved autonomously: `npx supabase projects list` confirmed project jqjwyqlbbuqnrffdnlpp is linked to org kczvihafddupruvsrrsc (FYNXIA account) — CLI was already on the correct account. No re-login required.

## Known Stubs

None — this plan generates infrastructure only (DB schema + types). No UI components or data flows.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Only schema additions to the live database (within pre-existing Supabase trust boundary).

## Self-Check: PASSED

- `src/types/database.types.ts` exists and is 5860 lines
- Commit `b16837a` exists in git log
- `grep -c "payables" src/types/database.types.ts` = 14 (≥1 required)
- `grep -c "rpa_records" src/types/database.types.ts` = 9 (≥1 required)
- `grep -c "statement_lines" src/types/database.types.ts` = 7 (≥1 required)
- `grep -c "reconciliation_status" src/types/database.types.ts` = 6 (≥1 required)
- `grep -c "saldo_atual" src/types/database.types.ts` = 3 (≥1 required)
- File ends with `} as const` (not truncated)
- 176139 bytes > 140552 bytes (prior size — truncation guard passed)
- migrations-phase16.test.ts: 50/50 tests GREEN
- All 7 migrations confirmed applied remotely via `supabase migration list --linked`

## Next Phase Readiness

- Wave 3 and Wave 4 plans (16-06 through 16-10) are unblocked — live schema matches all tables referenced by Server Actions
- TypeScript types are current — tsc/build will reflect all 15 new tables and ALTERs
- All Wave 3/4 Server Actions can now import `payables`, `statement_lines`, `professional_payouts`, `rpa_records`, `reinf_events` from `@/types/database.types`

---
*Phase: 16-contas-a-pagar-concilia-o-tributos*
*Completed: 2026-06-22*
