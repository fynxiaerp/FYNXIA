---
phase: 19-relat-rios-or-amento-bi
plan: 10
subsystem: ui
tags: [nextjs, react-pdf, nuqs, accordion, dre, relatorios, base-ui]

requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 04)
    provides: "src/actions/dre.ts — getDre/getDreByUnit/getDreYoY/getDreDrilldown Server Actions"
  - phase: 19-relat-rios-or-amento-bi (Plan 09)
    provides: "src/components/relatorios/charts.tsx — KpiCard/ChartCard/DeltaBadge/OccupancyBar"
provides:
  - "REP-01 production DRE screen at /clinica/relatorios"
  - "DRE PDF export route /api/relatorios/dre-pdf"
affects: [relatorios, financeiro, bi]

tech-stack:
  added: []
  patterns:
    - "One getDreDrilldown fetch feeding two Accordion expansion levels (D-06 client-side cost-center grouping, then D-05 per-transaction list) — no extra server round-trip"
    - "nuqs period/unit selector split into its own 'use client' file (DreFilters.tsx) because a Server Component page.tsx cannot host a 'use client' sub-tree in the same file"

key-files:
  created:
    - src/app/(dashboard)/clinica/relatorios/page.tsx
    - src/components/relatorios/DreView.tsx
    - src/components/relatorios/DreFilters.tsx
    - src/components/relatorios/DrePdf.tsx
    - src/app/api/relatorios/dre-pdf/route.ts
  modified: []

key-decisions:
  - "DreFilters.tsx split into its own file (Rule 2 deviation) — the PageHeader actions slot needs a 'use client' period/unit selector, which cannot live in the same file as the async Server Component page.tsx"
  - "Cost-center names for D-06 resolved via a page.tsx-level listCostCenters() call (existing Plan 14 action) passed to DreView as an id->name map, instead of extending getDreDrilldown's SELECT — keeps Plan 04's dre.ts untouched"
  - "Resultado KPI card built as a local ResultadoKpiCard (not KpiCard) so its value color can switch primary/destructive by sign — KpiCard has no color-override slot and is Plan 09's shared file, not touched here"

requirements-completed: [REP-01]

duration: ~20min
completed: 2026-07-19
---

# Phase 19 Plan 10: DRE Screen (Relatórios) Summary

**Production DRE screen at `/clinica/relatorios` with period/unit selectors, KPI row, per-unit ranking, one-fetch two-level cost-center→transaction drill-down, YoY comparison, and a Font.register-Roboto PDF export route.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-19
- **Tasks:** 2/2 completed
- **Files modified:** 5 created, 0 modified

## Accomplishments
- `/clinica/relatorios` RSC page reading `?from&to&unit` (nuqs URL state), calling `getDre`/`getDreByUnit`/`getDreYoY` (Plan 04) server-side, with an "Exportar PDF" link carrying the same period/unit
- `DreView.tsx`: KPI row (Faturamento/Despesa/Resultado/Margem — Resultado colored primary/destructive by sign), consolidated per-unit ranking table (D-04), % of revenue per line (D-08), two-level Accordion drill-down fed by a single `getDreDrilldown` fetch per line (D-06 cost-center subtotals incl. "Sem centro de custo" bucket → D-05 individual transactions), YoY via `DeltaBadge` degrading to "comparação indisponível" (D-11), and the exact empty/error copy from the UI-SPEC
- `DrePdf.tsx` + `/api/relatorios/dre-pdf` route: A4 Flexbox-only PDF (Font.register Roboto), independent role gate (admin/socio/superadmin, D-09) on top of `getDre`'s internal gate, `no-store` Cache-Control

## Task Commits

1. **Task 1: relatorios page + DreView (selectors, KPI row, ranking, drill-down)** - `4ccc757` (feat)
2. **Task 2: DrePdf component + dre-pdf route** - `7b0df60` (feat)

## Files Created/Modified
- `src/app/(dashboard)/clinica/relatorios/page.tsx` - RSC: reads searchParams, fetches DRE/ranking/YoY/units/cost-centers in parallel, renders PageHeader (title + DreFilters + Exportar PDF) and DreView
- `src/components/relatorios/DreView.tsx` - Client component: KPI row, ranking table, DRE lines Accordion with D-06/D-05 two-level drill-down, YoY badge, empty/error states
- `src/components/relatorios/DreFilters.tsx` - Client component (deviation, Rule 2): mês/período toggle + unidade Select, all URL state via nuqs
- `src/components/relatorios/DrePdf.tsx` - `@react-pdf/renderer` A4 document: header, KPI summary row, contas table (valor + % receita), footer
- `src/app/api/relatorios/dre-pdf/route.ts` - `runtime='nodejs'`, auth+role gate, `getDre` + `listUnits` for unit label, `renderToBuffer`, `no-store`

## Decisions Made
- `DreFilters.tsx` added as a new file beyond the plan's 2-file Task 1 list (Rule 2 — critical functionality: the PageHeader actions slot explicitly requires a period+unit selector, and a `'use client'` component cannot share a file with the async Server Component `page.tsx`). Mirrors the existing `CashFlowFilters.tsx` pattern already in the codebase.
- Cost-center display names for the D-06 grouping resolved via `listCostCenters()` (existing Plan 14 action) at the page level rather than modifying `getDreDrilldown`'s SELECT in `src/actions/dre.ts` — keeps Plan 04's file untouched and reuses an already-proven action.
- Resultado KPI rendered via a local `ResultadoKpiCard` (not the shared `KpiCard`) so its value can flip `text-primary`/`text-destructive` by sign, since `KpiCard` (Plan 09, not owned by this plan) has no color-override prop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `DreFilters.tsx` (period/unit selector)**
- **Found during:** Task 1
- **Issue:** The task's own `<action>` requires the PageHeader actions slot to contain a period+unit selector, but `page.tsx` is an async Server Component (calls `getDre` etc. directly) and cannot also carry a `'use client'` directive for the interactive selector in the same file.
- **Fix:** Extracted the selector into its own `'use client'` file, `src/components/relatorios/DreFilters.tsx`, using `nuqs`'s `useQueryState` for `from`/`to`/`unit` — same pattern as the existing `CashFlowFilters.tsx`.
- **Files modified:** `src/components/relatorios/DreFilters.tsx` (new), `src/app/(dashboard)/clinica/relatorios/page.tsx` (imports it)
- **Verification:** `npx tsc --noEmit` clean (43 pre-existing errors unchanged, none in new files); `npx eslint` clean on all 5 new files.
- **Committed in:** `4ccc757` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary to satisfy the task's own stated requirement (selector in PageHeader actions). No scope creep — no new server actions, no schema changes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REP-01 DRE screen fully wired to Plan 04 actions and Plan 09 chart primitives; ready for 19-VALIDATION.md manual pass (drill-down opens filtered transactions).
- No blockers for remaining Phase 19 plans (Orçamento/Societário/BI).

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 5 created files verified present on disk; both task commits (`4ccc757`, `7b0df60`) verified present in `git log`.
