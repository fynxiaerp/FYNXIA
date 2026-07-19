---
phase: 19-relat-rios-or-amento-bi
plan: 07
subsystem: api
tags: [bi, kpi, server-actions, supabase, zod, rbac]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 03)
    provides: kpi_targets / bi_alerts tables (migration + RLS)
provides:
  - "kpi_targets CRUD (listKpiTargets/saveKpiTarget) gated admin/socio(read)/superadmin"
  - "getBiKpis: 4-dimension KPI aggregation (Operacional/Profissionais/CRC/Estoque-TISS) with meta×realizado"
  - "listBiAlerts: read active bi_alerts for the panel's Alertas & Previsões section"
affects: ["19-08 (bi-forecast-agent writes bi_alerts/approval_requests this plan reads)", "19-13 (BI dashboard page consumes getBiKpis/listBiAlerts)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit UPDATE→INSERT upsert against kpi_targets partial unique index (mirrors upsertBudgetTargetRow)"
    - "Cross-action-file reuse: bi-kpis.ts statically imports getNpsSummary/getRoiByCampaign/getRoiByOrigin instead of recomputing CRC aggregates"
    - "Two-hop unit resolution (service_orders → tiss_guides → tiss_guide_items) for tables with no direct unit_id column"

key-files:
  created:
    - src/lib/financeiro/kpi-target-schema.ts
    - src/actions/kpi-targets.ts
    - src/actions/bi-alerts.ts
    - src/actions/bi-kpis.ts
  modified: []

key-decisions:
  - "ocupacao computed as booked appointments ÷ (distinct active dentists × business days × 8 assumed slots/day) — no capacity/working-hours table exists in the schema to derive a stricter denominator"
  - "profissionais dimension sourced from service_order_items (professional_id, valor_total) joined through service_orders(status='faturada'), not appointments — matches the actual per-professional revenue attribution grain in the schema"
  - "CRC dimension reuses Phase 18 actions (getNpsSummary/getRoiByCampaign/getRoiByOrigin) via static cross-action-file import rather than recomputing aggregation logic"

patterns-established:
  - "kpi_targets upsert helper inline in saveKpiTarget (single-consumer, unlike the extracted upsertBudgetTargetRow in budget-targets.ts which serves 2 callers)"

requirements-completed: [BI-01]

# Metrics
duration: ~20min
completed: 2026-07-19
---

# Phase 19 Plan 07: BI KPI Data Layer Summary

**getBiKpis aggregates 4 KPI dimensions (Operacional/Profissionais/CRC/Estoque-TISS) from real Phase 15/17/18 sources with meta×realizado attach; kpi-targets CRUD + bi-alerts read complete the BI-01 data layer, all gated to admin/socio/superadmin.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 4 created, 0 modified

## Accomplishments
- `kpi-target-schema.ts` + `kpi-targets.ts`: Zod schema (no `.default()`, D-133) + CRUD with explicit UPDATE→INSERT upsert against `kpi_targets`' partial unique indexes; read gate `['admin','socio','superadmin']`, write gate `['admin','superadmin']`
- `bi-alerts.ts`: `listBiAlerts()` reads active `bi_alerts` rows scoped to tenant, newest first, shaping `approval_request_id` for the panel's "Revisar sugestão" link (D-35)
- `bi-kpis.ts`: `getBiKpis({from,to,unitId?})` aggregates all 4 KPI dimensions from real sources — `appointments`+`financial_transactions` (operacional), `service_order_items`/`service_orders`/`professionals` (profissionais), reused Phase 18 actions (crc), `stock_alerts`+`tiss_guide_items`+`payable_installments`+`receivables` (estoque_tiss) — every numeric KPI attached to its `kpi_targets` meta with `atingimento`, and a label per the Copywriting Contract

## Task Commits

Each task was committed atomically:

1. **Task 1: kpi-target-schema.ts + kpi-targets CRUD + bi-alerts read** - `cc83e71` (feat)
2. **Task 2: getBiKpis multi-dimension aggregation** - `fa096e6` (feat)

**Plan metadata:** (this commit) `docs: complete 19-07 plan`

## Files Created/Modified
- `src/lib/financeiro/kpi-target-schema.ts` - `kpiTargetSchema` (Zod v3, no `.default()`)
- `src/actions/kpi-targets.ts` - `listKpiTargets`/`saveKpiTarget`, `KPI_READ_ROLES`/`KPI_WRITE_ROLES`
- `src/actions/bi-alerts.ts` - `listBiAlerts` reading active `bi_alerts`
- `src/actions/bi-kpis.ts` - `getBiKpis` multi-dimension aggregation + 4 internal per-dimension helpers (`computeOperacional`, `computeProfissionais`, `computeCrc`, `computeEstoqueTiss`)

## Decisions Made
- **ocupacao formula (Claude's Discretion):** No working-hours/capacity table exists anywhere in the schema (`resources` tracks salas/cadeiras/equipamentos, not dentist schedules). Computed as `booked appointments (confirmado/em_atendimento/concluido) ÷ (distinct active dentists in period × business days (Mon-Fri) × 8 assumed 1h slots/day) × 100`. This is a pragmatic proxy, not a hard-verified capacity model — documented here for future revision if a real schedule/capacity table is added.
- **profissionais grain:** used `service_order_items.professional_id` (item-level, joined through `service_orders.status='faturada'`) rather than `appointments.dentist_id`, since `service_order_items` is the actual per-procedure revenue-attribution table in the schema (matches D-29's "faturamento/procedimentos por profissional" wording more precisely than appointment counts would).
- **CRC reuse:** `getBiKpis` statically imports `getNpsSummary` (nps.ts), `getRoiByCampaign`/`getRoiByOrigin` (roi.ts) rather than re-querying `nps_responses`/`campaigns`/`leads`/`payables` directly — mirrors the existing cross-action-file static-import convention already used by `dre.ts` (`listUnits`), `payables.ts`/`campaigns.ts` (`createApprovalRequest`).
- **glosa_taxa/atraso_pagamento unit scoping:** `tiss_guide_items` has no direct `unit_id`; resolved via a two-hop `service_orders → tiss_guides → tiss_guide_items` id-list query, mirroring the `unit_id → cost_center_ids` resolution pattern already established for DRE/budget in this phase.

## Deviations from Plan

None - plan executed exactly as written. The 4 must_haves truths, both artifacts' exports (`getBiKpis`; `listKpiTargets`/`saveKpiTarget`; `listBiAlerts`), and both key_links (Plan 13's future `bi/page.tsx` importing `getBiKpis`/`listBiAlerts`) are all satisfied by the files created.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 08 (bi-forecast-agent, BI-02) can now write `bi_alerts`/`approval_requests` rows that `listBiAlerts` (this plan) will surface to the panel.
- Plan 13 (BI dashboard page) can import `getBiKpis`/`listBiAlerts` directly per the plan's declared `key_links`.
- `npx tsc --noEmit` returns the same 43 pre-existing errors documented in 19-03's decision log (all in Phase 14-16 test files, none touching this plan's new files) — confirmed zero new errors introduced.
- `npm test` — 1821 passed, 4 pre-existing failures in `src/__tests__/governance/bi-forecast-agent.test.ts` (a RED scaffold intentionally committed in 19-03 targeting Plan 08, per STATE.md decision "Governance guard for bi-forecast-agent.ts committed RED before the agent exists"). Not caused by this plan.

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 4 created files verified present on disk; both task commit hashes (`cc83e71`, `fa096e6`) verified present in git log.
