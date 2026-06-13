---
phase: 06-ux-polish-and-app-shell
verified: 2026-06-13T00:24:37Z
status: human_needed
score: 10/12
overrides_applied: 0
gaps:
  - truth: "Every authenticated page module uses only design tokens — no raw slate/gray/white/zinc classes that break dark mode"
    status: partial
    reason: "InviteForm.tsx (used on authenticated /clinica/equipe page) still uses extensive raw slate-700/slate-200/bg-white classes throughout form labels, inputs, and selects. AgendaCalendar.tsx line 53 uses bg-gray-100/text-gray-600/border-gray-400 for the 'concluido' calendar event status. InviteAcceptForm.tsx (public invite flow) uses slate-700/slate-200/bg-slate-50."
    artifacts:
      - path: "src/components/invitations/InviteForm.tsx"
        issue: "Lines 71,82,91,98,106,116,121,139,148,154 — raw text-slate-700, border-slate-200, bg-white, text-slate-400, text-slate-500. Breaks dark mode on /clinica/equipe page."
      - path: "src/components/agenda/AgendaCalendar.tsx"
        issue: "Line 53 — concluido status uses bg-gray-100 text-gray-600 border-l-2 border-gray-400 (not a semantic exception documented in UI-SPEC, will appear washed out in dark mode)."
      - path: "src/app/invite/[token]/InviteAcceptForm.tsx"
        issue: "Lines 52,61,66,74 — text-slate-700, border-slate-200, bg-slate-50, text-slate-500 (public page, lower severity)."
    missing:
      - "Replace InviteForm.tsx raw slate/white classes with text-foreground, text-muted-foreground, border-border, bg-background, bg-card tokens."
      - "Replace AgendaCalendar.tsx 'concluido' status classes with muted token equivalents (e.g. bg-muted text-muted-foreground border-l-2 border-muted-foreground/40)."
      - "Replace InviteAcceptForm.tsx raw slate classes with design tokens (lower priority — public page)."
human_verification:
  - test: "Theme toggle: switch light <-> dark, reload browser"
    expected: "No white flash on page load (FOUC). Theme persists correctly. Sidebar, all pages, and the equipe page InviteForm should look correct in dark mode once raw-token gap above is resolved."
    why_human: "FOUC can only be confirmed visually in a real browser; no automated check can test hydration timing."
  - test: "Sidebar navigation and collapse"
    expected: "Sidebar collapses to 56px icon rail; labels disappear; tooltips appear on hover; hamburger/drawer opens on mobile breakpoint."
    why_human: "Interaction, animation, and responsive layout require browser testing."
  - test: "Brand feel in both themes"
    expected: "Light theme is clinical (legible, no harsh neon). Dark theme expresses FYNXIA brand: cyan nav accent, gradient on sidebar header chip, magenta/purple as secondary. FYNXIA logo legible in both themes (dark-chip wrapper in light mode)."
    why_human: "Brand quality is a design judgment — no automated assertion covers brand 'feel'."
  - test: "Dark mode legibility on dense tables/forms"
    expected: "contas-a-receber, prontuario, and agenda (in dark theme) render text as high-contrast on dark surfaces. No invisible-on-dark-background text."
    why_human: "Visual ergonomics review."
  - test: "Per-module empty states, loading skeletons, and error retry"
    expected: "Loading skeleton mimics real layout. Empty state shows icon + CTA. Error page shows 'Algo deu errado' with 'Tentar novamente'."
    why_human: "Skeleton visual fidelity and overall UX polish require browser walkthrough."
---

# Phase 06: UX Polish & App Shell — Verification Report

**Phase Goal:** Elevate the v1 UI to a clear, navigable, production-grade experience aligned to the FYNXIA brand — without new features. Dual-theme, persistent sidebar, PageHeader on every page, per-module sweep on tokens/typography/states.
**Verified:** 2026-06-13T00:24:37Z
**Status:** human_needed (10/12 truths verified; 5 items need browser UAT; 1 partial gap on raw token residue)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Light `:root` has `--primary: hsl(185 100% 26%)` — exact AA value | VERIFIED | `globals.css:59` |
| 2 | `.dark` has full brand token set (navy background, neon cyan primary, magenta secondary) | VERIFIED | `globals.css:88-134` |
| 3 | `layout.tsx` wires Space Grotesk + Inter via next/font, `lang="pt-BR"`, `suppressHydrationWarning`, ThemeProvider | VERIFIED | `layout.tsx:1-50` |
| 4 | ThemeProvider uses `attribute="class"`, `defaultTheme="light"`, `storageKey="fynxia-theme"` | VERIFIED | `ThemeProvider.tsx:9-14` |
| 5 | `clinica/layout.tsx` mounts AppSidebar (not passthrough) + CopilotTrigger preserved | VERIFIED | `clinica/layout.tsx:7-20` |
| 6 | AppSidebar: role-gated nav (Equipe admin-only), logo, SidebarFooter with ThemeToggle + Sair | VERIFIED | `AppSidebar.tsx:29-65` |
| 7 | PageHeader component exists (title + breadcrumbs + actions) and is adopted on all key module pages | VERIFIED | `PageHeader.tsx:14-74`; confirmed on equipe, pacientes, financeiro/*, ia/agentes, agenda, clinica hub |
| 8 | `loading.tsx` (layout-mimicking skeletons) and `error.tsx` (ErrorState wrapper with retry) exist for all key routes | VERIFIED | 8 loading.tsx + 6 error.tsx files found; all use skeleton primitives or ErrorState |
| 9 | EmptyState primitive exists and is adopted on zero-data screens | VERIFIED | `EmptyState.tsx`; used on equipe, agentes, pacientes, fluxo-de-caixa, contas-a-receber |
| 10 | Authenticated clinica pages use only design tokens — no raw slate/gray/white/zinc | PARTIAL | clinica `app/**` pages: CLEAN. `components/invitations/InviteForm.tsx` (mounted on /clinica/equipe) still uses `text-slate-700`, `border-slate-200`, `bg-white`. `AgendaCalendar.tsx` line 53 uses `bg-gray-100 text-gray-600`. |
| 11 | Typography: 2-weight system (400/600), no font-medium, Space Grotesk headings, max text-2xl | VERIFIED | All 11 audited page files pass `typography.test.ts` 44/44. Auth forms, hub, equipe page, financeiro pages confirmed clean. |
| 12 | Gates: vitest 125/125 GREEN, tsc --noEmit exit 0, next build clean | VERIFIED | All three gates pass — confirmed by direct execution |

**Score:** 10/12 truths verified (T-10 partial, T-12 human-needed items)

---

### Deferred Items

None — all phase decisions were implemented within this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/globals.css` | Dual-theme HSL tokens, `--primary: hsl(185 100% 26%)` in `:root` | VERIFIED | Lines 51-134 |
| `src/app/layout.tsx` | Space Grotesk + Inter + ThemeProvider + lang pt-BR + suppressHydrationWarning | VERIFIED | Lines 1-50 |
| `src/components/providers/ThemeProvider.tsx` | next-themes wrapper, attribute=class, storageKey | VERIFIED | Lines 1-19 |
| `src/app/(dashboard)/clinica/layout.tsx` | AppSidebar + AppShellClient + CopilotTrigger | VERIFIED | Lines 1-20 |
| `src/components/shell/AppSidebar.tsx` | Server Component, role-gate, logo, nav, SidebarFooter | VERIFIED | Lines 1-76 |
| `src/components/shell/SidebarNavClient.tsx` | 'use client', usePathname, active state, @base-ui Tooltip | VERIFIED | Lines 1-83 |
| `src/components/shell/SidebarFooter.tsx` | ThemeToggle + Sair form, clinic/user identity | VERIFIED | Lines 1-77 |
| `src/components/shell/ThemeToggle.tsx` | 'use client', useTheme, mounted guard | VERIFIED | Lines 1-37 |
| `src/hooks/useSidebarStore.ts` | Zustand, isCollapsed, toggle | VERIFIED | Lines 1-11 |
| `src/components/shell/PageHeader.tsx` | title + breadcrumbs + actions props, Space Grotesk h1 | VERIFIED | Lines 14-74 |
| `src/components/shell/EmptyState.tsx` | LucideIcon + title + description + cta | VERIFIED | Lines 1-29 |
| `src/components/shell/ErrorState.tsx` | 'use client', h2 focus-on-mount, static copy, retry button | VERIFIED | Lines 1-40 |
| `src/components/shell/skeletons.tsx` | 6 building blocks (PageHeaderSkeleton, TableRowsSkeleton, etc.) | VERIFIED | File exists with full implementations |
| `public/fynxia-logo.png` | Logo deployed to public/ | VERIFIED | Confirmed in public/ directory |
| Loading/error files (8 loading.tsx, 6 error.tsx) | Key routes covered | VERIFIED | All 14 files exist |
| `src/components/invitations/InviteForm.tsx` | Token-clean (no raw slate/gray/white) | STUB | Lines 71,82,91,98,106,116,121,139,148,154 use raw slate-700, slate-200, bg-white |
| `src/components/agenda/AgendaCalendar.tsx` | Token-clean for status colors | PARTIAL | Line 53 concluido status uses bg-gray-100/text-gray-600/border-gray-400 |
| `src/app/invite/[token]/InviteAcceptForm.tsx` | Token-clean (public page) | PARTIAL | Lines 52,61,66,74 use raw slate-*/bg-slate-50 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `clinica/layout.tsx` | `AppSidebar` | import + JSX | WIRED | Confirmed in layout.tsx line 7, 14 |
| `clinica/layout.tsx` | `CopilotTrigger` | import + JSX | WIRED | Line 9, 17 — preserved from Phase 5 |
| `AppSidebar` | Supabase server | `createClient()` for role + clinic | WIRED | Lines 14-27; reads user role + clinic name server-side |
| `AppSidebar` | role-gated nav | `isAdmin` conditional spread | WIRED | Lines 29, 35 |
| `SidebarFooter` | `ThemeToggle` | import + render | WIRED | Lines 4, 60 |
| `SidebarFooter` | `signOut` action | form action | WIRED | Lines 3, 61 |
| `layout.tsx` | `ThemeProvider` | import + wrap | WIRED | Lines 3, 46 |
| `PageHeader` | shadcn Breadcrumb | import + render | WIRED | Lines 5-12, 37-58 |
| `equipe/page.tsx` | `PageHeader` | import + JSX | WIRED | Lines 7, 62-68 |
| `equipe/page.tsx` | `InviteForm` (raw-token) | import + JSX | WIRED but TAINTED | InviteForm renders with raw slate tokens |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AppSidebar.tsx` | `role`, `clinicName`, `userEmail` | Supabase server queries (users + clinics tables) | Yes — live RLS-scoped | FLOWING |
| `clinica/page.tsx` hub | stat card counts | `supabase.from(...).select('*', {count: 'exact'})` (3 queries) | Yes — live RLS-scoped counts | FLOWING |
| `equipe/page.tsx` | `pendingInvites` | `supabase.from('invitations').select(...).eq('status','pending')` | Yes | FLOWING |
| `fluxo-de-caixa/page.tsx` | transactions, totals | `listTransactions(currentMonth)` server action | Yes | FLOWING |
| `contas-a-receber/page.tsx` | receivables | `listReceivables()` server action | Yes | FLOWING |
| `ia/agentes/page.tsx` | `rows` | `listAgentOutreach()` server action | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest UI suite 125/125 | `npx vitest run src/__tests__/ui/` | 125 passed (5 files) | PASS |
| TypeScript type-check | `npx tsc --noEmit` | Exit 0 (no output) | PASS |
| Next.js build | `npx next build` | 29 routes compiled, 0 errors (1 workspace root warning only) | PASS |
| Light --primary is hsl(185 100% 26%) | Source inspection globals.css:59 | `--primary: hsl(185 100% 26%)` confirmed | PASS |
| No raw slate/gray in clinica app pages | `grep -r 'bg-slate-\|bg-gray-' src/app/(dashboard)/clinica/**/*.tsx` | No matches | PASS |
| Raw tokens in components (InviteForm) | `grep -r 'text-slate-\|bg-white' src/components/invitations/` | 10+ matches in InviteForm.tsx | FAIL |

---

### Requirements Coverage

This phase did not declare a formal `requirements:` frontmatter field in its plans. Coverage was verified against the D-01..D-04 decisions in `06-CONTEXT.md`:

| Decision | Status | Evidence |
|----------|--------|---------|
| D-01: Dual-theme + fonts + brand tokens | ACHIEVED | globals.css dual-theme, layout.tsx fonts, ThemeProvider |
| D-02: Persistent sidebar with role-gate, collapse, ThemeToggle, Sair | ACHIEVED | AppSidebar + AppShellClient + SidebarFooter + clinica/layout.tsx |
| D-03: PageHeader on all auth pages + loading/error/EmptyState | ACHIEVED | PageHeader adopted on all 10 audited pages; 14 loading/error files |
| D-04: Full screen-by-screen token sweep | PARTIAL | All app-layer pages clean; `InviteForm.tsx` component (equipe) and `AgendaCalendar.tsx` (agenda) retain raw color tokens |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/invitations/InviteForm.tsx` | 71,82,91,98,106,116,121,139,148,154 | `text-slate-700`, `border-slate-200`, `bg-white`, `text-slate-400`, `text-slate-500` | BLOCKER | Rendered on authenticated `/clinica/equipe` page — will show incorrect light colors in dark theme |
| `src/components/agenda/AgendaCalendar.tsx` | 53 | `bg-gray-100 text-gray-600 border-l-2 border-gray-400` (concluido status) | WARNING | Calendar "concluido" event status invisible/unreadable in dark mode |
| `src/app/invite/[token]/InviteAcceptForm.tsx` | 52,61,66,74 | `text-slate-700`, `border-slate-200`, `bg-slate-50`, `text-slate-500` | WARNING | Public page (invite flow) — not a dark-mode app surface but inconsistent |
| `src/components/anamnesis/SignatureCanvas.tsx` | 66 | `bg-white` on canvas container | INFO | Signature canvas on a public page; probably intentional white background |
| `src/components/odontogram/Odontogram.tsx` | 268,302 | `border-gray-400`, `border-gray-300` on legend swatches | INFO | Color legend swatch borders — minor cosmetic; swatches use inline style colors |

---

### Human Verification Required

#### 1. Theme Toggle — No FOUC

**Test:** Load the app in Chrome. Open DevTools (Application > Local Storage — confirm `fynxia-theme` key). Toggle between light and dark in the sidebar footer. Reload the page multiple times in each theme.
**Expected:** No white flash on initial load. Theme class applied before first paint. Sidebar, all content areas, and the equipe InviteForm (once fixed) render correctly in dark.
**Why human:** FOUC is a timing phenomenon between HTML parse and CSS-in-JS execution — cannot be automated without a headless browser with paint timing APIs.

#### 2. Sidebar Collapse + Mobile Drawer

**Test:** On desktop, click the collapse button (PanelLeftClose). Verify sidebar shrinks to icon rail (56px). Hover nav items — confirm tooltips appear. Expand back. Resize window to < 768px (mobile) — confirm sidebar hides and MobileMenuTrigger hamburger appears. Click hamburger — confirm Sheet drawer opens with full nav.
**Expected:** Width transition is smooth. Icons remain centered at 56px. Drawer closes on nav click.
**Why human:** Visual layout and interaction require browser rendering.

#### 3. Brand Feel (Both Themes)

**Test:** Navigate to `/clinica` in light theme. Inspect the sidebar header (FYNXIA chip should have dark navy background for logo legibility). Switch to dark theme. Confirm: sidebar header area shows gradient/brand treatment; nav active item uses cyan; CTA buttons use brand cyan; magenta/purple used sparingly.
**Expected:** Light theme is clean and clinical (no harsh neon). Dark theme expresses FYNXIA brand clearly.
**Why human:** Brand quality judgment — no automated assertion captures design intent.

#### 4. Dark Mode — Dense Tables/Forms

**Test:** In dark mode, navigate to Contas a Receber, Prontuário (patient detail), and Agenda.
**Expected:** Table rows, form labels, and calendar events render legible on dark backgrounds. No invisible text or washed-out elements (except the known `concluido` status gap which should be fixed).
**Why human:** Visual ergonomics review across multiple pages.

#### 5. Empty State / Loading / Error States in Browser

**Test:** On a fresh clinic with no data, navigate to: Pacientes, Fluxo de Caixa, Contas a Receber, IA/Agentes. Simulate slow connection to trigger loading.tsx. Introduce a network error to trigger error.tsx.
**Expected:** Loading skeleton mimics real page layout. Empty state shows Lucide icon + title + description + optional CTA. Error page shows AlertTriangle + "Algo deu errado" + "Tentar novamente" button that reloads the segment.
**Why human:** Requires real browser + network conditions to trigger loading/error states.

---

### Gaps Summary

**1 partial gap blocking full D-04 achievement:**

The screen-by-screen sweep successfully cleaned all authenticated *page* files (`src/app/(dashboard)/clinica/**/*.tsx`) of raw slate/gray/white/zinc tokens. However, two **component** files used on authenticated pages were not swept:

- `src/components/invitations/InviteForm.tsx` (mounted on `/clinica/equipe` — admin-only section) uses 10+ raw `text-slate-700`, `border-slate-200`, `bg-white` classes. In dark theme, form labels will render dark-on-dark (invisible).
- `src/components/agenda/AgendaCalendar.tsx` line 53: the "concluido" appointment status uses `bg-gray-100 text-gray-600` — will be unreadable in dark mode on the calendar.

These are genuine regressions from the D-04 goal. The phase's own test suite (`typography.test.ts`) did not audit these component paths — only page files were in scope for automated checks.

**Recommended fix:** Single targeted commit replacing raw slate/gray tokens in both files with design system equivalents.

---

_Verified: 2026-06-13T00:24:37Z_
_Verifier: Claude (gsd-verifier)_
