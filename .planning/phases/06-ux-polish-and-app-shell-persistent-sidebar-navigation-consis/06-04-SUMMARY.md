---
phase: "06"
plan: "04"
subsystem: "shell/page-pattern"
tags: ["page-header", "skeleton", "error-boundary", "empty-state", "loading-ui", "a11y"]
dependency_graph:
  requires: ["06-02"]
  provides: ["PageHeader", "EmptyState", "ErrorState", "skeletons toolkit", "loading.tsx per route", "error.tsx per route"]
  affects: ["06-05", "06-06", "06-07", "06-08"]
tech_stack:
  added: []
  patterns:
    - "PageHeader Server Component with breadcrumb + actions + mobileMenuTrigger slots"
    - "MobileMenuTrigger 'use client' hamburger → Sheet drawer"
    - "EmptyState primitive (LucideIcon + title + description + cta)"
    - "ErrorState 'use client' with h2 focus-on-mount for screen reader announcement"
    - "Skeleton building blocks composing shadcn Skeleton (PageHeaderSkeleton, TotalsCardsSkeleton, CardGridSkeleton, TableRowsSkeleton, FilterBarSkeleton, CalendarGridSkeleton)"
    - "layout-mimicking loading.tsx per route segment using skeleton building blocks"
    - "3-line error.tsx wrappers per route segment around ErrorState"
key_files:
  created:
    - src/components/shell/PageHeader.tsx
    - src/components/shell/MobileMenuTrigger.tsx
    - src/components/shell/EmptyState.tsx
    - src/components/shell/ErrorState.tsx
    - src/components/shell/skeletons.tsx
    - src/app/(dashboard)/clinica/pacientes/loading.tsx
    - src/app/(dashboard)/clinica/pacientes/error.tsx
    - src/app/(dashboard)/clinica/agenda/loading.tsx
    - src/app/(dashboard)/clinica/agenda/error.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/error.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-a-receber/loading.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-a-receber/error.tsx
    - src/app/(dashboard)/clinica/equipe/loading.tsx
    - src/app/(dashboard)/clinica/equipe/error.tsx
    - src/app/(dashboard)/clinica/ia/agentes/loading.tsx
    - src/app/(dashboard)/clinica/ia/agentes/error.tsx
  modified:
    - src/app/(dashboard)/clinica/pacientes/page.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
    - src/app/(dashboard)/clinica/equipe/page.tsx
    - src/app/(dashboard)/clinica/ia/agentes/page.tsx
decisions:
  - "PageHeader is a Server Component — mobileMenuTrigger slot lets a 'use client' hamburger live inside it without making the whole header a client component"
  - "ErrorState never renders error.message to the user (T-06-07 static copy only); AlertTriangle is text-muted-foreground not text-primary"
  - "EmptyState icon uses text-muted-foreground per accent reserved list (10% rule)"
  - "Skeleton columns use flex proportions (not fixed px) so they adapt to any container width"
  - "BreadcrumbLink uses @base-ui render prop (render={<Link href=.../>}) matching the no-asChild convention"
  - "equipe page: all slate/gray/white raw classes replaced with bg-card, border-border, text-foreground, text-muted-foreground tokens"
metrics:
  duration_minutes: 5
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_created: 21
  files_modified: 4
---

# Phase 06 Plan 04: Page Pattern Primitives Summary

PageHeader (Server Component, Space Grotesk title + shadcn Breadcrumb + actions + mobile slot), MobileMenuTrigger (client hamburger → Sheet drawer), EmptyState, ErrorState, and a skeletons toolkit of 6 layout-mimicking building blocks — plus loading.tsx + error.tsx for 6 key route segments with representative PageHeader adoption on 4 pages.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | PageHeader + MobileMenuTrigger | `9183f2c` | PageHeader.tsx, MobileMenuTrigger.tsx |
| 2 | EmptyState + ErrorState + skeletons + loading/error per route + PageHeader adoption | `4861beb` | 21 new + 4 modified |

## What Was Built

### PageHeader (`src/components/shell/PageHeader.tsx`)
Server Component. Props: `title`, `breadcrumbs[]`, `actions`, `mobileMenuTrigger`. Uses shadcn `Breadcrumb` primitives with `BreadcrumbLink render={<Link/>}` (no asChild). Title: `text-xl font-semibold font-display`. Container: `h-16 px-6 border-b border-border bg-background`. The `mobileMenuTrigger` slot renders at `md:hidden` so a client hamburger can live inside a Server Component header.

### MobileMenuTrigger (`src/components/shell/MobileMenuTrigger.tsx`)
`'use client'`. Hamburger button (`aria-label="Abrir menu"`, `md:hidden`) that opens a `Sheet` drawer (`side="left"`, `w-[240px]`). Accepts `items: MobileNavItem[]`. Active link detection via `usePathname()`. Active item: `bg-sidebar-primary text-sidebar-primary-foreground`. Closes on nav link click.

### EmptyState (`src/components/shell/EmptyState.tsx`)
Props: `icon: LucideIcon`, `title`, `description`, `cta?`. Icon: `size-10 text-muted-foreground` (not text-primary per accent reserved list). Heading: `text-xl font-semibold font-display`. No `font-medium` or `text-base` (typography audit fix).

### ErrorState (`src/components/shell/ErrorState.tsx`)
`'use client'`. Props: `reset: () => void`. AlertTriangle icon + "Algo deu errado" h2 + static pt-BR body (never renders `error.message`) + "Tentar novamente" Button. `useEffect` focuses h2 on mount for screen reader announcement (06-UI-SPEC a11y line 842).

### skeletons.tsx (`src/components/shell/skeletons.tsx`)
6 exported building blocks using shadcn `Skeleton` (`animate-pulse bg-muted rounded-md`):
- `PageHeaderSkeleton` — h-16 header with breadcrumb + title bars
- `TotalsCardsSkeleton` — 3 cards in sm:grid-cols-3 with min-h-[72px]
- `CardGridSkeleton({ count, columns })` — generic card grid (h-28 cards)
- `TableRowsSkeleton({ rows, columns })` — header + N data rows with proportional column flex
- `FilterBarSkeleton` — search input + filter control
- `CalendarGridSkeleton` — day headers + 12 time rows mimicking FullCalendar

All building blocks carry `aria-busy="true" aria-label="Carregando…"` on the container.

### loading.tsx + error.tsx (6 route segments)
| Route | Skeleton composition |
|-------|---------------------|
| /clinica/pacientes | PageHeaderSkeleton + TableRowsSkeleton(5 rows) |
| /clinica/agenda | PageHeaderSkeleton + CalendarGridSkeleton |
| /clinica/financeiro/fluxo-de-caixa | PageHeaderSkeleton + TotalsCardsSkeleton + TableRowsSkeleton(6 rows) |
| /clinica/financeiro/contas-a-receber | PageHeaderSkeleton + FilterBarSkeleton + TableRowsSkeleton(5 rows) |
| /clinica/equipe | PageHeaderSkeleton + TableRowsSkeleton(3 rows) |
| /clinica/ia/agentes | PageHeaderSkeleton + TableRowsSkeleton(5 rows) |

Each `error.tsx` is a 3-line `'use client'` wrapper around `ErrorState`.

### Representative PageHeader adoption
- `pacientes/page.tsx` — PageHeader with "Clínica > Pacientes" breadcrumb + "Novo Paciente" button action
- `fluxo-de-caixa/page.tsx` — PageHeader with "Financeiro > Fluxo de Caixa" breadcrumb + month nav + Lançamento button actions
- `equipe/page.tsx` — PageHeader with "Clínica > Equipe" breadcrumb; all raw slate/gray/white tokens replaced with design system tokens
- `ia/agentes/page.tsx` — PageHeader with "Clínica > IA > Agentes" breadcrumb

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] equipe page raw color tokens replaced**
- **Found during:** Task 2 (PageHeader adoption on equipe page)
- **Issue:** equipe/page.tsx used `bg-gray-50`, `bg-white`, `border-slate-200`, `text-slate-*` throughout — violating the token-only rule in CLAUDE.md and 06-UI-SPEC "Fix: Equipe & Invite Pages"
- **Fix:** Replaced all raw classes with `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted/40`, `divide-border` — also removed the stale "Fase 2" phase note per audit finding
- **Files modified:** `src/app/(dashboard)/clinica/equipe/page.tsx`
- **Commit:** `4861beb`

**2. [Rule 1 - Bug] fluxo-de-caixa font-medium violation fixed**
- **Found during:** Task 2 (PageHeader adoption on fluxo-de-caixa page)
- **Issue:** Month label span used `font-medium` (500 weight) — prohibited by the 2-weight system (400/600 only)
- **Fix:** Changed `font-medium` → `font-semibold` on the month label
- **Files modified:** `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx`
- **Commit:** `4861beb`

## Known Stubs

None. All primitives are fully implemented. The per-module sweep (Wave 3, plans 06-05..08) will adopt PageHeader on remaining pages not covered here.

## Verification Results

- `npx vitest run src/__tests__/ui/page-pattern.test.ts` — 28/28 PASS
- `npx tsc --noEmit` — exit 0
- `npx next build` — green (29 routes compiled successfully)

## Self-Check: PASSED

Files exist:
- FOUND: src/components/shell/PageHeader.tsx
- FOUND: src/components/shell/MobileMenuTrigger.tsx
- FOUND: src/components/shell/EmptyState.tsx
- FOUND: src/components/shell/ErrorState.tsx
- FOUND: src/components/shell/skeletons.tsx
- FOUND: src/app/(dashboard)/clinica/pacientes/loading.tsx
- FOUND: src/app/(dashboard)/clinica/pacientes/error.tsx
- FOUND: src/app/(dashboard)/clinica/agenda/loading.tsx
- FOUND: src/app/(dashboard)/clinica/agenda/error.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/error.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/contas-a-receber/loading.tsx
- FOUND: src/app/(dashboard)/clinica/financeiro/contas-a-receber/error.tsx
- FOUND: src/app/(dashboard)/clinica/equipe/loading.tsx
- FOUND: src/app/(dashboard)/clinica/equipe/error.tsx
- FOUND: src/app/(dashboard)/clinica/ia/agentes/loading.tsx
- FOUND: src/app/(dashboard)/clinica/ia/agentes/error.tsx

Commits exist:
- FOUND: 9183f2c (Task 1)
- FOUND: 4861beb (Task 2)
