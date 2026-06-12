---
phase: 6
slug: ux-polish-and-app-shell
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract. This is a UI/design phase — most correctness is structural (source-inspection) + build-green; true visual/theme correctness is human-UAT in the browser.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3s |

Test style: **source-inspection** (readFileSync + toMatch) — assert that token files, layout, shell, PageHeader, fonts, and theme provider contain the required contracts. Plus `npx tsc --noEmit` and **`npx next build`** (the real gate for a UI phase — catches client/server boundary + import errors). A small pure **contrast** unit test verifies the key token pairs ≥ AA.

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build` (must stay green — sequencing depends on it)
- **Before `/gsd-verify-work`:** full suite GREEN + next build clean + manual theme/visual UAT in browser
- **Max feedback latency:** ~10s (unit) / build ~30-60s

---

## Per-Task Verification Map

> Populated by the planner. UI phase — automated checks are source-inspection + build; visuals are UAT.

| Task | Wave | Concern | Test Type | Automated Command |
|------|------|---------|-----------|-------------------|
| Wave 0 scaffolds | 0 | contracts exist (RED) | scaffold | `npx vitest run src/__tests__/ui/` |
| tokens + fonts | 1 | globals.css has :root + .dark token sets; layout wires Space Grotesk + Inter + ThemeProvider + lang pt-BR | source-inspect + contrast | `npx vitest run src/__tests__/ui/theme.test.ts && npx tsc --noEmit` |
| app shell | 1 | clinica/layout.tsx mounts AppSidebar (logo + role-gated nav + footer theme toggle/logout); collapsible | source-inspect | `npx vitest run src/__tests__/ui/shell.test.ts && npx next build` |
| PageHeader + states | 1 | PageHeader component (title+breadcrumb+actions); loading/error/empty primitives | source-inspect | `npx vitest run src/__tests__/ui/page-pattern.test.ts && npx next build` |
| per-module sweep | 2+ | each page adopts PageHeader + tokens; equipe rewritten on tokens; no raw slate/gray; no font-bold/medium off-contract | source-inspect | `npx vitest run src/__tests__/ui/ && npx tsc --noEmit && npx next build` |

---

## Wave 0 Requirements

- [ ] `src/__tests__/ui/theme.test.ts` — globals.css contains both `:root` and `.dark` token blocks with `--primary`, `--background`, `--sidebar*`; light `--primary` is `185 100% 26%` (the AA value, not 30%/38%/50%); layout.tsx wires `next-themes` ThemeProvider + `suppressHydrationWarning` + `lang="pt-BR"` + Space Grotesk + Inter via next/font.
- [ ] `src/__tests__/ui/contrast.test.ts` — pure contrast fn asserts light `--primary` (#007a85) on white ≥ 4.5:1 AA; white on light `--primary` ≥ 4.5:1; dark theme key pairs ≥ AA.
- [ ] `src/__tests__/ui/shell.test.ts` — clinica/layout.tsx renders AppSidebar (not passthrough); AppSidebar source has role-gated nav items, logo, footer with ThemeToggle + Sair; mobile/collapse handling.
- [ ] `src/__tests__/ui/page-pattern.test.ts` — PageHeader component exists (title + breadcrumb + actions slot); a representative set of pages import/use PageHeader; loading.tsx + error.tsx exist for key routes.
- [ ] `src/__tests__/ui/typography.test.ts` — no `font-bold`/`font-medium` in app screens outside the documented brand-wordmark exception; headings use Space Grotesk var; no off-scale text sizes (text-3xl/lg/base) in audited screens.

*vitest already installed — no framework install in Wave 0.*

---

## Manual-Only Verifications (browser UAT)

| Behavior | Why Manual | Test |
|----------|------------|------|
| Theme toggle switches light↔dark with no FOUC, persists across reloads | Visual + hydration | Toggle in sidebar; reload; confirm no flash and persistence |
| Sidebar navigation + active state + collapse + mobile drawer | Visual/interaction | Navigate modules; collapse; resize to mobile |
| Brand feel (cyan accent, gradient on brand moments, logo legible in both themes) | Brand judgment | Inspect sidebar header / login / CTAs in both themes |
| Per-module clarity (hierarchy, density, empty/loading/error) across all screens | Visual judgment | Walk each module in both themes |
| Dark theme legibility for dense tables/forms | Ergonomics | Open contas-a-receber / prontuário in dark |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
