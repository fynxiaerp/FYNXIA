---
phase: 18-crc-marketing
plan: 08
subsystem: crc-marketing
tags: [crc, roi, cpl, cac, payables, campaigns, financeiro, nuqs]

# Dependency graph
requires:
  - phase: 18-crc-marketing (Plan 02)
    provides: payables.campaign_id nullable FK, campaigns table schema
  - phase: 18-crc-marketing (Plan 03)
    provides: leads table + listConversionByOrigin pattern
  - phase: 18-crc-marketing (Plan 05)
    provides: listCampaigns() action
provides:
  - getRoiByCampaign / getRoiByOrigin server actions (CPL/CAC aggregates from payables.campaign_id)
  - /clinica/crc/roi read-only ROI panel (KPI cards + origin table + nuqs filters)
  - PayableFormDialog "Vincular a campanha" optional field (payables.campaign_id write path)
affects: [18-09, 18-10, 18-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cost-by-campaign rollup: SUM(payables.valor_total) WHERE campaign_id AND status<>'cancelado' AND deleted_at IS NULL, computed via in-memory Map reduce (no SQL SUM RPC available via supabase-js)"
    - "Zero-denominator CPL/CAC always delegated to computeCpl/computeCac (roi-math.ts) — never inline division"
    - "Client component lazily fetches a Server Action list (listCampaigns) on Dialog open, instead of threading a new prop through every RSC caller — keeps files_modified scope to a single file"

key-files:
  created:
    - src/actions/roi.ts
    - src/app/(dashboard)/clinica/crc/roi/page.tsx
    - src/components/crc/RoiKpiRow.tsx
    - src/components/crc/RoiByOriginTable.tsx
    - src/components/crc/RoiFilters.tsx
  modified:
    - src/components/financeiro/PayableFormDialog.tsx
    - src/actions/payables.ts
    - src/lib/validators/payable.ts

key-decisions:
  - "getRoiByOrigin attributes cost to a source via campaigns whose leads share that source_id (independent attribution axis from the campaign filter, per RESEARCH §Pattern 2) — sources with no campaign-linked leads render '—' for custoAtribuido/CPL/CAC"
  - "PayableFormDialog fetches listCampaigns() client-side on dialog open (not threaded as a new page prop) — keeps the plan's single-file files_modified scope intact while avoiding a stale/empty campaigns list"

patterns-established:
  - "RoiFilters.tsx (nuqs campanha/from/to) — new client filter component, not listed in the plan's frontmatter files_modified, added to satisfy task 2's explicit filter instruction and UI-SPEC §3"

requirements-completed: [CRC-02]

# Metrics
duration: ~30min
completed: 2026-07-13
---

# Phase 18 Plan 08: Campaign ROI Panel Summary

**Server-computed CPL/CAC/conversion-by-origin from `payables.campaign_id` (never manual cost entry), rendered in a read-only `/clinica/crc/roi` panel, plus the one new "Vincular a campanha" field on Contas a Pagar that feeds it.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- `src/actions/roi.ts`: `getRoiByCampaign` (per-campaign + aggregate summary) and `getRoiByOrigin` (per-source conversion + cost attribution) — both RLS-scoped, read-only, zero-denominator-safe via `computeCpl`/`computeCac`.
- `/clinica/crc/roi` read-only panel: KPI cards (Custo Total / CPL / CAC / Taxa de Conversão Geral), Conversão e ROI por Origem table, empty state per Copywriting Contract, and the D-05 informative banner linking to Contas a Pagar.
- `payables.campaign_id` is now writable end-to-end: `PayableFormDialog` gained an optional "Vincular a campanha" Select; `createPayable`/`payableSchema` accept and persist `campaignId`.

## Task Commits

1. **Task 1: roi.ts — CPL/CAC + conversion-by-origin aggregates** - `11a716a` (feat)
2. **Task 2: ROI panel page + KPI row + RoiByOriginTable** - `063b8d0` (feat)
3. **Task 3: PayableFormDialog — optional "Vincular a campanha" field (D-05)** - `150da6e` (feat)

## Files Created/Modified

- `src/actions/roi.ts` — `getRoiByCampaign` / `getRoiByOrigin`; `getCostByCampaign` private helper reused by both
- `src/app/(dashboard)/clinica/crc/roi/page.tsx` — RSC page, parallel fetch, empty state, banner
- `src/components/crc/RoiKpiRow.tsx` — 4 KPI cards, mirrors `NfseKpiRow.tsx`
- `src/components/crc/RoiByOriginTable.tsx` — origin table with `—` fallbacks
- `src/components/crc/RoiFilters.tsx` — nuqs `campanha`/`from`/`to` filter controls
- `src/components/financeiro/PayableFormDialog.tsx` — "Vincular a campanha" Select, lazy `listCampaigns()` fetch on open
- `src/actions/payables.ts` — `createPayable` writes `campaign_id`
- `src/lib/validators/payable.ts` — `payableSchema` gains optional `campaignId`

## Decisions Made

- Cost attribution for the origin table (`getRoiByOrigin`) sums the cost of every campaign that has at least one lead from that source — this is a best-effort, discretionary heuristic (RESEARCH explicitly notes source-vs-campaign are independent attribution axes and both must degrade to `—` gracefully); a source with zero campaign-linked leads renders `custoAtribuido`/`cpl`/`cac` as `null`.
- `PayableFormDialog` fetches `listCampaigns()` itself (client-side, on dialog open) rather than requiring every RSC caller (`contas-a-pagar/page.tsx`, `PayablesTable.tsx`) to be updated to pass a new `campaigns` prop — keeps the change contained to the single file listed in the plan's frontmatter, and the Select simply doesn't render when the clinic has no campaigns yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `RoiFilters.tsx` (nuqs campanha/from/to controls)**
- **Found during:** Task 2
- **Issue:** The plan's frontmatter `files_modified` list for Plan 08 does not include a filters component, but task 2's `<action>` text explicitly requires "nuqs filters (campanha Select 'Todas', date range from/to)" per UI-SPEC §3, and the RSC page cannot host `useQueryState` hooks directly.
- **Fix:** Added `src/components/crc/RoiFilters.tsx`, a small client component mirroring `CashFlowFilters.tsx`'s pattern (Select + two date inputs bound to `useQueryState`), wired into the RSC page via `NuqsAdapter`.
- **Files modified:** `src/components/crc/RoiFilters.tsx` (new), `src/app/(dashboard)/clinica/crc/roi/page.tsx`
- **Verification:** `npx tsc --noEmit` clean; filters read/write `campanha`/`from`/`to` URL params consumed by the page's `searchParams`.
- **Committed in:** `063b8d0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — UI completeness required by the plan's own task text)
**Impact on plan:** Necessary to fulfill the plan's explicit filter requirement; no scope creep beyond what task 2 already specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CRC-02 (campaign ROI) is closed: cost is sourced exclusively from the financial module, CPL/CAC render gracefully with no divide-by-zero paths.
- `payables.campaign_id` write path is live — future Phase 19/20 reporting work can join on it directly.
- No blockers for Plans 09–11.

---
*Phase: 18-crc-marketing*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 8 created/modified source files verified present on disk; all 3 task commits (`11a716a`, `063b8d0`, `150da6e`) verified present in git history.
