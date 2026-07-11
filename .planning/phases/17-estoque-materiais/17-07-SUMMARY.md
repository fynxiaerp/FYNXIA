---
phase: 17-estoque-materiais
plan: 07
subsystem: ui
tags: [nextjs, react-hook-form, zod, tanstack-table, nuqs, shadcn, stock]

# Dependency graph
requires:
  - phase: 17-estoque-materiais (Plan 03)
    provides: stockEntrySchema, stockDrawSchema, createStockEntry, listStockEntries, calcularCustoMedioMovel
  - phase: 17-estoque-materiais (Plan 05)
    provides: createManualDraw (FIFO + CAS guard, logBusinessEvent audit trail)
  - phase: 17-estoque-materiais (Plan 06)
    provides: /clinica/estoque/produtos ProductsTable dropdown links (?produto={id}[&acao=baixa])
provides:
  - "/clinica/estoque/entradas page with filterable stock-entry history"
  - "StockEntryFormDialog — receiving form with conditional ANVISA/validade fields + moving-average cost preview"
  - "ManualDrawDialog — destructive manual draw dialog with mandatory motivo + irreversibility warning"
  - "listStockEntries extended to surface numero_lote, data_validade, created_by_name"
affects: [17-08, 17-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side moving-average cost preview via calcularCustoMedioMovel (pure fn, safe to import client-side)"
    - "BRL-masked numeric input backed by a plain number RHF field (local display state, form.setValue on blur) — keeps zodResolver bound to the real number-typed Zod schema"
    - "RSC page reads ?produto=&acao= query params and passes autoOpen/initialProductId into a client Dialog wrapper, so dropdown links from Plan 06 auto-open the correct dialog pre-filled"

key-files:
  created:
    - src/app/(dashboard)/clinica/estoque/entradas/page.tsx
    - src/components/estoque/StockEntriesTable.tsx
    - src/components/estoque/StockEntryFormDialog.tsx
    - src/components/estoque/ManualDrawDialog.tsx
  modified:
    - src/actions/stock-entries.ts

key-decisions:
  - "listStockEntries query extended with product_batches(numero_lote, data_validade) and users(full_name) joins — Lote/Validade/Registrado-por columns are UI-SPEC must_haves that the Plan 03 action didn't originally select"
  - "Novo custo médio computed client-side (calcularCustoMedioMovel) using the product's saldo/custo_medio snapshot from page load, instead of extending createStockEntry's return type — keeps stock-entries.ts write-path untouched while satisfying the UI-SPEC informativo"
  - "custo_unitario stays a number-typed RHF field bound to zodResolver(stockEntrySchema) directly; BRL mask is a separate local display string synced via form.setValue on blur (mirrors TransactionModal.amountStr intent without diverging the Zod schema)"

patterns-established:
  - "Auto-open dialog via query param: Dialog's `open` state initializes from an `autoOpen` prop (not a click), letting an RSC page drive which client dialog is pre-opened based on searchParams"

requirements-completed: [EST-01]

# Metrics
duration: ~20min
completed: 2026-07-11
---

# Phase 17 Plan 07: Entradas de Estoque + Baixa Manual Summary

**Stock-receiving page (/clinica/estoque/entradas) with filterable history table, a conditional-validation receiving dialog showing moving-average cost, and a destructive manual-draw dialog with mandatory motivo and audit-trail warning.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 extended)

## Accomplishments
- `/clinica/estoque/entradas` RSC page: lists stock entries (filterable by produto/from/to via nuqs → server refetch), wires header CTA "Registrar Entrada" (admin/superadmin), and honors `?produto={id}` / `?produto={id}&acao=baixa` query params from the Plan 06 `ProductsTable` dropdown by auto-opening the correct dialog pre-filled with that product.
- `StockEntriesTable`: TanStack Table v8 with Data/Produto/Lote/Validade/Qtd/Custo Unit./Custo Médio Após/Fornecedor/Registrado-por columns, produto + De/Até date filters (nuqs), `PackagePlus` empty state.
- `StockEntryFormDialog`: RHF + `zodResolver(stockEntrySchema)`. Selecting a produto sets `categoria_produto`, driving the schema's conditional rules (implante/medicamento require `data_validade`; implante also requires `numero_anvisa_lote`). Shows "Custo médio atual" on product selection and "Novo custo médio" after a successful submit (computed client-side with the same `calcularCustoMedioMovel` formula the Server Action uses).
- `ManualDrawDialog`: RHF + `zodResolver(stockDrawSchema)`. Irreversibility `Alert` (destructive) + destructive "Registrar Baixa" submit button; motivo is a required enum select (perda/quebra/vencimento/ajuste_inventario).

## Task Commits

Each task was committed atomically:

1. **Task 1: Página de entradas + histórico** - `d2d0765` (feat)
2. **Task 2: StockEntryFormDialog (recebimento + custo médio)** - `44f9678` (feat)
3. **Task 3: ManualDrawDialog (baixa manual com confirmação)** - `4f8edc2` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/app/(dashboard)/clinica/estoque/entradas/page.tsx` - RSC: fetches units/products/suppliers/entries, honors searchParams (produto/from/to/acao), renders header CTA + empty state + table
- `src/components/estoque/StockEntriesTable.tsx` - Client table with nuqs filters (produto, De/Até via Popover+Calendar) and PackagePlus empty state
- `src/components/estoque/StockEntryFormDialog.tsx` - Receiving form dialog with conditional ANVISA/validade fields and moving-average cost informativo
- `src/components/estoque/ManualDrawDialog.tsx` - Destructive manual-draw dialog with mandatory motivo and irreversibility warning
- `src/actions/stock-entries.ts` - `listStockEntries` extended to join `product_batches` (numero_lote, data_validade) and `users` (full_name); `StockEntryRow` type extended accordingly

## Decisions Made
- Extended `listStockEntries` (Plan 03 file, not in this plan's `files_modified` list) to select `numero_lote`, `data_validade`, and `created_by_name` — these are must_have UI-SPEC columns that the original read query did not project. Additive change only (new optional fields on `StockEntryRow`), no behavior change to existing callers.
- "Novo custo médio" is a client-side preview (same pure formula as the Server Action, imported from `@/lib/stock/custo-medio`), not a value returned by `createStockEntry`. This avoids touching the write path in `stock-entries.ts` while still satisfying the UI-SPEC informativo requirement.
- Custo Unitário field keeps the Zod schema's `number` type intact for `zodResolver(stockEntrySchema)`; the BRL-formatted display lives in separate local component state, synced into the real RHF field via `form.setValue` on blur — functionally equivalent to `TransactionModal.amountStr` but without diverging from the shared, reused Zod schema.
- Used a plain Dialog (not a two-step `AlertDialog`) for `ManualDrawDialog`, matching the plan's literal task description ("Aviso Alert com AlertDescription... Botão submit variant='destructive'") rather than the UI-SPEC's more generic Component Inventory mention of `AlertDialog`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended `listStockEntries` to return lote/validade/registrado-por**
- **Found during:** Task 1 (Página de entradas + histórico)
- **Issue:** The plan's must_haves truth "Histórico de entradas lista data, produto, lote, validade, qtd, custos e fornecedor" and the UI-SPEC's `StockEntriesTable` column spec both require Lote/Validade columns, but `listStockEntries` (from Plan 03) only selected `products(name)` and `suppliers(name)` — no `product_batches` join, so lote/validade were unavailable to the table.
- **Fix:** Added `product_batches(numero_lote, data_validade)` and `users(full_name)` to the `stock_entries` select, extended `StockEntryRow` with `numero_lote`, `data_validade`, `created_by_name`, and updated the row-mapping function.
- **Files modified:** `src/actions/stock-entries.ts`
- **Verification:** `npx tsc --noEmit` clean on the file; manual review confirms the join mirrors the existing `products`/`suppliers` join pattern already used in the same query.
- **Committed in:** `d2d0765` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for the plan's own must_haves and UI-SPEC contract; no scope creep beyond the read query of an already-completed action file.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EST-01 (entrada de estoque via UI) and D-19 (baixa manual) are now fully wired end-to-end: catalog → entradas page → server actions → audit trail.
- Remaining phase 17 plans (relatório ANVISA, materiais utilizados no serviço/prontuário) can proceed independently — no blockers introduced by this plan.

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All created files verified present on disk; all 3 task commit hashes (`d2d0765`, `44f9678`, `4f8edc2`) verified present in `git log --oneline --all`.
