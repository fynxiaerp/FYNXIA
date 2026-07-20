---
phase: 19-relat-rios-or-amento-bi
plan: 12
subsystem: ui
tags: [nextjs, react-server-components, react-pdf, zod, nuqs, rls, societario]

# Dependency graph
requires:
  - phase: 19-relat-rios-or-amento-bi (Plan 06)
    provides: src/actions/partner-shares.ts (listSocios, listPartnerShares, createPartnerShareVigencia, closePartnerShareVigencia, getPartnerDistribution)
  - phase: 19-relat-rios-or-amento-bi (Plan 09)
    provides: role-based module gating precedent (ROLE_ROUTES / proxy.ts societario module)
provides:
  - Societário screen at /clinica/societario (REP-03)
  - Admin/superadmin per-sócio R$ distribution list + sócio own-row single-Card view
  - "Nova vigência" form blocking save unless percentuais sum to exactly 100%
  - "Encerrar vigência" destructive AlertDialog confirm
  - Read-only vigência history (Accordion, grouped by vigencia_inicio)
  - Societário PDF export (/api/societario/pdf) scoped by role
affects: [19-13, 19-14, future BI/relatorios cross-links]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain React state (not RHF) for a dynamic per-sócio percentual list — mirrors BudgetGrid.tsx's approach to the same 'list of numeric inputs' shape"
    - "Client-side vigência grouping by vigencia_inicio (Map, not a dedicated action) — read-only history rendered from the already-fetched listPartnerShares() rows"

key-files:
  created:
    - src/app/(dashboard)/clinica/societario/page.tsx
    - src/components/relatorios/PartnerDistribution.tsx
    - src/components/relatorios/PartnerShareFormDialog.tsx
    - src/components/relatorios/SocietarioPdf.tsx
    - src/app/api/societario/pdf/route.ts
  modified: []

key-decisions:
  - "SocietarioPeriodFilter exported from PartnerDistribution.tsx (not a new file) — mirrors D-310 precedent (DreFilters.tsx/OrcamentoFilters.tsx split), but this plan's files_modified list didn't declare a dedicated filter file, so the selector lives inside the already-'use client' PartnerDistribution.tsx module instead"
  - "'Encerrar vigência de {nome_sócio}?' confirm fills {nome_sócio} with the joined names of every sócio active in that vigência group, since closePartnerShareVigencia(vigenciaInicio) closes the whole vigência set at once (not a single sócio row) — literal UI-SPEC copy adapted to match the actual server contract"
  - "societario/pdf route allows admin/superadmin/socio (403 for others) — a sócio's PDF naturally contains only their own row because getPartnerDistribution's partner_shares read is RLS-scoped (T-19-02), no extra client-trusted filtering added"

patterns-established:
  - "PartnerDistribution.tsx branches on role==='socio' → single Card (D-24) vs admin/superadmin → full list (D-23), both sharing one VigenciaHistorySection"

requirements-completed: [REP-03]

# Metrics
duration: ~15min
completed: 2026-07-20
---

# Phase 19 Plan 12: Societário Screen Summary

**Societário screen (REP-03): per-sócio R$ distribution with signed negatives, admin-all vs sócio-single-Card views, a blocking 100%-validated "Nova vigência" form, destructive "Encerrar vigência" confirm, read-only vigência history, and role-scoped PDF export.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed
- **Files modified:** 5 (all newly created)

## Accomplishments
- Built the Societário RSC page reading `x-user-role` to gate "Nova vigência" (admin/superadmin only) and to select the single-Card own-row rendering for `socio`
- `PartnerDistribution.tsx` renders admin/superadmin's full per-sócio list (Badge percentual + Display 24px/600 tabular-nums R$, negative valores in `text-destructive`) and the sócio's single-Card own view, plus a shared read-only vigência history Accordion with an admin-only destructive "Encerrar vigência" confirm
- `PartnerShareFormDialog.tsx` collects percentuais per sócio, disables "Salvar" until the running sum equals exactly 100%, and calls `createPartnerShareVigencia` (server re-validates via `assertSharesValid`, D-22 defense-in-depth)
- Societário PDF export (`/api/societario/pdf`) — Node.js runtime, role-gated (admin/superadmin/socio; others 403), `no-store`, negative valores rendered in red

## Task Commits

1. **Task 1: societario page + PartnerDistribution + PartnerShareFormDialog** - `e45637f` (feat)
2. **Task 2: SocietarioPdf + societario/pdf route** - `faaa5aa` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/app/(dashboard)/clinica/societario/page.tsx` - RSC page: role read, period filter, Nova vigência gate, Exportar PDF, fetches getPartnerDistribution/listPartnerShares/listSocios
- `src/components/relatorios/PartnerDistribution.tsx` - Distribution list (admin) / single Card (sócio), vigência history Accordion, "Encerrar vigência" AlertDialog, `SocietarioPeriodFilter`
- `src/components/relatorios/PartnerShareFormDialog.tsx` - "Nova vigência" form with client-side 100%-sum gate
- `src/components/relatorios/SocietarioPdf.tsx` - @react-pdf/renderer document (Flexbox only, Roboto)
- `src/app/api/societario/pdf/route.ts` - Node.js runtime PDF route, role gate, no-store

## Decisions Made
- See `key-decisions` in frontmatter above — period filter location, "Encerrar vigência" copy adaptation, PDF role gate.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were required. The three items in `key-decisions` above are plan-interpretation decisions (Rule 4-adjacent judgment calls resolved without user input since they were unambiguous applications of existing precedent), not bug fixes or missing-functionality additions.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — plan executed as specified, with the interpretation calls documented above.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REP-03 (Societário) fully shipped: distribution, vigência CRUD (create/close), history, PDF — matches 19-UI-SPEC.md's Societário-specific section (D-23/D-24/D-27) and Access Control Summary table
- `npx tsc --noEmit` shows the same pre-existing 43-error baseline (D-298) — zero new errors from this plan's 5 files
- `npx vitest run` — 114 test files / 1825 tests, all passing
- Ready for 19-13/19-14 (remaining Phase 19 plans) and any future BI/relatórios cross-links to the Societário screen

---
*Phase: 19-relat-rios-or-amento-bi*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/clinica/societario/page.tsx
- FOUND: src/components/relatorios/PartnerDistribution.tsx
- FOUND: src/components/relatorios/PartnerShareFormDialog.tsx
- FOUND: src/components/relatorios/SocietarioPdf.tsx
- FOUND: src/app/api/societario/pdf/route.ts
- FOUND commit: e45637f
- FOUND commit: faaa5aa
