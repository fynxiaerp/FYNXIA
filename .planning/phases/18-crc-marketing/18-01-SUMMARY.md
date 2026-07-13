---
phase: 18-crc-marketing
plan: 01
subsystem: foundations
tags: [zod, vitest, dnd-kit, whatsapp, tdd, roi-math, nps]

# Dependency graph
requires:
  - phase: 17-estoque-materiais
    provides: RED source-inspection scaffold pattern (SRC() helper, vi.mock('server-only'))
  - phase: 10-ia-governada-l0-l4-auditoria-ocr
    provides: withAgentPolicy L0-L4 governance gate, approval_requests table
provides:
  - "@dnd-kit/react v0.5.0 installed (kanban drag-and-drop dependency for Plan 03+)"
  - "TEMPLATE_REACTIVATION + TEMPLATE_NPS_INVITE WhatsApp template constants and component builders"
  - "Pure CPL/CAC/NPS math (src/lib/crc/roi-math.ts) — unit-tested, zero-denominator-safe"
  - "Zod v3 validators for all CRC Server Action inputs (src/lib/validators/crc.ts)"
  - "isValidStageTransition forward-only lead funnel state machine"
  - "5 RED source-inspection scaffolds for downstream Server Actions/agent/cron"
affects: [18-02, 18-03, 18-04, 18-05, 18-06]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/react@0.5.0"]
  patterns:
    - "Pure business-logic module (roi-math.ts) with zero I/O, unit-tested independent of DB — mirrors reminder-scan.ts/lab-cost.ts convention"
    - "Zod v3 schemas with no .default() modifier (D-133) — RHF v7 supplies defaults via useForm({ defaultValues })"
    - "RED source-inspection scaffolds (SRC() + vi.mock('server-only')) for not-yet-written Server Actions — mirrors Phase 17 Wave 0 pattern"

key-files:
  created:
    - src/lib/crc/roi-math.ts
    - src/lib/validators/crc.ts
    - src/__tests__/crc/roi-math.test.ts
    - src/__tests__/crc/validators.test.ts
    - src/__tests__/crc/leads.test.ts
    - src/__tests__/crc/campaigns.test.ts
    - src/__tests__/crc/segment.test.ts
    - src/__tests__/crc/nps-scan.test.ts
    - src/__tests__/crc/referrals.test.ts
  modified:
    - package.json
    - src/lib/whatsapp/templates.ts

key-decisions:
  - "@dnd-kit/react (not legacy @dnd-kit/core+sortable) chosen per RESEARCH — official React 19-peer successor"
  - "isValidStageTransition lives in validators/crc.ts (not roi-math.ts) — co-located with LEAD_STAGES and other Zod schemas per plan's must_haves export list"
  - "TEMPLATE_REACTIVATION registered as MARKETING category; TEMPLATE_NPS_INVITE stays UTILITY — per Pitfall 8 (Meta auto-reclassification risk)"

patterns-established:
  - "Pattern: pure math/validation modules created and unit-tested BEFORE any Server Action wiring — downstream plans implement against fixed signatures with no exploration"

requirements-completed: [CRC-01, CRC-02, CRC-03, CRC-04, CRC-05]

# Metrics
duration: 35min
completed: 2026-07-13
---

# Phase 18 Plan 01: CRC & Marketing Foundations Summary

**Pure CPL/CAC/NPS math + Zod validators + kanban DnD dependency + WhatsApp reactivation/NPS templates, all unit-tested GREEN, with 5 RED scaffolds staged for downstream Server Actions.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-12T23:30:00Z (approx.)
- **Completed:** 2026-07-13T00:04:51Z
- **Tasks:** 3
- **Files modified:** 11 (2 modified, 9 created)

## Accomplishments
- Installed `@dnd-kit/react` v0.5.0 (verified latest 0.x, React 19 peer) for the future lead-funnel kanban board — avoided the legacy `@dnd-kit/core`+`@dnd-kit/sortable` branch per RESEARCH
- Added `TEMPLATE_REACTIVATION`/`TEMPLATE_NPS_INVITE` WhatsApp template constants + `buildReactivationComponents`/`buildNpsInviteComponents` builders to the existing `templates.ts`, without touching any existing exports
- Built and fully unit-tested (47 tests, GREEN) `src/lib/crc/roi-math.ts` (computeCpl/computeCac/classifyNps/computeNpsScore) and `src/lib/validators/crc.ts` (7 Zod schemas + `isValidStageTransition` state machine)
- Staged 5 RED source-inspection scaffolds (`leads.test.ts`, `referrals.test.ts`, `campaigns.test.ts`, `segment.test.ts`, `nps-scan.test.ts`) that assert markers on not-yet-written Server Actions/agent/cron files, so Plans 03-06 have fixed contracts to implement against

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit/react + add WhatsApp reactivation & NPS-invite templates** - `67276b0` (feat)
2. **Task 2: CRC Zod validators + pure ROI/NPS math** - `293a63f` (test, RED) → `c860a4b` (feat, GREEN)
3. **Task 3: RED source-inspection scaffolds for Server Actions / agent / cron** - `542446d` (test)

_Note: Task 2 is a TDD task — RED (failing tests) committed first, then GREEN (implementation) in a separate commit, per the tdd_execution workflow._

## Files Created/Modified
- `package.json` - Added `@dnd-kit/react@^0.5.0` dependency
- `src/lib/whatsapp/templates.ts` - Added `TEMPLATE_REACTIVATION`, `TEMPLATE_NPS_INVITE`, `buildReactivationComponents`, `buildNpsInviteComponents`
- `src/lib/crc/roi-math.ts` - Pure CPL/CAC/NPS math (`computeCpl`, `computeCac`, `classifyNps`, `computeNpsScore`)
- `src/lib/validators/crc.ts` - `LEAD_STAGES`, `leadSchema`, `leadSourceSchema`, `campaignSegmentSchema`, `campaignChannelSchema`, `npsSubmitSchema`, `referralSchema`, `isValidStageTransition`
- `src/__tests__/crc/roi-math.test.ts` - 15 GREEN unit tests for roi-math.ts
- `src/__tests__/crc/validators.test.ts` - 32 GREEN unit tests for validators/crc.ts
- `src/__tests__/crc/leads.test.ts` - RED scaffold for `src/actions/leads.ts` (6 assertions)
- `src/__tests__/crc/referrals.test.ts` - RED scaffold for `src/actions/referrals.ts` (5 assertions)
- `src/__tests__/crc/campaigns.test.ts` - RED scaffold for `src/actions/campaigns.ts` + `src/lib/agents/campaign-agent.ts` (9 assertions)
- `src/__tests__/crc/segment.test.ts` - RED scaffold for `src/lib/crc/segment.ts` (4 assertions)
- `src/__tests__/crc/nps-scan.test.ts` - RED scaffold for `src/lib/crc/nps-scan.ts` + cron route (6 assertions)

## Decisions Made
- `isValidStageTransition` placed in `src/lib/validators/crc.ts` (co-located with `LEAD_STAGES`) rather than `roi-math.ts` — matches the plan's must_haves export list for `validators/crc.ts` exactly.
- `isValidStageTransition` interprets "forward-only" as any forward jump through `novo→contatado→agendado→convertido` (not strictly one-step-at-a-time), plus a universal escape hatch to `perdido` from any non-terminal stage — matches D-01's funnel order and the plan's explicit `<behavior>` row for terminal-stage rejection.
- Avoided the literal string `.default(` inside a code comment in `validators/crc.ts` (it would have falsely tripped the plan's own `! grep -q '\.default('` acceptance check) — reworded the comment to describe the same D-133 constraint without the literal pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing `npx tsc --noEmit` errors (41, all `TS2532`/`TS1501` in unrelated `financeiro`/`faturamento` test files, e.g. `src/__tests__/financeiro/chart-of-accounts.test.ts`) were present before this plan's changes and are outside this plan's file scope (SCOPE BOUNDARY rule) — not fixed, not caused by this plan. Verified via `grep -i "crc\|whatsapp\|templates.ts"` on the tsc output: zero matches, confirming this plan's files are clean.

## User Setup Required

None - no external service configuration required. (Meta template registration for `fynxia_reativacao`/`fynxia_pesquisa_nps` in Meta Business Manager remains an external manual step for a later plan that actually sends these templates — tracked as an existing open question in STATE.md, not new to this plan.)

## Next Phase Readiness
- `@dnd-kit/react` is installed and resolvable — Plan 03 (kanban board) can start immediately.
- `src/lib/crc/roi-math.ts` and `src/lib/validators/crc.ts` provide fixed, tested signatures for every downstream Server Action (leads, campaigns, referrals, NPS) to import against without further exploration.
- 5 RED scaffolds define the exact contract (exported function names, key markers) that Plans 03-06 must satisfy to turn GREEN — no blockers.
- No DB/migration work was in scope for this plan (by design — Wave 1 foundations only).

---
*Phase: 18-crc-marketing*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 11 created/modified files verified present on disk; all 4 task commit hashes (`67276b0`, `293a63f`, `c860a4b`, `542446d`) verified present in git history.
