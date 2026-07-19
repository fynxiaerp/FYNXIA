---
phase: 19-relat-rios-or-amento-bi
plan: 08
subsystem: ai-agents
tags: [bi-forecast, governance, withAgentPolicy, approval_requests, vercel-cron, linear-trend, ai-gateway]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi
    provides: "computeLinearTrend/isDecliningVsTrend (Plan 02), bi_alerts/budget_targets/kpi_targets tables + bi_forecast ai_agent_config seed (Plan 03)"
provides:
  - "runBiForecastForClinic — nightly per-clinic BI forecast/alert agent (BI-02)"
  - "GET /api/cron/bi-previsoes — daily 04:00 UTC cron driving the agent across active clinics"
  - "approveBudgetAdjustment — the only handler that applies agent-suggested budget_targets updates"
affects: [19-13-bi-panel, 19-alertas-previsoes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-account budget-deviation persistence check (last up-to-3 evaluated months all non-verde) gates the D-34 governed approval_requests suggestion"
    - "bi_alerts daily dedup via simple UTC day-bounds pre-check (no unique index backstop, unlike stock_alerts)"

key-files:
  created:
    - src/lib/agents/bi-forecast-agent.ts
    - src/app/api/cron/bi-previsoes/route.ts
  modified:
    - src/actions/approval-actions.ts
    - vercel.json

key-decisions:
  - "Budget deviation 'persistent' defined as >=2 consecutive evaluated months (up to the last 3) all non-'verde' — gates the D-34 governed approval_requests suggestion; a single-month deviation still produces an informative bi_alerts row with no approval_request_id"
  - "KPI-off-target evaluates only 'consultas_mes' and 'ticket_medio' against kpi_targets meta (the two KPIs the agent can derive from raw appointments/financial_transactions without duplicating getBiKpis' full multi-source aggregation)"
  - "payment_delay is a current-snapshot overdue-receivables count (not a trend) — severity amarelo <=5, vermelho >5"
  - "approveBudgetAdjustment calls approveRequest() FIRST (Step 1), mutates budget_targets only on success (Step 2) — mirrors approveCampaignAndDispatch's safety-critical ordering from Phase 18"

patterns-established:
  - "bi-forecast-agent.ts mirrors stock-agent.ts/collection-agent.ts: withAgentPolicy called per-row with the real resolved clinicId, never aggregate/null"

requirements-completed: [BI-02]

# Metrics
duration: ~20min
completed: 2026-07-19
---

# Phase 19 Plan 08: BI Forecast Agent, Nightly Cron & Approve-Adjustment Handler Summary

**Nightly per-clinic BI forecast agent (linear-trend revenue decline, budget-deviation semaphore, KPI-off-target, payment-delay) that writes bi_alerts and — only for persistent budget deviations — suggests budget_targets adjustments via a governed approval_requests flow, applied exclusively by the new approveBudgetAdjustment handler.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `runBiForecastForClinic` computes 12-month receita/margem OLS trend series (D-31/D-32), evaluates per-account budget deviation via `budgetDeviationSemaphore`, checks `consultas_mes`/`ticket_medio` against `kpi_targets` meta, and snapshots overdue receivables — inserting deduped `bi_alerts` rows for each trigger type (`revenue_decline`, `budget_deviation`, `kpi_off_target`, `payment_delay`)
- Persistent budget deviations route through `withAgentPolicy` (real per-clinic `clinicId`) and write ONLY to `approval_requests` — turns the Plan 02 governance guard (`bi-forecast-agent.test.ts`) GREEN
- `generateBiNarrative` produces a pt-BR alert narrative via the AI Gateway (numbers + kpi_key + clinic name only, ZDR), degrading to a static neutral sentence when `AI_GATEWAY_API_KEY` is absent
- New `GET /api/cron/bi-previsoes` (04:00 UTC, free slot) iterates all active clinics with per-row try/catch, calling `runBiForecastForClinic`
- `approveBudgetAdjustment` (extends `approval-actions.ts`) is the sole place that applies the suggested `budget_targets` UPDATE, gated behind `approveRequest()` succeeding first

## Task Commits

1. **Task 1: bi-forecast-agent.ts (trend + alert + suggestion) with LLM narrative** - `e52aae0` (feat)
2. **Task 2: bi-previsoes cron + vercel.json + approveBudgetAdjustment** - `213adb1` (feat)

## Files Created/Modified
- `src/lib/agents/bi-forecast-agent.ts` - `runBiForecastForClinic`, `generateBiNarrative`, per-trigger-type evaluators, `insertBiAlert` daily dedup
- `src/app/api/cron/bi-previsoes/route.ts` - nightly cron driving the agent across active clinics
- `src/actions/approval-actions.ts` - added `approveBudgetAdjustment`
- `vercel.json` - registered `/api/cron/bi-previsoes` at `0 4 * * *`

## Decisions Made
- Budget-deviation "persistence" window capped at the last 3 evaluated months (up to the current month), requiring at least 2 non-'verde' months to trigger the governed suggestion — balances D-34's intent against the complexity of a full historical scan
- KPI-off-target scope limited to `consultas_mes`/`ticket_medio` (derivable directly from `appointments`/`financial_transactions`) rather than replicating every KPI in `getBiKpis` (Plan 07), which requires an authenticated session the cron/agent context doesn't have
- `approveBudgetAdjustment` reuses `approveRequest()` internally rather than re-implementing alçada/idempotency checks — mirrors `approveCampaignAndDispatch`'s two-step ordering (approve-then-mutate) from Phase 18

## Deviations from Plan

None — plan executed exactly as written. One in-flight correction: the agent's inline code comment originally contained the literal substring `.from('budget_targets').update(...)` (as illustrative prose), which the governance guard's regex `/\.from\(['"]budget_targets['"]\)\s*\.update/` matched against even inside a comment — reworded the comment to avoid the exact pattern while preserving the same warning (Rule 1 — bug in my own draft, fixed before the Task 1 commit; not a deviation from the plan's actual code requirements).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. `AI_GATEWAY_API_KEY` remains an existing pre-configured/optional environment variable (already gated in prior phases); its absence degrades gracefully to the static narrative fallback.

## Next Phase Readiness
- `bi_alerts` rows (with `approval_request_id` set for concrete suggestions) are now populated nightly — the "Alertas & Previsões" panel (Plan 13) can read them via the existing `listBiAlerts` (Plan 07) without any further backend work
- `approveBudgetAdjustment` is ready to be wired into `ApprovalInbox` (Plan 13) for `bi_forecast` rows, mirroring the `crc-campaign` approve/reject wiring pattern
- No blockers

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/lib/agents/bi-forecast-agent.ts
- FOUND: src/app/api/cron/bi-previsoes/route.ts
- FOUND: e52aae0 (Task 1 commit)
- FOUND: 213adb1 (Task 2 commit)
