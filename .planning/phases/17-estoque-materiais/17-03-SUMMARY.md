---
phase: 17-estoque-materiais
plan: 03
subsystem: api
tags: [zod, supabase, server-actions, custo-medio-movel, estoque, anvisa]

# Dependency graph
requires:
  - phase: 17-estoque-materiais/01
    provides: productSchema/stockEntrySchema Zod v3 validators + RED test scaffolds
  - phase: 17-estoque-materiais/02
    provides: 6 estoque tables (products, product_batches, stock_entries, stock_draws, service_material_templates, stock_alerts) + RLS + database.types.ts regenerated
provides:
  - calcularCustoMedioMovel pure lib (D-02) with divide-by-zero/first-batch guard
  - createProduct/updateProduct/listProducts/deactivateProduct Server Actions (EST-01)
  - listProductBatches (FIFO-ordered batch read by product+unit)
  - createStockEntry: creates product_batches row + recalculates moving-average cost + inserts stock_entries + updates products.custo_medio
  - listStockEntries with product/supplier join and productId/from/to filters
affects: [17-estoque-materiais/04, 17-estoque-materiais/05, 17-estoque-materiais UI plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure calculation libs live outside 'use server' files so Server Actions AND unit tests can import them directly (src/lib/stock/custo-medio.ts)"
    - "updateProduct merges current DB row + partial input, then re-validates the FULL merged object through the ZodEffects (superRefine) schema — .partial() is unavailable on ZodEffects"

key-files:
  created:
    - src/lib/stock/custo-medio.ts
    - src/__tests__/estoque/custo-medio.test.ts
    - src/actions/products.ts
    - src/actions/product-batches.ts
    - src/actions/stock-entries.ts
  modified: []

key-decisions:
  - "updateProduct fetches current row + merges partial input, then validates the FULL object via productSchema.safeParse — preserves the implante→ANVISA superRefine rule on update since ZodEffects has no .partial()"
  - "createStockEntry always creates a new product_batches row per entry (never merges into an existing batch) — matches D-11 (lote = entrada de compra)"
  - "listProducts computes saldo per unit only when opts.unitId is provided (D-23); without it, saldo=0/status=normal is returned rather than aggregating across units"

patterns-established:
  - "Server Action getActor() helper copied verbatim from suppliers.ts/payables.ts into every new actions file (no shared module) — matches existing project convention"

requirements-completed: [EST-01]

# Metrics
duration: 25min
completed: 2026-07-11
---

# Phase 17 Plan 03: Custo Médio Móvel + Produtos + Entradas de Estoque Summary

**Server Actions de cadastro de produtos e entrada de estoque com recálculo de custo médio móvel via lib pura testável, tornando GREEN o RED test de stock-entries plantado no Plan 01**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-11T11:38:00Z (approx, per test run timestamps)
- **Completed:** 2026-07-11T12:03:00Z (approx)
- **Tasks:** 3
- **Files modified:** 5 created

## Accomplishments
- `calcularCustoMedioMovel` pure function implementing D-02's moving-average formula with the Pitfall 6 divide-by-zero/first-batch guard, fully unit-tested (6 test cases, all edge cases from the plan's `<behavior>` block)
- Full CRUD for products (`createProduct`/`updateProduct`/`listProducts`/`deactivateProduct`) with write access restricted to admin/superadmin, matching `products_admin_write` RLS
- `listProducts` derives per-unit saldo from `SUM(product_batches.saldo_disponivel)` and status (`normal`/`baixo`/`critico`/`negativo`), sorted by criticidade then name
- `createStockEntry` creates a `product_batches` row, recalculates the moving-average cost via the Task 1 lib, records the `stock_entries` row with `custo_medio_apos`, and denormalizes the new average onto `products.custo_medio`
- `src/__tests__/estoque/stock-entries.test.ts` (RED since Plan 01) is now fully GREEN — 6/6 assertions pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Lib pura de custo médio móvel** - `5156a08` (test)
2. **Task 2: Server Actions de produtos e lotes** - `11fba12` (feat)
3. **Task 3: Server Action de entrada de estoque (custo médio + criação de lote)** - `1065bed` (feat)

_No TDD refactor commit needed — Task 1's implementation matched the behavior spec on first pass._

## Files Created/Modified
- `src/lib/stock/custo-medio.ts` - Pure `calcularCustoMedioMovel` function (D-02), no 'use server'/'server-only'
- `src/__tests__/estoque/custo-medio.test.ts` - 6 unit tests covering first-batch, weighted average, negative-saldo guard, rounding, NaN/Infinity guards
- `src/actions/products.ts` - `createProduct`, `updateProduct`, `listProducts`, `deactivateProduct` — writes gated to admin/superadmin
- `src/actions/product-batches.ts` - `listProductBatches` — FIFO-ordered read by product+unit
- `src/actions/stock-entries.ts` - `createStockEntry` (batch creation + custo médio recalc), `listStockEntries` (filtered, joined)

## Decisions Made
- **updateProduct full-object re-validation:** `productSchema` is `z.object({...}).superRefine(...)`, which returns a `ZodEffects` — `.partial()` is not available on it. Implemented by fetching the current row, merging with the caller's partial input, and running the FULL merged object through `productSchema.safeParse`. This preserves the implante→ANVISA validation rule on every update, not just create.
- **createStockEntry always creates a new batch:** per D-11 (lote = entrada de compra), no merging into existing batches — every `createStockEntry` call produces exactly one new `product_batches` row with `saldo_disponivel = qtd`.
- **Saldo aggregation is unit-scoped only:** `listProducts` only computes saldo when `opts.unitId` is passed (D-23 — estoque é por unidade, independente). Without a unit filter, saldo defaults to 0 and status to 'normal' rather than silently aggregating across units (which would violate D-23 / Pitfall 4 from RESEARCH).

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their specified signatures, files, and acceptance criteria without requiring architectural changes or bug workarounds beyond the ZodEffects `.partial()` limitation, which was anticipated in the plan's phrasing ("parse parcial") and resolved via the merge-then-full-validate pattern documented above.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `calcularCustoMedioMovel`, `createProduct`/`updateProduct`/`listProducts`/`deactivateProduct`, `listProductBatches`, and `createStockEntry`/`listStockEntries` are all available for the next plan to build UI screens (`/clinica/estoque/produtos`, `/clinica/estoque/entradas`) on top of.
- `src/__tests__/estoque/stock-draws.test.ts`, `stock-agent.test.ts`, and `cron-validade.test.ts` remain intentionally RED — they target Server Actions/cron endpoints scoped to future plans (baixa automática/manual, agente de compras L2, cron de validade), out of scope for 17-03.
- Full estoque-scoped test suite for this plan (`produto-schema.test.ts` + `custo-medio.test.ts` + `stock-entries.test.ts`) is 26/26 GREEN; `npx tsc --noEmit` reports zero errors in any of the 5 files created by this plan.

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 5 created files verified present; all 3 task commit hashes (5156a08, 11fba12, 1065bed) verified in git log.
