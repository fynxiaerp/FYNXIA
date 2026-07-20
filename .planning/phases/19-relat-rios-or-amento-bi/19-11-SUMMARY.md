---
phase: 19-relat-rios-or-amento-bi
plan: 11
subsystem: ui
tags: [nextjs, react-server-components, react-pdf, supabase, zod, react-hook-form-free, lucide-react]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 05)
    provides: budget-targets.ts Server Actions (listBudgetTargets, saveBudgetTargets, copyBudgetFromPreviousYear, getBudgetVsRealizado, computeBudgetCell, isMonthLocked)
  - phase: 19-relat-rios-or-amento-bi (Plan 09)
    provides: KpiCard / relatorios chart namespace (src/components/relatorios/charts.tsx)
  - phase: 19-relat-rios-or-amento-bi (Plan 10)
    provides: anvisa-pdf/dre-pdf route + PDF component precedent (Flexbox-only, Roboto, role-gated, no-store)
provides:
  - Orçamento screen (REP-02) at /clinica/orcamento — 12-month editable meta grid per conta contábil with realizado + deviation semaphore (D-15)
  - Locked past-month cells with Lock icon (D-13/D-18) — never silently disabled
  - "Copiar do ano anterior" and "Salvar metas" wired to Plan 05 Server Actions
  - Cross-link to DRE (D-16) and PDF export route (D-19/D-40)
affects: [19-12 (Societário), 19-13/19-14 (BI) — may reuse OrcamentoFilters/BudgetGrid ano-selector pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side pure duplicate of isMonthLocked (D-18) in BudgetGrid.tsx — avoids an async Server Action round-trip just to shape a freshly client-added account row's initial lock state; server save path remains sole enforced source of truth"
    - "Multi-account grid save = N sequential saveBudgetTargets calls (one per conta), since the action's contract is 1 payload = 1 conta x 1 unidade/rede x 12 meses"
    - "OrcamentoFilters.tsx split into its own 'use client' file (mirrors DreFilters.tsx / D-310 precedent) since page.tsx is an async Server Component"

key-files:
  created:
    - src/app/(dashboard)/clinica/orcamento/page.tsx
    - src/components/relatorios/BudgetGrid.tsx
    - src/components/relatorios/OrcamentoFilters.tsx
    - src/components/relatorios/BudgetPdf.tsx
    - src/app/api/orcamento/pdf/route.ts
  modified: []

key-decisions:
  - "OrcamentoFilters.tsx split into its own 'use client' file, not listed in the plan's <files> — same rationale as D-310 (DreFilters.tsx), a client selector cannot live inside the async Server Component page.tsx"
  - "Grid supports adding a not-yet-budgeted conta via a client-side 'Adicionar conta' selector sourced from listAccountsTree() leaf accounts, so the empty-state body's 'Crie metas mensais por conta contábil' instruction is actually actionable, not just copy"
  - "BudgetPdf renders landscape A4 with 12 stacked meta/realizado/desvio% mini-cells per conta row (not one row per conta-mês) to keep the table on a single page width, mirroring AnvisaReportPdf's landscape/narrow-column precedent"

patterns-established:
  - "Editable N-account x 12-month grid pattern: client component maintains local editable copy of server-fetched rows (seeded via a `key={ano}-${unitId}` remount on the RSC parent), computes semaphore/deviation client-side via the shared pure dre-math.ts helpers, and persists per-row on an explicit Salvar action"

requirements-completed: [REP-02]

# Metrics
duration: ~25min
completed: 2026-07-19
---

# Phase 19 Plan 11: Orçamento Screen (REP-02) Summary

**12-month editable Orçamento grid (meta/realizado/desvio semáforo, D-18 lock, D-17 copy-from-year) + landscape PDF export, wired to the Plan 05 budget-targets Server Actions.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 5 (all new)

## Accomplishments
- Orçamento RSC page (`/clinica/orcamento`) with ano/unidade selector, "Ver DRE" cross-link (D-16) and "Exportar PDF" action, fetching `getBudgetVsRealizado`
- `BudgetGrid.tsx`: KPI summary row (Meta/Realizado/Desvio, Display role), 12-month editable meta `Input` per conta with read-only Realizado and semaphore-colored deviation %, locked past-month cells rendering `bg-muted text-muted-foreground` + `Lock` icon (D-18), "Salvar metas" / "Copiar do ano anterior" wired to Server Actions, and an "Adicionar conta" affordance for accounts with no existing budget row
- `BudgetPdf.tsx` + `/api/orcamento/pdf` route: landscape A4 @react-pdf/renderer export, role-gated (admin/socio/superadmin), `no-store`, mirrors the dre-pdf/anvisa-pdf security and layout precedent exactly

## Task Commits

1. **Task 1: orcamento page + BudgetGrid (12-month editable, semaphore, lock)** - `b4d47e3` (feat)
2. **Task 2: BudgetPdf + orcamento/pdf route** - `b9af6ea` (feat)

_No separate plan-metadata commit was requested in this run's protocol; STATE.md/ROADMAP.md updates are committed together with this SUMMARY._

## Files Created/Modified
- `src/app/(dashboard)/clinica/orcamento/page.tsx` - RSC page: fetches getBudgetVsRealizado/listUnits/listAccountsTree, builds PageHeader actions (filters, Ver DRE, Exportar PDF)
- `src/components/relatorios/BudgetGrid.tsx` - Client grid: KPI row, editable 12-month meta cells, semaphore, lock, add-conta, save, copy-from-previous-year
- `src/components/relatorios/OrcamentoFilters.tsx` - Client ano/unidade selector (nuqs URL state)
- `src/components/relatorios/BudgetPdf.tsx` - @react-pdf/renderer landscape table (conta x 12 meses, meta/realizado/desvio)
- `src/app/api/orcamento/pdf/route.ts` - GET route: nodejs runtime, role gate, renderToBuffer, no-store PDF response

## Decisions Made
- OrcamentoFilters split into its own 'use client' file (deviation, Rule 2 — mirrors D-310 DreFilters precedent); required because page.tsx is an async Server Component and cannot host interactive nuqs state itself
- Added a client-side "Adicionar conta" selector (sourced from `listAccountsTree()` leaf accounts) so a clinic with zero budget rows for the year can actually act on the empty-state copy ("Crie metas mensais por conta contábil"), not just copy from the previous year
- BudgetPdf uses a compact 3-line stacked cell per conta/mês (Meta/Realizado/Desvio%) in landscape orientation rather than one row per conta-mês, to fit all 12 months on one page width (mirrors AnvisaReportPdf's landscape/narrow-column approach)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added OrcamentoFilters.tsx as a separate client component**
- **Found during:** Task 1 (orcamento page + BudgetGrid)
- **Issue:** The plan's action requires an ano/unit selector in the PageHeader actions slot, but `page.tsx` is an async Server Component — a 'use client' selector with nuqs state cannot live in the same file
- **Fix:** Created `src/components/relatorios/OrcamentoFilters.tsx`, mirroring the existing `DreFilters.tsx` pattern (documented precedent D-310 in STATE.md)
- **Files modified:** src/components/relatorios/OrcamentoFilters.tsx (new), src/app/(dashboard)/clinica/orcamento/page.tsx (imports it)
- **Verification:** `npx tsc --noEmit` — no new errors; `npx vitest run` — 1825/1825 tests pass
- **Committed in:** b4d47e3 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added "Adicionar conta" selector to BudgetGrid**
- **Found during:** Task 1 (BudgetGrid)
- **Issue:** `getBudgetVsRealizado` only returns accounts that already have `budget_targets` rows for the year — with zero rows, the empty state's own copy ("Crie metas mensais por conta contábil... para começar") would have no actionable UI path besides "Copiar do ano anterior"
- **Fix:** Added a `Select` sourced from `listAccountsTree()` leaf accounts (type `receita`/`despesa`, `ativo`) filtered to accounts not already in the grid; selecting one adds a locally-editable 12-month row (meta=0) that is persisted on the next "Salvar metas"
- **Files modified:** src/components/relatorios/BudgetGrid.tsx, src/app/(dashboard)/clinica/orcamento/page.tsx (passes `accountOptions`)
- **Verification:** `npx tsc --noEmit` — no new errors; manual code-path review confirms `saveBudgetTargets` accepts the resulting payload shape unchanged
- **Committed in:** b4d47e3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality for the screen's own stated must_haves/copy contract)
**Impact on plan:** Both additions were necessary for the screen to be usable as specified (an ano/unit selector that actually works, and an empty-state CTA path that is reachable). No scope creep beyond REP-02's stated must_haves.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REP-02 (Orçamento) fully shipped: 12-month editable grid, semaphore, lock, copy-from-year, save, DRE cross-link, PDF export — all verified against 19-UI-SPEC.md's Orçamento-specific section and copywriting contract
- `tsc --noEmit` and `npm test` (1825 tests) both green; 43 pre-existing tsc errors (phase 14-16 test files, documented baseline) unaffected
- Wave 3 plan 19-11 complete; no blockers for downstream Societário (19-12) or BI (19-13/19-14) plans

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 5 created files verified present on disk; both task commits (`b4d47e3`, `b9af6ea`) verified present in git log.
