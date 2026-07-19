---
phase: 19-relat-rios-or-amento-bi
plan: 09
subsystem: ui
tags: [rbac, proxy, nav, charts, svg, tailwind, phase-19]

# Dependency graph
requires:
  - phase: 07-sistema-multiunidade-pap-is
    provides: role='socio' in RBAC (ROLE-01), MODULE_PERMISSIONS/ROUTE_MODULE_MAP pattern in proxy.ts
  - phase: 06 (App shell)
    provides: nav-config.ts/nav-icons.ts sidebar architecture, Card primitive, design tokens (chart-1..5/primary/muted)
provides:
  - Four new gated ModuleKeys (relatorios, orcamento, societario, reusing pre-wired bi) with correct role×module access matrix
  - 4 new sidebar nav entries (Relatórios, Orçamento, Societário, BI)
  - New production chart-primitive namespace (src/components/relatorios/charts.tsx) — KpiCard/ChartCard/LineChart/BarChart/DonutChart/DeltaBadge/OccupancyBar
affects: [19-10, 19-11, 19-12, 19-13 (all 4 Wave-3 screen plans import from src/components/relatorios/charts.tsx and rely on proxy.ts gating)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New ModuleKey + ROUTE_MODULE_MAP entries inserted most-specific-first, immediately before the /clinica catch-all (mirrors documentos/financeiro/receituario pattern)"
    - "Chart primitives are pure SVG/CSS on Tailwind design tokens — zero new dependency, copied technique per D-37 into an independent namespace"

key-files:
  created:
    - src/__tests__/rbac-phase19.test.ts
    - src/components/relatorios/charts.tsx
  modified:
    - src/proxy.ts
    - src/components/shell/nav-config.ts
    - src/components/shell/nav-icons.ts

key-decisions:
  - "socio granted orcamento:{allowed:true} with NO readOnly flag (D-14) — dedicated ModuleKey avoids the financeiro readOnly conflict (Pitfall 1 / T-19-14)"
  - "deriveRoleRoutes() extended to map relatorios/orcamento/societario to /clinica (not a bogus top-level /relatorios route) for ROLE_ROUTES backward-compat, mirroring the existing financeiro/documentos/receituario/teleodontologia/esterilizacao/protese handling"
  - "auditor/dpo intentionally left OFF relatorios/orcamento/societario — CONTEXT.md restricts these 3 screens to Admin/Sócio/Superadmin only (D-09/D-39); existing pre-wired bi module keeps its own auditor/dpo readOnly grants unchanged"

patterns-established:
  - "OccupancyBar({ value }) — thin bg-muted/bg-primary progress bar for DRE unit-ranking, added to the new chart namespace per UI-SPEC"

requirements-completed: [REP-01, REP-02, REP-03, BI-01, BI-02]

# Metrics
duration: ~5min
completed: 2026-07-19
---

# Phase 19 Plan 09: Shared UI Foundation (RBAC + Nav + Charts) Summary

**Added relatorios/orcamento/societario RBAC modules (with the socio-write budget carve-out) plus 4 sidebar nav entries and a new dependency-free SVG chart-primitive namespace for the 4 upcoming Relatórios/Orçamento/Societário/BI screens.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19T20:46:00Z (approx, based on STATE.md last_updated at read time)
- **Completed:** 2026-07-19T20:50:28Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `src/proxy.ts` gates `/clinica/relatorios`, `/clinica/orcamento`, `/clinica/societario` for Admin/Sócio/Superadmin only, with socio getting full write access to `orcamento` (not read-only) per D-14 — preventing the Pitfall-1 financeiro-readOnly collision (T-19-14).
- Existing pre-wired `bi` ModuleKey (already gating `/bi` for admin/superadmin full + socio/auditor/dpo readOnly) reused as-is, untouched.
- 4 new sidebar entries (Relatórios/Orçamento/Societário/BI, `adminOnly: true`) added to `ALL_NAV_ITEMS` with Lucide icon mappings (`FileBarChart`/`Target`/`PieChart`/`TrendingUp`).
- New `src/components/relatorios/charts.tsx` namespace ships pixel/behavior-equivalent `KpiCard`/`ChartCard`/`LineChart`/`BarChart`/`DonutChart`/`DeltaBadge` (copied SVG/CSS technique, zero new deps) plus a new `OccupancyBar` component, ready for import by all 4 Wave-3 screen plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: RBAC modules + route map + rbac test** - `63fcf94` (feat)
2. **Task 2: Sidebar nav entries + new chart primitives** - `d423e6d` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `src/proxy.ts` - ModuleKey union + MODULE_PERMISSIONS entries for relatorios/orcamento/societario (superadmin/admin full, socio per D-14); ROUTE_MODULE_MAP most-specific-first entries; deriveRoleRoutes() extended for ROLE_ROUTES compat
- `src/__tests__/rbac-phase19.test.ts` - new test asserting the access matrix (admin/dentist/socio/receptionist × relatorios/orcamento/societario/bi)
- `src/components/shell/nav-config.ts` - NavIconKey union + 4 new ALL_NAV_ITEMS entries (adminOnly: true)
- `src/components/shell/nav-icons.ts` - Lucide icon mappings for the 4 new keys
- `src/components/relatorios/charts.tsx` - new production chart namespace (D-37): KpiCard, ChartCard, LineChart, BarChart, DonutChart, DeltaBadge, OccupancyBar

## Decisions Made
- socio's `orcamento` entry deliberately omits `readOnly:true` while `relatorios`/`societario` keep it — the single differentiator required by D-14, verified by a dedicated test assertion.
- `deriveRoleRoutes()` special-cased the 3 new modules into `/clinica` (not `/relatorios` etc.) to keep `ROLE_ROUTES` backward-compat semantics consistent with the existing financeiro/documentos/receituario/teleodontologia/esterilizacao/protese sub-modules — this was not explicitly called out in the plan text but follows the exact established pattern immediately above it in the same function (Rule 1 — bug/consistency fix, zero test impact since no existing assertion checked for absence of a bogus top-level path).
- nav-config.ts file the plan listed as `nav-icons.tsx` is actually `nav-icons.ts` in the codebase (no `.tsx`, pure TS mapping file, no JSX) — edited the real file; no behavior difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Consistency] Extended deriveRoleRoutes() special-case list to include the 3 new modules**
- **Found during:** Task 1 (RBAC modules)
- **Issue:** Without this fix, `ROLE_ROUTES['admin']` etc. would have gained non-existent top-level entries like `/relatorios`, `/orcamento`, `/societario` (derived from the module key directly) instead of the correct `/clinica` prefix these routes actually live under — inconsistent with every other `/clinica/*` sub-module already handled by the same function.
- **Fix:** Added `relatorios`/`orcamento`/`societario` to the existing `mod === 'financeiro' || ...` special-case condition in `deriveRoleRoutes()`.
- **Files modified:** `src/proxy.ts`
- **Verification:** `npx vitest run src/__tests__/rbac-phase19.test.ts src/__tests__/proxy/rbac.test.ts src/__tests__/rbac` — 58 tests pass, no regressions.
- **Committed in:** `63fcf94` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 consistency/bug fix)
**Impact on plan:** Fix keeps `ROLE_ROUTES` semantically correct with zero behavioral risk (only affects a backward-compat derived structure used by legacy tests, none of which assert on the specific bogus paths that would otherwise appear). No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/components/relatorios/charts.tsx` is import-ready for Plans 19-10 through 19-13 (`import { KpiCard } from '@/components/relatorios/charts'`).
- `proxy.ts` correctly gates all 4 upcoming screens; Wave-3 plans do not need to touch RBAC.
- Sidebar shows all 4 new entries for admin/superadmin; socio visibility into the sidebar itself (vs. route-level RBAC) was scoped per the plan's explicit `adminOnly: true` instruction — sócio can still navigate directly to `/clinica/orcamento` etc. (RBAC allows it) even though the sidebar link is currently admin/superadmin-only. This mirrors the plan's own stated rationale ("RBAC is the real gate") and is not a blocker for downstream plans.
- No blockers for Wave 2/3 plans.

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/proxy.ts
- FOUND: src/__tests__/rbac-phase19.test.ts
- FOUND: src/components/shell/nav-config.ts
- FOUND: src/components/shell/nav-icons.ts
- FOUND: src/components/relatorios/charts.tsx
- FOUND commit: 63fcf94 (Task 1)
- FOUND commit: d423e6d (Task 2)
