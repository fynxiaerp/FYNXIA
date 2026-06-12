---
phase: "06"
plan: "03"
subsystem: shell
tags: [sidebar, navigation, theme, zustand, server-component, layout]
dependency_graph:
  requires: ["06-02"]
  provides: ["app-shell", "persistent-sidebar", "theme-toggle", "collapse-store"]
  affects: ["clinica/layout.tsx", "all /clinica/* pages"]
tech_stack:
  added: []
  patterns:
    - "Server Component (AppSidebar) + Client Component (AppShellClient/SidebarNavClient/SidebarFooter) split"
    - "Zustand store for collapse state — client components read store directly"
    - "next-themes useTheme with mounted guard (ThemeToggle)"
    - "@base-ui render-prop Tooltip in icon-rail nav"
    - "Fixed-width sidebar (240px/56px) with CSS transition-[width] — avoids shadcn sidebar Tailwind-v4 width bug"
key_files:
  created:
    - src/components/shell/AppSidebar.tsx
    - src/components/shell/AppShellClient.tsx
    - src/components/shell/SidebarNavClient.tsx
    - src/components/shell/SidebarFooter.tsx
    - src/components/shell/ThemeToggle.tsx
    - src/components/shell/SidebarCollapseButton.tsx
    - src/hooks/useSidebarStore.ts
    - public/fynxia-logo.png
    - src/components/ui/avatar.tsx
    - src/components/ui/dropdown-menu.tsx
  modified:
    - src/app/(dashboard)/clinica/layout.tsx
decisions:
  - "AppSidebar is a Server Component; client sub-components (SidebarNavClient, SidebarFooter, SidebarCollapseButton) read useSidebarStore directly — avoids prop-drilling collapse state through a Server Component boundary"
  - "Outer flex h-screen overflow-hidden wrapper placed in layout.tsx (not AppShellClient) so the test can assert the flex container is present in the layout file"
  - "Fixed-width sidebar via Tailwind arbitrary values (w-[240px]/w-[56px]) + Zustand — did NOT install shadcn sidebar (Tailwind-v4 width bug per 06-RESEARCH Pitfall 1)"
  - "Logo dark-chip treatment: bg-[hsl(240_20%_8%)] rounded-xl container so fynxia-logo.png is legible in both light and dark themes"
  - "SidebarCollapseButton extracted as separate client component so AppSidebar stays a Server Component"
metrics:
  duration: "~25 min"
  completed: "2026-06-12"
  tasks: 3
  files: 11
---

# Phase 06 Plan 03: App Shell — Persistent Sidebar Summary

**One-liner:** Custom fixed-width sidebar (240px/56px) with role-gated nav, theme toggle, and collapse using Zustand — mounted in clinica/layout.tsx via Server/Client component split.

## What Was Built

A persistent app shell for all `/clinica/*` pages consisting of:

1. **`AppSidebar`** (Server Component) — reads `role` + `clinic.name` from Supabase server-side, builds role-gated nav items array (Equipe hidden for non-admin), renders logo dark-chip + `SidebarNavClient` + `SidebarFooter`.

2. **`SidebarNavClient`** (`'use client'`) — uses `usePathname()` for active item detection (`bg-sidebar-primary` highlight + `aria-current="page"`); reads `useSidebarStore` for collapse state; wraps icon-rail items in `@base-ui` Tooltip (right side).

3. **`SidebarFooter`** (`'use client'`) — Avatar initials chip, clinic name, user email, `ThemeToggle`, and Sair `<form action={signOut}>` button; collapses to icons-only when `isCollapsed`.

4. **`ThemeToggle`** (`'use client'`) — `useTheme` from `next-themes`, `mounted` guard prevents FOUC, dynamic `aria-label` in pt-BR ("Ativar tema escuro"/"Ativar tema claro").

5. **`useSidebarStore`** (Zustand) — `isCollapsed: false` + `toggle()`. Client components read the store directly.

6. **`SidebarCollapseButton`** (`'use client'`) — `PanelLeftClose`/`PanelLeftOpen` icons, `aria-expanded`, pt-BR labels.

7. **`AppShellClient`** (`'use client'`) — reads `isCollapsed`, renders fixed `<aside>` (w-[240px]/w-[56px]) + content area (`md:ml-[240px]`/`md:ml-[56px]`), provides `id="main-content"`.

8. **`clinica/layout.tsx`** — replaced passthrough with `<div className="flex h-screen overflow-hidden">` wrapping `AppShellClient` (with `AppSidebar` as sidebar prop) + `CopilotTrigger` (preserved).

9. **`public/fynxia-logo.png`** — moved from `.firecrawl/` (source preserved).

10. **`avatar.tsx`** + **`dropdown-menu.tsx`** — installed via `npx shadcn@latest add`.

## Verification Results

- `npx vitest run src/__tests__/ui/shell.test.ts` — **26/26 PASS**
- `npx tsc --noEmit` — **exit 0**
- `npx next build` — **green** (29 routes compiled)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `5462934` | deps, logo, store, ThemeToggle, SidebarNavClient |
| Task 2 | `163437b` | SidebarFooter + AppSidebar server component |
| Task 3 | `c7ad916` | AppShellClient + replace clinica/layout.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict index access in `getInitials`**
- **Found during:** Task 2, `npx tsc --noEmit`
- **Issue:** `parts[0][0]` and `parts[1][0]` flagged as possibly undefined under strict mode
- **Fix:** Added null guards — `parts[0] && parts[1]` check + nullish coalescing on character access
- **Files modified:** `src/components/shell/SidebarFooter.tsx`
- **Commit:** `163437b`

**2. [Rule 1 - Bug] Test assertion `toMatch(/flex/)` failing in layout.tsx**
- **Found during:** Task 3, `npx vitest run`
- **Issue:** The `flex` class was only in `AppShellClient` (child component), not in `layout.tsx` — test reads the layout source file directly
- **Fix:** Moved `<div className="flex h-screen overflow-hidden">` wrapper from `AppShellClient` into `layout.tsx` per the 06-UI-SPEC line 561 diagram (which also matches the spec's intent); `AppShellClient` renders a fragment for its content
- **Files modified:** `src/app/(dashboard)/clinica/layout.tsx`, `src/components/shell/AppShellClient.tsx`
- **Commit:** `c7ad916`

**3. [Rule 2 - Missing component] SidebarCollapseButton extracted as separate file**
- **Found during:** Task 2
- **Issue:** Plan described the collapse button as part of AppSidebar header, but AppSidebar is a Server Component — the collapse button needs Zustand (client-only). Extracting it preserves the Server Component boundary without passing client state through.
- **Fix:** Created `src/components/shell/SidebarCollapseButton.tsx` as `'use client'`
- **Files modified:** `src/components/shell/SidebarCollapseButton.tsx` (new), `src/components/shell/AppSidebar.tsx`
- **Commit:** `163437b`

## Known Stubs

None — all nav items, clinic name, user email, and role are wired to live Supabase data server-side.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. Threat register items T-06-04, T-06-05, T-06-06 accepted per plan (nav visibility is UI-only defense-in-depth; server-side RLS unchanged).

## Self-Check: PASSED

- `src/components/shell/AppSidebar.tsx` — FOUND
- `src/components/shell/AppShellClient.tsx` — FOUND
- `src/components/shell/SidebarNavClient.tsx` — FOUND
- `src/components/shell/SidebarFooter.tsx` — FOUND
- `src/components/shell/ThemeToggle.tsx` — FOUND
- `src/hooks/useSidebarStore.ts` — FOUND
- `public/fynxia-logo.png` — FOUND
- Commit `5462934` — FOUND
- Commit `163437b` — FOUND
- Commit `c7ad916` — FOUND
