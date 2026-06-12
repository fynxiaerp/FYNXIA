---
phase: 06
plan: 01
subsystem: ui-testing
tags: [wave-0, scaffold, source-inspection, vitest, wcag, typography, theme]
dependency_graph:
  requires: []
  provides:
    - src/__tests__/ui/theme.test.ts
    - src/__tests__/ui/contrast.test.ts
    - src/__tests__/ui/shell.test.ts
    - src/__tests__/ui/page-pattern.test.ts
    - src/__tests__/ui/typography.test.ts
  affects:
    - Phase 6 plans 02-08 (all must satisfy these contracts to turn GREEN)
tech_stack:
  added: []
  patterns:
    - source-inspection (readFileSync + toMatch, no app imports — ES2017-compatible)
    - pure WCAG unit test (linearize + relativeLuminance + contrastRatio)
    - extractBlock helper (replaces regex s-flag for ES2017 target)
key_files:
  created:
    - src/__tests__/ui/theme.test.ts
    - src/__tests__/ui/contrast.test.ts
    - src/__tests__/ui/shell.test.ts
    - src/__tests__/ui/page-pattern.test.ts
    - src/__tests__/ui/typography.test.ts
  modified: []
decisions:
  - "extractBlock() helper replaces regex s-flag patterns (ES2017 tsconfig target does not support s-flag)"
  - "contrast.test.ts is pure math — GREEN immediately; other 4 are RED-by-design against current sources"
metrics:
  duration_minutes: 25
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
---

# Phase 6 Plan 01: Wave 0 Source-Inspection Test Scaffolds — Summary

**One-liner:** 5 source-inspection test scaffolds locking Phase 6 UI contracts (theme tokens, WCAG contrast, app shell structure, PageHeader/loading/error pattern, typography 2-weight system) before any implementation.

---

## What Was Built

### Task 1: theme.test.ts + contrast.test.ts

**`src/__tests__/ui/theme.test.ts`** — source-inspection of `globals.css` and `layout.tsx`:
- Asserts `:root` and `.dark` blocks both exist
- Asserts light `:root` has `--primary: hsl(185 100% 26%)` (not oklch, not 30%/38%)
- Asserts dark `.dark` has `--primary: hsl(185 100% 50%)` (neon cyan)
- Asserts ≥16 `--sidebar` token occurrences (full sidebar token set)
- Asserts `@theme inline` maps `--font-display: var(--font-space-grotesk)` and `--font-sans: var(--font-inter)`
- Asserts `@layer base` maps headings to `--font-display`
- Asserts `layout.tsx` imports `Space_Grotesk` and `Inter` from `next/font/google` with correct `variable:` names
- Asserts `lang="pt-BR"`, `suppressHydrationWarning`, `ThemeProvider` reference in layout.tsx

**`src/__tests__/ui/contrast.test.ts`** — pure WCAG unit test (no file reads, no app imports):
- Implements `linearize()` + `relativeLuminance()` + `contrastRatio()` per WCAG 2.1 spec
- Asserts `#007a85` (hsl 185 100% 26%) on white ≥ 4.5:1 (~5.12:1) — AA PASSES
- Asserts white on `#007a85` ≥ 4.5:1 (white text on primary button fill)
- Asserts dark cyan `#00e5ff` on navy `#0d0d14` ≥ 4.5:1 (~13:1)
- **Regression guard:** asserts `#008c99` (hsl 185 100% 30%) on white < 4.5:1 (~4.02:1) — documents the rejected value that FAILS AA

**Status:** contrast.test.ts GREEN (7/7). theme.test.ts RED-by-design (globals.css still has oklch tokens, layout.tsx still has Geist fonts).

### Task 2: shell.test.ts + page-pattern.test.ts

**`src/__tests__/ui/shell.test.ts`** — source-inspection of shell component files:
- `clinica/layout.tsx` imports `AppSidebar` and is not a bare passthrough
- `AppSidebar.tsx` exists with role-gate (`admin`), nav labels (Agenda/Pacientes/Financeiro/Equipe/IA), `SidebarFooter`, `ThemeToggle`, `Sair`
- `SidebarNavClient.tsx` exists with `'use client'` and `usePathname`
- `ThemeToggle.tsx` exists with `'use client'`, `useTheme`, `next-themes`
- `ThemeProvider.tsx` exists importing `next-themes`
- `useSidebarStore.ts` exists with `zustand`, `create`, `isCollapsed`

**`src/__tests__/ui/page-pattern.test.ts`** — source-inspection of page-level patterns:
- `PageHeader.tsx` exists with `title`, `breadcrumbs`, `actions` props
- 4 representative pages (pacientes, fluxo-de-caixa, equipe, ia/agentes) each import `PageHeader`
- 6 `loading.tsx` files exist for key route segments
- 6 `error.tsx` files exist for same segments
- `EmptyState.tsx` exists with `title`, `description`, icon prop

**Status:** Both RED-by-design. Shell components don't exist yet; pages don't use PageHeader; loading/error files absent.

### Task 3: typography.test.ts

**`src/__tests__/ui/typography.test.ts`** — source-inspection across 11 audited app screens:
- Per file: asserts no `font-medium` (eliminated from 2-weight system)
- Per file: asserts no `text-3xl` (max Display size is `text-2xl`)
- Per file: asserts no `text-lg` (off-scale; use `text-xl`)
- Per file: asserts `font-bold` only paired with `font-display` (brand-wordmark exception only) — implemented via residue algorithm that strips wordmark combos then checks no `font-bold` remains

Audited files: clinica/page.tsx, LoginForm, SignupForm, ForgotPasswordForm, reset-password/page.tsx, equipe/page.tsx, invite/[token]/page.tsx, agendar/[clinic-slug]/page.tsx, anamnese/[patient-id]/[token]/page.tsx, fluxo-de-caixa/page.tsx, contas-a-receber/page.tsx.

**Status:** RED-by-design. 25 violations found in current sources across font-medium, text-3xl, text-lg, and unpaired font-bold.

---

## Verification Results

```
npx vitest run src/__tests__/ui/
  Test Files  4 failed | 1 passed (5)
       Tests  88 failed | 37 passed (125)

  contrast.test.ts  — PASS 7/7  (pure math, GREEN immediately)
  theme.test.ts     — FAIL 13/20 (RED-by-design: oklch tokens, Geist fonts)
  shell.test.ts     — FAIL 27/27+ (RED-by-design: shell not built yet)
  page-pattern.test.ts — FAIL 16/16+ (RED-by-design: PageHeader/loading/error not built)
  typography.test.ts   — FAIL 25/44 (RED-by-design: 25 violations in current sources)

npx tsc --noEmit  — exit 0 (clean)
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ES2017 regex s-flag incompatibility in theme.test.ts**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** TypeScript `target: "ES2017"` in tsconfig.json does not support the regex `s` (dotAll) flag. The initial theme.test.ts draft used `/regex/s` patterns to extract `:root` and `.dark` blocks across newlines.
- **Fix:** Replaced all `s`-flag regex patterns with a dedicated `extractBlock(css, markerRegex)` helper that splits the CSS into lines and collects the block by tracking brace depth. ES2017-compatible, no ts-ignore needed.
- **Files modified:** `src/__tests__/ui/theme.test.ts`
- **Commit:** `9375859`

---

## Threat Flags

None. Test files read only source files already in the repo. No network, no PII, no secrets referenced.

---

## Known Stubs

None. This plan creates only test scaffolds — no UI stubs introduced.

---

## Self-Check: PASSED

Files created:
- `src/__tests__/ui/theme.test.ts` — FOUND
- `src/__tests__/ui/contrast.test.ts` — FOUND
- `src/__tests__/ui/shell.test.ts` — FOUND
- `src/__tests__/ui/page-pattern.test.ts` — FOUND
- `src/__tests__/ui/typography.test.ts` — FOUND

Commits:
- `47f7bc7` — test(06-01): Wave 0 theme + contrast test scaffolds — FOUND
- `9375859` — test(06-01): Wave 0 shell + page-pattern scaffolds; fix theme.test.ts tsc — FOUND
- `67c352f` — test(06-01): Wave 0 typography scaffold — FOUND
