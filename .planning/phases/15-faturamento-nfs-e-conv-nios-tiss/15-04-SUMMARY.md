---
phase: 15-faturamento-nfs-e-conv-nios-tiss
plan: 04
status: complete
completed: 2026-06-20
---

# Plan 15-04 Summary — [BLOCKING] Schema push + regen types

## What was done

- **Task 1 (human-action checkpoint):** User re-authenticated the Supabase CLI to the FYNXIA account. Verified via `npx supabase projects list` — `jqjwyqlbbuqnrffdnlpp` (org `kczvihafddupruvsrrsc`, FYNXIA) now appears and is **LINKED**. Resolved the project-memory gotcha (CLI was logged into `nexus-*`).
- **Task 2:** Pushed all 5 phase-15 migrations to the live DB in timestamp order:
  - `20260620000100_faturamento_catalog_tables.sql`
  - `20260620000200_faturamento_os_tables.sql`
  - `20260620000300_faturamento_tiss_tables.sql`
  - `20260620000400_faturamento_rls.sql`
  - `20260620000500_faturamento_seed.sql`
  - `npx supabase db push` reported "Finished supabase db push." (all applied).
- Regenerated TypeScript types and verified completeness (truncation guard passed: file grew 110538 → 140552 bytes, ends with `} as const`).

## Deviation (resolved)

The plan specified `src/lib/database.types.ts`, but the codebase actually imports types from **`@/types/database.types`** (`src/types/database.types.ts`) — `tsconfig` alias `@/* → ./src/*`. Zero files import the `lib` path.

- Regenerated types into the **correct** path `src/types/database.types.ts`.
- Removed the orphan `src/lib/database.types.ts` that the plan's path would have created.

## Verification

- `grep -c service_orders src/types/database.types.ts` = 13
- `grep -c tiss_guides` = 7 · `nfse_records` present · `glosa_motivos` present · `appointment_procedures` present
- `charges` row type now includes `service_order_id`
- `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` → 71/71 GREEN

## Key files
- created/updated: `src/types/database.types.ts` (regenerated, includes all 10 new tables)
- removed: `src/lib/database.types.ts` (orphan from wrong plan path)

## Wave 3 note
Wave 3 Server Action plans (15-05/06/07) must import DB types from `@/types/database.types`, NOT `@/lib/database.types`.
