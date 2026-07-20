---
phase: 19-relat-rios-or-amento-bi
plan: 13
subsystem: ui
tags: [bi, dashboard, tabs, pdf, react-pdf, nuqs, kpi]

requires:
  - phase: 19-relat-rios-or-amento-bi
    provides: "getBiKpis (Plan 07), listBiAlerts (Plan 07), runBiForecastForClinic nightly agent (Plan 08), charts.tsx primitives (Plan 09)"
provides:
  - "Top-level /bi dashboard screen (BI-01/BI-02)"
  - "Fixed 'Alertas & Previsões' section, visible across all 4 KPI tabs (D-38)"
  - "BiPdf + /api/bi/pdf route — per-dimension PDF export, role-gated (D-39/D-40)"
affects: [20-portal-paciente-app-profissional]

tech-stack:
  added: []
  patterns:
    - "Per-tab 'Exportar PDF' link (dimension query param) instead of one global header button, when UI-SPEC mandates a per-flow CTA that a single header action can't express"
    - "Insufficient-forecast-history detection derived independently from the earliest financial_transactions row, since the nightly agent silently skips (writes no row for) the < 3-month case"

key-files:
  created:
    - src/app/(dashboard)/bi/page.tsx
    - src/components/relatorios/BiDashboard.tsx
    - src/components/relatorios/BiAlertsSection.tsx
    - src/components/relatorios/BiPdf.tsx
    - src/app/api/bi/pdf/route.ts
  modified: []

key-decisions:
  - "PageHeader actions carry only the período/unit selector (BiPeriodFilter); 'Exportar PDF' moved to a per-tab button inside each TabsContent, since 19-UI-SPEC.md's Copywriting Contract and this plan's own must_haves truths state D-40 is per-tab, not a single global action"
  - "insufficientHistory computed in page.tsx from the earliest financial_transactions.transaction_date (< 3 months → true), because bi-forecast-agent.ts deliberately writes zero bi_alerts rows for the D-32 insufficient-data case — there is no direct DB signal to read instead"
  - "Profissionais tab KPIs (Faturamento/Procedimentos/Dentistas ativos) are aggregate totals with no meta/DeltaBadge, since getBiKpis's profissionais field is a ProfessionalKpiRow[] with no kpi_targets attachment for this dimension"
  - "BiPdf.tsx receives pre-formatted label/atual/meta string rows built by the route, not raw numbers — profissionais needs a composite atual string (BRL + procedure count) that doesn't fit the single-number formatter shared by the other 3 dimensions"

patterns-established:
  - "BiPeriodFilter exported from the already-'use client' BiDashboard.tsx module rather than a new file (mirrors D-317 SocietarioPeriodFilter precedent)"

requirements-completed: [BI-01, BI-02]

duration: ~20min
completed: 2026-07-20
---

# Phase 19 Plan 13: BI Dashboard Summary

**Top-level /bi screen: fixed AI-narrated "Alertas & Previsões" panel above 4 meta×realizado KPI tabs (Operacional/Profissionais/CRC/Estoque-TISS), each with its own role-gated PDF export.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 5 (all new)

## Accomplishments
- `/bi` RSC page wiring `getBiKpis`/`listBiAlerts`/`listUnits`, gated upstream by proxy.ts's existing `bi` ModuleKey (admin/superadmin full, sócio read-only, dentist no access)
- Fixed "Alertas & Previsões" section (`BiAlertsSection`) rendered above `<Tabs>` so it never disappears on tab switch (D-38); severity-colored cards (verde/amarelo/vermelho/info) with LLM narrative and a "Revisar sugestão" link into `/conformidade/aprovacoes`, shown only when `approval_request_id` is present (D-35)
- 4-tab `BiDashboard` (Operacional/Profissionais/CRC/Estoque-TISS) with `grid grid-cols-2 lg:grid-cols-5` KPI rows, DeltaBadge meta-attainment, occupancy bar and a professionals bar chart
- `BiPdf` + `/api/bi/pdf` route: per-dimension label/atual/meta PDF, `admin`/`socio`/`superadmin` gate, `runtime = 'nodejs'`, `Cache-Control: no-store`

## Task Commits

1. **Task 1: bi page + BiDashboard tabs + BiAlertsSection** - `2760556` (feat)
2. **Task 2: BiPdf + bi/pdf route** - `37f8e3a` (feat)

_No plan-metadata-only commit required beyond this SUMMARY/STATE/ROADMAP update._

## Files Created/Modified
- `src/app/(dashboard)/bi/page.tsx` - RSC page: period/unit searchParams, getBiKpis/listBiAlerts/listUnits fetch, insufficient-history detection, PageHeader with BiPeriodFilter
- `src/components/relatorios/BiAlertsSection.tsx` - fixed alerts panel: severity cards, insufficient-data notice, "Nenhum alerta" empty state, error state
- `src/components/relatorios/BiDashboard.tsx` - 4-dimension Tabs, KpiValueCard/ProfissionaisBody, per-tab ExportTabButton, BiPeriodFilter (nuqs)
- `src/components/relatorios/BiPdf.tsx` - `@react-pdf/renderer` KPI-summary table (Flexbox-only, Roboto font)
- `src/app/api/bi/pdf/route.ts` - GET handler: auth + role gate, dimension-scoped `buildRows`, PDF response headers

## Decisions Made
- See `key-decisions` in frontmatter above (per-tab PDF export placement, insufficient-history derivation, profissionais aggregate KPIs, pre-formatted PDF rows).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical UX] "Exportar PDF" moved from PageHeader to per-tab buttons**
- **Found during:** Task 1 (BiDashboard)
- **Issue:** The plan's Task 1 `<action>` text describes the PageHeader actions slot as "período/unit selector + Exportar PDF" (one global button), but this plan's own `must_haves.truths` ("Exportar PDF per tab available (D-40)") and 19-UI-SPEC.md's Copywriting Contract both state the button is per-tab, not global. A single header button couldn't express "export the currently active dimension" without lifting tab state into the URL/server render, adding complexity for no UI-SPEC benefit.
- **Fix:** PageHeader actions carry only `BiPeriodFilter`; each `TabsContent` in `BiDashboard.tsx` ships its own `dimension`-scoped "Exportar PDF" link via `ExportTabButton`.
- **Files modified:** src/components/relatorios/BiDashboard.tsx, src/app/(dashboard)/bi/page.tsx
- **Verification:** `grep -q "Exportar PDF" src/components/relatorios/BiDashboard.tsx` passes; each of the 4 tabs renders its own export link with the correct `dimension` query param.
- **Committed in:** 2760556 (Task 1 commit)

**2. [Rule 2 - Missing data signal] insufficientHistory computed independently of bi_alerts**
- **Found during:** Task 1 (BiAlertsSection)
- **Issue:** `bi-forecast-agent.ts`'s D-32 handling (`if (series.length < 3) continue`) means the nightly agent never writes a bi_alerts row for the "insufficient forecast data" case — there is no DB row `listBiAlerts` could surface to trigger the required UI-SPEC empty state ("Dados insuficientes para previsão").
- **Fix:** Added `loadInsufficientHistory()` in `page.tsx`, querying the earliest `financial_transactions.transaction_date` for the tenant and comparing to a 3-month threshold (same rule the agent applies to its own trend series), passed down as a boolean prop to `BiAlertsSection`.
- **Files modified:** src/app/(dashboard)/bi/page.tsx, src/components/relatorios/BiAlertsSection.tsx
- **Verification:** `grep -q "Dados insuficientes para previsão" src/components/relatorios/BiAlertsSection.tsx` passes; `npx tsc --noEmit` unchanged at 43 pre-existing errors; `npx vitest run` — 1825/1825 tests pass.
- **Committed in:** 2760556 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical UX/data-signal wiring required to satisfy the plan's own must_haves and the authoritative UI-SPEC)
**Impact on plan:** Both deviations were necessary to satisfy D-32 and D-40 as literally specified in must_haves.truths; no scope creep — no new files beyond the plan's declared `files_modified` list.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (AI Gateway narrative generation for bi_alerts already gated behind `AI_GATEWAY_API_KEY` presence in Plan 08; this plan is read-only against that data.)

## Next Phase Readiness
- BI-01/BI-02 fully shipped: `/bi` screen matches 19-UI-SPEC.md's BI-specific contract (fixed alerts, 4 tabs, per-tab PDF, access control via existing proxy.ts `bi` ModuleKey).
- `npx tsc --noEmit`: 43 errors, unchanged from the pre-existing phase 14-16 test-file baseline (verified — zero new errors from this plan's 5 files).
- `npx vitest run`: 114 test files / 1825 tests, all passing.
- This was the final BI-dimension plan of the phase; remaining phase 19 plans (if any) are unrelated to `/bi`.

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/bi/page.tsx
- FOUND: src/components/relatorios/BiDashboard.tsx
- FOUND: src/components/relatorios/BiAlertsSection.tsx
- FOUND: src/components/relatorios/BiPdf.tsx
- FOUND: src/app/api/bi/pdf/route.ts
- FOUND commit: 2760556
- FOUND commit: 37f8e3a
