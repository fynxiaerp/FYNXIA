---
phase: 14-financeiro-cadastros-base
plan: "03"
subsystem: financeiro-cadastros
tags: [migration, db-push, types, blocking, supabase, financeiro]
dependency_graph:
  requires:
    - 3 Phase 14 migrations written and committed (Plan 02)
  provides:
    - Live schema for chart_of_accounts, cost_centers, bank_accounts on jqjwyqlbbuqnrffdnlpp
    - Regenerated database.types.ts exposing new tables + classification columns (Plan 04+ consume)
  affects:
    - src/types/database.types.ts
requirements: [FCAD-01, FCAD-02]
---

## One-liner

Applied the 3 Phase 14 migrations to the live Supabase project `jqjwyqlbbuqnrffdnlpp` and regenerated TypeScript DB types — the new financial cadastro schema is now real and type-visible.

## What was delivered

- **3 migrations pushed** to the correct project (verified `LINKED ● kczvihafddupruvsrrsc / jqjwyqlbbuqnrffdnlpp / FYNXIA / São Paulo` before push — no `nexus-*` contamination):
  - `20260619001100_financial_cadastros_tables.sql`
  - `20260619001200_financial_cadastros_rls.sql`
  - `20260619001300_financial_cadastros_seed.sql`
- `supabase migration list` confirmed all three were pending (Remote column empty) before push; `Finished supabase db push` with no errors.
- **Backfill `RAISE EXCEPTION` assertion did NOT fire** — every legacy transaction with a resolvable default cost center received `cost_center_id`.
- **Types regenerated** to the canonical path `src/types/database.types.ts` (imported as `@/types/database.types`), written UTF-8 no-BOM. Contains `chart_of_accounts`, `cost_centers`, `bank_accounts`, and `account_id`/`cost_center_id`/`bank_account_id` on `financial_transactions` (+ `account_id` on `financial_categories`).
- `npm run build` exits 0.

## Deviations

- **Types path correction:** plan frontmatter listed `src/lib/supabase/database.types.ts`, but the project's canonical types file is `src/types/database.types.ts` (the only `database.types.ts` in the repo, imported everywhere as `@/types/database.types`). Regenerated to the real path, as the plan's own action note instructed ("grep for the existing import path first").

## Checkpoint resolution

`checkpoint:human-action gate="blocking"` — resolved. Human completed `supabase login`; orchestrator verified correct account/project, confirmed pending migrations, executed `db push` + `gen types`, and validated the build. Resume signal "applied" satisfied.

## Self-Check: PASSED

- [x] 3 migrations applied (push finished, Remote populated)
- [x] database.types.ts contains chart_of_accounts / cost_centers / bank_accounts + new FK columns
- [x] backfill assertion did not fire
- [x] npm run build exits 0
