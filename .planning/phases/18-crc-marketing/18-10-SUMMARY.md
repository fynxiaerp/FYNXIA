---
phase: 18-crc-marketing
plan: 10
subsystem: ui
tags: [nextjs, supabase, nps, public-token-route, shadcn, nuqs, base-ui]

# Dependency graph
requires:
  - phase: 18-crc-marketing (Plan 06)
    provides: submitNpsPublic, markDetractorTreated, listNpsResponses, getNpsSummary Server Actions + npsSubmitSchema
affects: [18-11 (referral program, closes CRC-05, same CRC hub)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Force-light theme for isolated public routes: wrap in `<div className=\"light\">` AND define a `.light { ...vars... }` CSS block (not just the class name) — custom properties set directly on an element win over an inherited `.dark` ancestor class from next-themes"
    - "Public single-field forms use useState only (no react-hook-form) to keep bundle weight down on unauthenticated routes"

key-files:
  created:
    - src/app/(dashboard)/clinica/crc/nps/page.tsx
    - src/components/crc/NpsScoreCard.tsx
    - src/components/crc/DetractorAlertBanner.tsx
    - src/components/crc/NpsResponsesTable.tsx
    - src/components/crc/NpsFilters.tsx
    - src/app/nps/[patient-id]/[token]/page.tsx
    - src/components/crc/NpsPublicForm.tsx
  modified:
    - src/proxy.ts
    - src/app/globals.css

key-decisions:
  - "Added NpsFilters.tsx (date range + unit Select via nuqs) — not in Plan 10's files_modified list but required by UI-SPEC §5's filter contract; mirrors the RoiFilters precedent from Plan 05"
  - "Registered /nps as a public route in proxy.ts — without this the unauthenticated public form would redirect to /login, silently breaking the entire CRC-04 patient-facing loop"
  - "Added a .light CSS override block in globals.css duplicating :root's light values — the `.light` wrapper class alone is cosmetic unless it also redefines the custom properties, otherwise an ancestor next-themes `.dark` class on <html> still wins by inheritance"

patterns-established:
  - "Force-light public route pattern (`.light` wrapper + matching CSS override block) — reusable for any future public/unauthenticated route that must not inherit next-themes dark mode"

requirements-completed: []  # CRC-04 partially complete — Task 3 (human-verify checkpoint) still pending, do NOT mark complete until approved

# Metrics
duration: ~20min
completed: 2026-07-13
---

# Phase 18 Plan 10: NPS Panel + Public Single-Use Form Summary

**Internal NPS panel (score card, promotor/neutro/detrator KPIs, detractor alert + treatment, responses table) and a public mobile-first single-use 0-10 NPS form at `/nps/[patient-id]/[token]` that force-locks the light theme and never reveals detractor classification to the patient.**

## Performance

- **Tasks completed:** 2 of 3 (Task 3 is a blocking `checkpoint:human-verify` — not executable by an agent)
- **Files created:** 7
- **Files modified:** 2 (`src/proxy.ts`, `src/app/globals.css`)

## Accomplishments

- Built the internal `/clinica/crc/nps` panel: `NpsScoreCard` (Numeric/KPI role — `text-2xl font-semibold tabular-nums`, NOT a 5th type-scale size), promotor/neutro/detrator KPI cards, `DetractorAlertBanner` (destructive Alert, D-15), `NpsResponsesTable` with classification badges, comment Popover-expand, and per-row "Marcar como Tratado" wired to `markDetractorTreated`.
- Built the public `/nps/[patient-id]/[token]` route mirroring the anamnese public-token pattern (`isTokenValid` + `score IS NULL` read check as the render gate; `submitNpsPublic`'s atomic conditional UPDATE remains the actual TOCTOU security boundary, T-18-31).
- Built `NpsPublicForm`: 11 real `<button type="button" aria-pressed>` for the 0-10 scale, optional 500-char comment `Textarea`, disabled submit until a score is chosen, thank-you swap on success — the 0-6 range is never visually distinguished from 7-10 (T-18-32).
- Forced the light theme on both public states (error + form) via a `<div className="light">` wrapper backed by a real CSS override block (see Deviations) so the route renders consistently in WhatsApp/e-mail WebViews.

## Task Commits

1. **Task 1: NPS panel page + ScoreCard + KPIs + DetractorAlertBanner + ResponsesTable** - `4b90dc3` (feat)
2. **Task 2: Public NPS route + NpsPublicForm (single-use, light theme)** - `8a9bbe2` (feat)

**Plan metadata:** pending (this SUMMARY commit)

## Files Created/Modified

- `src/app/(dashboard)/clinica/crc/nps/page.tsx` - Server Component panel: fetches `getNpsSummary` + `listNpsResponses` + `listUnits` in parallel, renders score card → detractor alert → secondary KPIs → responses table, true-empty state when there are zero responses ever (unfiltered)
- `src/components/crc/NpsScoreCard.tsx` - Score anchor card, `+N`/`-N` label, green ≥0 / red <0, promotor/neutro/detrator % breakdown computed from raw counts
- `src/components/crc/DetractorAlertBanner.tsx` - Destructive `Alert` with the literal Copywriting Contract string (not dynamically pluralized — matches the spec's literal "avaliação(ões)"/"detratora(s)" form)
- `src/components/crc/NpsResponsesTable.tsx` - Table with `BucketBadge`, `CommentCell` (Popover expand for long comments), `DetractorStatusCell` (Pendente/Tratado + DropdownMenu "Marcar como Tratado" → `markDetractorTreated`, `router.refresh()` on success)
- `src/components/crc/NpsFilters.tsx` - Date range + unit `Select` via nuqs (`from`/`to`/`unidade` URL params), unit selector only rendered when `units.length > 1`
- `src/app/nps/[patient-id]/[token]/page.tsx` - Public Server Component; validates token via `isTokenValid` + `score IS NULL`, renders full-page error or the form, both wrapped in `.light`
- `src/components/crc/NpsPublicForm.tsx` - Client form, `useState` only, 0-10 button scale, optional comment, `submitNpsPublic` call, thank-you swap
- `src/proxy.ts` - Added `/nps` to `isPublicRoute` so the unauthenticated public form is reachable
- `src/app/globals.css` - Added a `.light { ... }` block duplicating `:root`'s light theme custom properties

## Decisions Made

- **NpsFilters as a new component** — the plan's `files_modified` list didn't include a filters component, but UI-SPEC §5 explicitly requires "Filtros (nuqs): Date range + Select de unidade" on this screen. Followed the same precedent set by `RoiFilters.tsx` in Plan 05 (also added outside the original `files_modified` list for the same reason).
- **`.light` CSS override block instead of relying on the class name alone** — the UI-SPEC's literal instruction (`<div className="light">`) is only cosmetic unless the class also redefines the CSS custom properties Tailwind reads (`--background`, `--foreground`, etc.). Without this, a browser with a previously-toggled dark preference (next-themes `.dark` class on `<html>`) would still render the public form in dark mode via inheritance, silently violating the "avoid FOUC in WhatsApp WebViews" requirement.
- **Public route registration in `proxy.ts`** — required for the route to be reachable at all by an unauthenticated patient; without it, every link sent to a patient would redirect to `/login` and CRC-04's collection loop would be completely broken.
- **Two separate admin-client reads on the public page** (`nps_responses` then `clinics`) instead of a single embedded join — no existing precedent in the codebase for embedding `clinics(name)` via PostgREST from this table, so kept it as two simple, unambiguous queries rather than risk an unverified relationship-embedding syntax.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `/nps` as a public route in `src/proxy.ts`**
- **Found during:** Task 2 (public NPS route)
- **Issue:** `proxy.ts`'s `isPublicRoute` check only allowlisted `/invite`, `/agendar`, `/anamnese`, `/painel`. Without adding `/nps`, every unauthenticated visit to the new public form would be redirected to `/login`, making the entire public NPS flow non-functional.
- **Fix:** Added `pathname.startsWith('/nps')` to `isPublicRoute`.
- **Files modified:** `src/proxy.ts`
- **Verification:** `npx tsc --noEmit` clean; route logic reviewed against the existing `/anamnese` precedent in the same file.
- **Committed in:** `8a9bbe2` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added a `.light` CSS custom-property override block in `globals.css`**
- **Found during:** Task 2 (forced light theme requirement)
- **Issue:** UI-SPEC §6 requires the public form to force the light theme "NÃO usar next-themes" via a `.light` wrapper. Simply adding `className="light"` to a `<div>` has no effect on Tailwind's CSS-variable-driven theme unless a `.light` rule actually redefines those variables — otherwise an ancestor `.dark` class (set by next-themes on `<html>` if the browser previously toggled dark mode) still wins via inheritance, defeating the entire purpose of forcing light mode.
- **Fix:** Added a `.light { --background: ...; --foreground: ...; ... }` block to `globals.css` duplicating `:root`'s light theme values, placed after the `.dark` block.
- **Files modified:** `src/app/globals.css`
- **Verification:** Visual/functional verification of the actual rendered theme is part of the pending Task 3 human-verify checkpoint (viewing the link on a phone).
- **Committed in:** `8a9bbe2` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added `NpsFilters.tsx` (date range + unit Select)**
- **Found during:** Task 1 (NPS panel)
- **Issue:** UI-SPEC §5 explicitly specifies "Filtros (nuqs): Date range (De/Até) + Select de unidade (se multi-unidade)" for this screen, but the plan's `files_modified` list omitted a filters component.
- **Fix:** Created `NpsFilters.tsx` mirroring the existing `RoiFilters.tsx` pattern (same nuqs `useQueryState` approach, same visual layout).
- **Files modified:** `src/components/crc/NpsFilters.tsx`, wired into `src/app/(dashboard)/clinica/crc/nps/page.tsx`
- **Verification:** `npx tsc --noEmit` clean; ESLint clean.
- **Committed in:** `4b90dc3` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical)
**Impact on plan:** All three were necessary for the plan's stated must-haves to actually function (public route reachability, genuine forced light theme, and the UI-SPEC's declared filter contract). No scope creep beyond what the plan and its referenced UI-SPEC already required.

## Issues Encountered

None beyond the deviations documented above.

## Human Checkpoint — NOT YET VERIFIED

Task 3 (`checkpoint:human-verify`, gate="blocking") requires a live cross-device walkthrough (trigger invite → open link on phone → submit score → reload for single-use enforcement → verify panel classification + detractor alert/treatment). This is **manual-only verification** per `18-VALIDATION.md` and was **not** performed or fabricated by this execution — it is returned to the orchestrator as a pending checkpoint. Do not mark `CRC-04` complete in `REQUIREMENTS.md` until this checkpoint is explicitly approved.

## Next Phase Readiness

- Build work for Plan 10 is complete and committed; the plan itself remains **incomplete** pending the Task 3 checkpoint.
- Once the checkpoint is approved by the user, a continuation agent should: (a) confirm no follow-up fixes are needed, (b) mark `CRC-04` complete via `requirements mark-complete`, and (c) finalize this plan's metadata/final commit.
- Plan 11 (referral program, CRC-05) is independent of this plan's checkpoint outcome and can proceed in parallel if needed.

---
*Phase: 18-crc-marketing*
*Completed (build tasks only — checkpoint pending): 2026-07-13*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/clinica/crc/nps/page.tsx
- FOUND: src/components/crc/NpsScoreCard.tsx
- FOUND: src/components/crc/DetractorAlertBanner.tsx
- FOUND: src/components/crc/NpsResponsesTable.tsx
- FOUND: src/components/crc/NpsFilters.tsx
- FOUND: src/app/nps/[patient-id]/[token]/page.tsx
- FOUND: src/components/crc/NpsPublicForm.tsx
- FOUND commit: 4b90dc3
- FOUND commit: 8a9bbe2
