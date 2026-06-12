# Phase 6: UX Polish & App Shell — Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router / Tailwind v4 / shadcn dual-theme shell + screen-wide UI polish
**Confidence:** HIGH (core stack decisions), MEDIUM (shadcn sidebar Tailwind v4 edge), HIGH (contrast)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Tema & Marca**
- Dual-theme: light clinical (default) + dark/neon brand (toggle persistente)
- Marca FYNXIA: accent cyan `185 100% 50%`, secundário magenta `300 100% 60%`, accent roxo `250 100% 65%`/purple `270 100% 60%`; fundo dark-navy `240 20% 6%`
- Gradiente/glow apenas em destaques (sidebar header, login, CTAs primários); nunca em superfícies densas
- Fontes: Space Grotesk (headings) + Inter (corpo/UI) via Google Fonts (next/font)
- Logo: `.firecrawl/fynxia-logo.png` → `public/`
- `--radius: .75rem`

**D-02 — App Shell / Navegação**
- Sidebar fixa esquerda (~240px), colapsável para rail de ícones/drawer mobile
- Conteúdo: logo, links role-gated, footer com clínica/usuário + toggle de tema + Sair
- CopilotTrigger permanece como FAB independente
- `clinica/layout.tsx` monta o shell

**D-03 — Padrão de Página & Estados**
- `PageHeader` compartilhado em toda página autenticada (título + breadcrumb + slot de ações)
- `loading.tsx` por rota com skeletons que imitam o layout real
- Empty states: ícone lucide + título + mensagem + CTA
- `error.tsx` amigável com retry

**D-04 — Escopo**
- Varredura completa tela-a-tela: auth, hub, agenda, pacientes, financeiro, copiloto, equipe, IA/agentes, páginas públicas
- Equipe page: reescrita completa nos tokens
- Múltiplos planos/ondas

### Claude's Discretion

- Estrutura exata dos componentes do shell (`AppSidebar`, `SidebarNav`, `ThemeToggle`), `PageHeader`, skeletons
- Escala tipográfica refinada (tamanhos/pesos) dentro do contrato Space Grotesk/Inter
- Como derivar versão da logo legível em ambos os temas
- Densidade exata das tabelas; microinterações/transições
- Mecanismo de tema (next-themes vs cookie + classe) — escolher o que integra melhor

### Deferred Ideas (OUT OF SCOPE)

- Microanimações elaboradas / motion design avançado
- Ilustrações customizadas para empty states (usar ícones lucide)
- Tema de alto contraste / acessibilidade AAA
- Landing/marketing dentro do app
</user_constraints>

---

## Summary

Phase 6 is a project-wide design-system upgrade for FYNXIA ERP: dual-theme token migration (globals.css), persistent sidebar shell (AppSidebar mounting in clinica/layout.tsx), font replacement (Geist → Space Grotesk + Inter), shared PageHeader/loading/error/empty-state patterns, and a screen-by-screen sweep of every authenticated and public page.

The current state: no ThemeProvider is mounted, no `next-themes` is installed, globals.css uses oklch grayscale tokens (no brand colours, no sidebar tokens), layout.tsx loads Geist fonts with no CSS variable declared for headings. The clinica/layout.tsx is a passthrough fragment. No `loading.tsx` or `error.tsx` files exist anywhere. The shadcn sidebar component is not yet installed.

The primary planning constraint is **sequencing**: tokens and shell must land before per-page polish; `npx tsc --noEmit` and `npx next build` must stay green between waves. A confirmed WCAG AA issue in the UI-SPEC token table is flagged and must be resolved before globals.css is committed.

**Primary recommendation:** Install `next-themes` (0.4.6, React 19 peer-dep confirmed), wire `ThemeProvider` in root layout, replace globals.css token block with the dual-theme HSL tables from 06-UI-SPEC, install shadcn sidebar, build the shell, then sweep pages top-down. The hand-rolled sidebar approach (Sheet + Zustand) is viable but requires more custom CSS; shadcn sidebar with the Tailwind v4 CSS variable workaround is preferable.

---

## Project Constraints (from CLAUDE.md)

| Directive | Implication for Phase 6 |
|-----------|------------------------|
| shadcn first, `@base-ui/react` only when shadcn has no equivalent | Use `npx shadcn add sidebar`, `dropdown-menu`, `avatar`. Do NOT use `@base-ui` for sidebar primitives. |
| `@base-ui/react` is render-prop, no `asChild` | `button.tsx` stays as-is; new components don't use `asChild` on any `@base-ui` primitive. |
| Tailwind v4 with `@theme inline` block | Token mapping stays in `@theme inline`; no `tailwind.config.ts`. |
| nuqs for URL state; Zustand for client UI state | Sidebar collapse state → Zustand (`useSidebarStore`). Theme toggle → next-themes. |
| No DB migrations in this phase | Zero `supabase db push`, zero schema changes. |
| `npm run build` before deploying; Vitest/tsc don't catch `use server` errors | Build must remain green per wave. |
| LGPD / RLS — no new data surfaces | Phase 6 is frontend only; no new API routes or server actions that touch data. |
| `pt-BR` copy throughout | All new copy in Brazilian Portuguese. |

---

## Standard Stack

### Core

| Library | Installed Version | Purpose | Status |
|---------|-------------------|---------|--------|
| `next` | 16.2.7 [VERIFIED: package.json] | App framework | Already installed |
| `react` | 19.2.4 [VERIFIED: package.json] | UI runtime | Already installed |
| `tailwindcss` | ^4 [VERIFIED: package.json] | Styling | Already installed |
| `shadcn` CLI | ^4.10.0 [VERIFIED: package.json] | Component install | Already installed |
| `zustand` | ^5.0.14 [VERIFIED: package.json] | Sidebar collapse state | Already installed |
| `lucide-react` | ^1.17.0 [VERIFIED: package.json] | Icons | Already installed |
| `next-themes` | NOT INSTALLED [VERIFIED: package.json] | Dual-theme toggle | **Must install** |

### New shadcn Components to Install

| Component | Command | Status |
|-----------|---------|--------|
| Sidebar | `npx shadcn@latest add sidebar` | Not installed [VERIFIED: src/components/ui/] |
| DropdownMenu | `npx shadcn@latest add dropdown-menu` | Not installed [VERIFIED: src/components/ui/] |
| Avatar | `npx shadcn@latest add avatar` | Not installed [VERIFIED: src/components/ui/] |

### Already Installed shadcn Components (reuse)

`button`, `input`, `label`, `textarea`, `select`, `badge`, `card`, `table`, `separator`, `alert`, `skeleton`, `dialog`, `tabs`, `popover`, `tooltip`, `breadcrumb`, `form`, `calendar`, `checkbox`, `switch`, `accordion`, `scroll-area`, `sheet`

All confirmed present in `src/components/ui/`. [VERIFIED: file listing]

### Installation

```bash
npm install next-themes
npx shadcn@latest add sidebar
npx shadcn@latest add dropdown-menu
npx shadcn@latest add avatar
```

**Version verification:**
```bash
npm view next-themes version        # 0.4.6 [VERIFIED: npm view]
npm view next-themes peerDependencies  # react: "^16.8 || ^17 || ^18 || ^19 || ^19.0.0-rc" [VERIFIED: npm view]
```

`next-themes` 0.4.6 officially supports React 19.2.4 — no `--legacy-peer-deps` flag needed. [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended Component Structure

```
src/
├── components/
│   ├── shell/
│   │   ├── AppSidebar.tsx        (Server Component — reads role+clinic)
│   │   ├── SidebarNavClient.tsx  ('use client' — usePathname for active state)
│   │   ├── SidebarHeader.tsx     (logo chip + collapse toggle)
│   │   ├── SidebarFooter.tsx     (clinic/user + ThemeToggle + Sair)
│   │   └── ThemeToggle.tsx       ('use client' — useTheme())
│   │   └── PageHeader.tsx        (Server Component — title+breadcrumbs+actions)
│   └── providers/
│       └── ThemeProvider.tsx     ('use client' — wraps next-themes ThemeProvider)
└── hooks/
    └── useSidebarStore.ts        (Zustand — isCollapsed toggle)
```

### Pattern 1: next-themes Dual-Theme Setup (no FOUC)

**What:** `next-themes` injects a blocking script before page paint that reads localStorage and sets the `dark` class on `<html>` before hydration. Combined with `suppressHydrationWarning` on `<html>`, this produces zero flash on production builds.

**Why next-themes over cookie+SSR approach:** The cookie approach requires a server action or middleware to read the cookie and set the class in the RSC render — more moving parts, same end result. `next-themes` is the community standard and the UI-SPEC already specifies it. [CITED: github.com/pacocoursey/next-themes]

**Root layout pattern:**

```tsx
// src/app/layout.tsx
import { Inter, Space_Grotesk } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '600'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

**ThemeProvider wrapper:**

```tsx
// src/components/providers/ThemeProvider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="fynxia-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
```

**Key props:**
- `attribute="class"` — adds/removes `.dark` on `<html>`. Must match Tailwind v4's `@custom-variant dark (&:is(.dark *))`.
- `defaultTheme="light"` — clinical default per D-01.
- `enableSystem={false}` — explicit toggle only; no OS preference override.
- `storageKey="fynxia-theme"` — avoids conflicts with other projects.

[CITED: github.com/pacocoursey/next-themes, iifx.dev article on Tailwind v4 class-based dark mode]

**Tailwind v4 @custom-variant alignment:**

The existing `globals.css` already has:
```css
@custom-variant dark (&:is(.dark *));
```
[VERIFIED: src/app/globals.css line 5]

The selector `(&:is(.dark *))` applies dark styles when `.dark` is an ancestor. `next-themes` with `attribute="class"` sets `.dark` on `<html>`, making all descendants match. These two are correctly aligned — **no change needed to the custom-variant line**.

[CITED: iifx.dev/en/articles/456423217, tailwindcss.com/docs/dark-mode]

---

### Pattern 2: Tailwind v4 @theme inline Token Migration

**What:** Replace the current grayscale oklch token block in globals.css with brand-aware HSL tokens for both `:root` (light) and `.dark`. The `@theme inline` block maps CSS variables to Tailwind utilities.

**Current state in globals.css:** Tokens use `oklch(...)` grayscale values (no brand colours). The sidebar tokens exist but point to generic values. The `@theme inline` block uses `--font-sans: var(--font-sans)` (self-referential — broken for headings). [VERIFIED: src/app/globals.css]

**Required changes:**

1. In `@theme inline`, add `--font-display: var(--font-space-grotesk)` and update `--font-sans: var(--font-inter)`.
2. Replace entire `:root` block with light clinical HSL tokens from 06-UI-SPEC.
3. Replace entire `.dark` block with dark brand HSL tokens from 06-UI-SPEC.
4. Add `@layer base` rules for heading font family and skip-to-content link.

**Critical:** The `@theme inline` block maps CSS custom properties → Tailwind color utilities. For example, `--color-primary: var(--primary)` enables `bg-primary`, `text-primary`, `border-primary`. The sidebar token names (`--color-sidebar`, `--color-sidebar-foreground`, etc.) must also be in `@theme inline` to work as utility classes. These already exist in the current file. [VERIFIED: src/app/globals.css lines 12-19]

[CITED: ui.shadcn.com/docs/tailwind-v4]

---

### Pattern 3: App Shell Layout

**Current state:** `clinica/layout.tsx` is a fragment passthrough that only mounts `CopilotTrigger`. [VERIFIED: src/app/(dashboard)/clinica/layout.tsx]

**Target state (per 06-UI-SPEC):**

```tsx
// src/app/(dashboard)/clinica/layout.tsx
import { AppSidebar } from '@/components/shell/AppSidebar'
import { CopilotTrigger } from '@/components/copilot/CopilotTrigger'

export default function ClinicaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 ml-[240px] lg:ml-[240px] transition-[margin] duration-200">
        {children}
      </div>
      <CopilotTrigger />
    </div>
  )
}
```

**AppSidebar is a Server Component** — reads Supabase session/role server-side. The `SidebarNavClient` sub-component is `'use client'` for `usePathname()`. This split avoids a waterfall while keeping active-state detection on the client.

---

### Pattern 4: Sidebar Collapse via Zustand (not shadcn SidebarProvider)

**Context:** The shadcn sidebar component's `SidebarProvider` uses a cookie-based collapse state by default. However, per CLAUDE.md, Zustand is the standard for client UI state. The UI-SPEC explicitly states: "Collapse state persisted in Zustand (no localStorage — resets on page load is acceptable; sidebar always opens expanded)."

**Recommendation:** Use Zustand `useSidebarStore` for collapse state, **not** shadcn's built-in `SidebarProvider` cookie mechanism. The shadcn sidebar primitives (SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton) are still used for the interior structure.

**Why skip SidebarProvider:** SidebarProvider wraps the entire layout with a complex context and expects `SidebarInset` for the content area. This conflicts with the custom `ml-[240px]` margin approach in the shell layout and the Tailwind v4 CSS variable width issue (see Pitfall 1).

```tsx
// src/hooks/useSidebarStore.ts
import { create } from 'zustand'

interface SidebarStore {
  isCollapsed: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
}))
```

---

### Pattern 5: Font Migration (Geist → Space Grotesk + Inter)

**Current state:** layout.tsx loads `Geist` and `Geist_Mono` with variables `--font-geist-sans` and `--font-geist-mono`. [VERIFIED: src/app/layout.tsx]

**Target:** Replace Geist with Inter + Space Grotesk. Keep `Geist_Mono` for `--font-geist-mono` (used in `@theme inline` for monospace — low risk to keep).

**next/font pattern for Tailwind v4:**

```tsx
import { Inter, Space_Grotesk } from 'next/font/google'

const inter = Inter({
  variable: '--font-inter',  // consumed by @theme inline --font-sans
  subsets: ['latin'],
  weight: ['400', '600'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',  // consumed by @theme inline --font-display
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})
```

Add both variables to `<html className>`:
```tsx
<html className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}>
```

In `globals.css @theme inline`:
```css
--font-sans: var(--font-inter);
--font-display: var(--font-space-grotesk);
--font-mono: var(--font-geist-mono);
```

In `globals.css @layer base`:
```css
h1, h2, h3, h4, h5, h6, .font-display {
  font-family: var(--font-display), sans-serif;
}
```

[CITED: medium.com/@divineosehotue - Using Custom Fonts in Next.js + Tailwind CSS V4, nextjs.org/docs/app/building-your-application/optimizing/fonts]

---

### Pattern 6: loading.tsx / error.tsx Route Segments

**What:** Next.js App Router wraps each `loading.tsx` in a `<Suspense>` boundary automatically. Server Components that fetch data will stream — the loading UI appears instantly, then the actual content replaces it.

**error.tsx** must be a `'use client'` component (receives `reset: () => void` from the error boundary).

**Key rule:** Skeleton components in `loading.tsx` must mimic the real page layout — not generic bars. This prevents layout shift when the real content arrives. Use `<Skeleton className="animate-pulse bg-muted rounded-md" />` (shadcn Skeleton, already installed).

[CITED: nextjs.org/docs/app/api-reference/file-conventions/loading, nextjs.org/docs/app/getting-started/error-handling]

---

### Anti-Patterns to Avoid

- **Applying `.dark` class to `<body>` instead of `<html>`:** The `@custom-variant dark (&:is(.dark *))` selector checks ancestors — if `.dark` is on `<html>`, the `<body>` and all descendants match correctly. If placed on `<body>`, some portal elements (dialogs, dropdowns) that render outside body may not match. Always set `attribute="class"` on next-themes (sets `<html>`).
- **Using `enableSystem={true}`:** Clinical ERP: default is explicitly light. System theme would override D-01 intent. Set `enableSystem={false}`.
- **Using HSL values without `hsl()` wrapper in CSS:** In Tailwind v4's `@theme inline`, use `var(--token)` references that resolve to `hsl(...)`. The `:root` block should store values with the `hsl()` wrapper already included (e.g., `--primary: hsl(185 100% 26%)`), not bare HSL components. Note: the current globals.css uses `oklch(...)` format — the replacement must use `hsl(...)`.
- **Using `w-[--sidebar-width]` syntax:** In Tailwind v4, bracket notation for CSS variables changed. Use `w-[var(--sidebar-width)]` or define the width as a direct CSS property in the sidebar component styles. (See Pitfall 1.)
- **Storing form state in Zustand:** Only sidebar collapse goes in Zustand per CLAUDE.md. Theme state is in next-themes/localStorage.
- **Using `font-medium` (500):** Not in the 2-weight system. Replace with `font-semibold` (labels/headers) or `font-normal` (body).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence + FOUC prevention | Custom cookie middleware + class injection | `next-themes` 0.4.6 | Handles blocking script injection, SSR, localStorage, system preference |
| Dark mode toggle logic | useLocalStorage + manual class toggle | `next-themes` `useTheme()` | Handles hydration, server/client sync, storageKey isolation |
| Sidebar sub-component structure | Raw divs with manual a11y | `shadcn add sidebar` primitives | Ships with correct ARIA roles, keyboard nav, screen reader support |
| Breadcrumb a11y | Custom `<nav>` | shadcn `Breadcrumb` (already installed) | Correct `<nav aria-label>`, `aria-current`, separator pattern |
| Font loading optimisation | Manual `<link rel=preload>` | `next/font/google` | Automatic size-adjust, font-display:swap, self-hosted at build time |
| Skeleton loading | Custom pulse divs | shadcn `Skeleton` (already installed) | Consistent `animate-pulse bg-muted rounded-md` pattern |

**Key insight:** The entire theme system and sidebar structure can be assembled from existing packages in ~2 hours. Building either from scratch would take a week and miss edge cases (hydration, a11y, keyboard focus trap in mobile drawer).

---

## Critical Token Issue: --primary HSL Value Discrepancy

**Finding:** The 06-UI-SPEC Color Token Table states `--primary: hsl(185 100% 30%)` with approx hex `#007a85`. These two values are inconsistent.

**Verified calculation:** [VERIFIED: node.js contrast calculation]

| Lightness | Actual Hex | Contrast vs white |
|-----------|-----------|-------------------|
| 26% | `#007a85` | 5.12:1 — PASS WCAG AA |
| 27% | `#007e8a` | 4.82:1 — PASS WCAG AA |
| 28% | `#00838f` | 4.53:1 — PASS WCAG AA |
| 30% | `#008c99` | 4.02:1 — **FAIL WCAG AA** |

The stated hex `#007a85` corresponds to `hsl(185 100% 26%)`, not 30%. The 30% value (`#008c99`) fails WCAG AA 4.5:1 for normal text.

**Recommendation for globals.css executor:** Use `hsl(185 100% 26%)` (or 27-28% for slightly more lenient target) as `--primary` in the light theme, not 30%. The hex `#007a85` stated in the UI-SPEC is the correct target — match the hex, not the lightness percentage.

The dark theme `--primary: hsl(185 100% 50%)` vs dark background `hsl(240 20% 6%)` yields 13.15:1 — well above WCAG AA. [VERIFIED: node.js contrast calculation]

---

## Common Pitfalls

### Pitfall 1: shadcn Sidebar + Tailwind v4 CSS Variable Width Bug

**What goes wrong:** `npx shadcn@latest add sidebar` installs a `sidebar.tsx` that uses `w-(--sidebar-width)` or `w-[--sidebar-width]` syntax. In Tailwind v4, arbitrary CSS variable shorthand in bracket notation changed — the component may render with zero width or fail to transition.

**Root cause:** shadcn maintains two registries (v3 and v4). The CLI may download from the wrong registry. GitHub issues #8242 and #8447 both document this problem as open/closed-without-fix. [CITED: github.com/shadcn-ui/ui/issues/8242, #8447]

**How to avoid:**
1. After `npx shadcn@latest add sidebar`, inspect `src/components/ui/sidebar.tsx` for any `w-(--sidebar-width)` or `w-[--sidebar-width]` occurrences.
2. Replace with `w-[var(--sidebar-width)]` and `w-[var(--sidebar-width-icon)]`.
3. Alternatively: the AppSidebar in this phase uses a custom fixed layout (`w-[240px]` / `w-[56px]`) via Zustand state rather than shadcn's built-in `--sidebar-width` variable. This sidesteps the bug entirely.

**Warning signs:** Sidebar renders but has zero width or doesn't animate on collapse.

---

### Pitfall 2: FOUC in Next.js Dev Mode

**What goes wrong:** In development (`npm run dev`), the theme class may flash on every hot-reload. Users may think the theme system is broken.

**Why it happens:** `next-themes` blocking script runs before page load in production builds. In dev mode, the hot-reload path bypasses this.

**How to avoid:** Accept dev-mode flash as expected. Only test FOUC correctness with `npm run build && npm run start`. [CITED: github.com/pacocoursey/next-themes README]

---

### Pitfall 3: `@theme inline` Missing `--font-display` Entry

**What goes wrong:** If `--font-display` is not added to the `@theme inline` block, the Tailwind utility class `font-display` will not be generated. All `font-display` class usages in PageHeader, auth pages, and sidebar footer will silently fall through to `font-sans`.

**How to avoid:** Add `--font-display: var(--font-space-grotesk)` to the `@theme inline` block alongside `--font-sans`.

**Warning signs:** `h1` with `font-display` class looks identical to body text.

---

### Pitfall 4: AppSidebar Server Component + `usePathname` Conflict

**What goes wrong:** `usePathname()` is a React hook — it cannot be called in a Server Component. If AppSidebar is written as a Server Component and tries to use `usePathname`, the build will throw.

**How to avoid:** Split into:
- `AppSidebar.tsx` — Server Component; reads Supabase session/role; passes `role` as prop to `SidebarNavClient`.
- `SidebarNavClient.tsx` — `'use client'`; receives nav items as prop; calls `usePathname()` for active detection.

[CITED: nextjs.org/docs/app/building-your-application/rendering/composition-patterns]

---

### Pitfall 5: `ml-[240px]` Content Area on Collapsed Sidebar

**What goes wrong:** If the main content area always has `ml-[240px]` (even when sidebar is collapsed to 56px), there will be a 184px gap on the left.

**How to avoid:** The sidebar collapse state in Zustand must drive both:
1. Sidebar width transition (`w-[240px]` → `w-[56px]`)
2. Content margin transition (`ml-[240px]` → `ml-[56px]`)

Both transitions use `transition-[width,margin] duration-200`. To share state between the Server Component layout and the client sidebar, make the layout render a client wrapper component that handles the `ml` logic.

**Alternative pattern:** Use a CSS custom property (`--sidebar-current-width`) updated by the Zustand subscriber, then use `ml-[var(--sidebar-current-width)]`. Simpler if the client root component writes the CSS var on state change.

---

### Pitfall 6: ThemeToggle Must Not Render on Server

**What goes wrong:** `useTheme()` from next-themes throws if called in a Server Component or during SSR before hydration. The toggle button must be a `'use client'` component.

**How to avoid:** `ThemeToggle.tsx` must have `'use client'` directive. Use the `mounted` pattern to avoid hydration mismatch on the button icon:

```tsx
'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-8 w-8" />  // placeholder
  // ... render Sun/Moon button
}
```

[CITED: github.com/pacocoursey/next-themes — "Avoid hydration mismatch"]

---

### Pitfall 7: Build Failure During Screen-by-Screen Sweep

**What goes wrong:** Renaming `font-bold` to `font-semibold` across 20+ files is a grep-replace that can accidentally hit shadcn component internals or Tailwind config.

**How to avoid:**
- Scope replacements to `src/app/**` and `src/components/**` only.
- Exclude `src/components/ui/**` (shadcn generated files — don't touch).
- Run `npx tsc --noEmit` after each wave.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### ThemeToggle Component (with mounted guard)

```tsx
// src/components/shell/ThemeToggle.tsx
'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8 rounded-md" aria-hidden />

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-8 w-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center transition-colors"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
```

### PageHeader Component

```tsx
// src/components/shell/PageHeader.tsx
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

interface PageHeaderProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="h-16 px-6 border-b border-border bg-background flex items-center justify-between shrink-0">
      <div className="flex flex-col gap-0.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-xl font-semibold font-display leading-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
```

### Sidebar Nav Active Item Detection

```tsx
// src/components/shell/SidebarNavClient.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem { href: string; label: string; icon: React.ElementType }

export function SidebarNavClient({ items, isCollapsed }: { items: NavItem[]; isCollapsed: boolean }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'h-10 flex items-center gap-3 rounded-md px-3 transition-colors text-sm font-semibold',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isCollapsed && 'justify-center px-0'
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {!isCollapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
```

### Error Boundary (error.tsx)

```tsx
// e.g. src/app/(dashboard)/clinica/pacientes/error.tsx
'use client'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold font-display">Algo deu errado</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-themes` React 18 only | 0.4.6 adds `^19 \|\| ^19.0.0-rc` to peerDeps | March 2025 | No `--legacy-peer-deps` needed |
| shadcn `style: "default"` | `style: "base-nova"` — new in 2025 | 2025 | Different component file structure; no `asChild` |
| Tailwind v3 `tailwind.config.ts` | Tailwind v4 `globals.css @theme inline` | Jan 2025 | No config file; all tokens in CSS |
| `oklch()` shadcn default tokens | Project uses `oklch` but UI-SPEC targets `hsl()` | Phase 6 | Must migrate `:root/.dark` to HSL |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Already using `@supabase/ssr` — no change |
| `forwardRef` in shadcn components | Removed; `data-slot` attribute pattern | 2025 | Components already in this style; no impact |

**Deprecated/outdated in this project's context:**
- Geist font: replaced by Space Grotesk + Inter per D-01. The `--font-geist-sans` variable and `Geist` import are eliminated from layout.tsx.
- `oklch` grayscale tokens: replaced by HSL brand tokens. The current token values produce zero brand expression — they are neutral shadcn defaults.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | `npm install`, `next build` | ✓ | [project uses Next 16] | — |
| `next-themes` | ThemeProvider | ✗ | — | None — must install |
| shadcn sidebar | AppSidebar | ✗ | — | Hand-roll with Sheet + Zustand (more work) |
| shadcn dropdown-menu | SidebarFooter user menu | ✗ | — | None — install required |
| shadcn avatar | SidebarFooter user chip | ✗ | — | Use initials div instead |
| `fynxia-logo.png` | SidebarHeader | ✓ | `.firecrawl/fynxia-logo.png` [VERIFIED: CONTEXT.md D-01] | Text wordmark only |
| Vitest | Test suite | ✓ | ^4.1.8 [VERIFIED: package.json] | — |

**Missing dependencies with no fallback:** `next-themes` (must install). Without it, theme toggle requires a custom implementation that is harder to get right for SSR.

**Missing dependencies with fallback:** `avatar` shadcn component (initials chip via `div` is viable). Sidebar component (hand-roll using Sheet — more work but doable).

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — section required. [VERIFIED: .planning/config.json]

Phase 6 is primarily UI: visual correctness is human-UAT (browser, both themes). Automated validation covers structural correctness and source inspection.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (already configured) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npm run test` (runs `vitest run`) |
| Full suite command | `npm run test` |
| Type check command | `npx tsc --noEmit` |
| Build check command | `npm run build` |

### Phase Requirements → Test Map

Phase 6 has no discrete functional requirement IDs (UI polish phase). Validation is structural:

| Concern | Behavior | Test Type | Command | Notes |
|---------|----------|-----------|---------|-------|
| Token presence | `:root` contains `--primary: hsl(185 100% 26%)` and `.dark` section exists | Source inspection (grep) | `grep -c "hsl(185" src/app/globals.css` | Manual visual + grep |
| Both themes declared | globals.css has both `:root` and `.dark` blocks with required tokens | Source inspection | `grep -c "\-\-sidebar" src/app/globals.css` | >= 16 matches |
| Font vars wired | layout.tsx imports Space_Grotesk with `variable: '--font-space-grotesk'` | Source inspection | `grep "font-space-grotesk" src/app/layout.tsx` | |
| ThemeProvider mounted | layout.tsx wraps children in ThemeProvider | Source inspection | `grep "ThemeProvider" src/app/layout.tsx` | |
| suppressHydrationWarning | `<html>` has the prop | Source inspection | `grep "suppressHydrationWarning" src/app/layout.tsx` | |
| AppSidebar mounted | clinica/layout.tsx imports AppSidebar | Source inspection | `grep "AppSidebar" src/app/(dashboard)/clinica/layout.tsx` | |
| PageHeader used on pages | At least one page per module has PageHeader | Source inspection | `grep -r "PageHeader" src/app/(dashboard)/clinica/` | |
| No raw slate/gray classes | Equipe + invite pages use tokens | Source inspection | `grep -r "text-slate\|bg-gray\|text-gray\|bg-white" src/app/(dashboard)/clinica/equipe/` | Zero results = pass |
| Type safety | No TypeScript errors | `npx tsc --noEmit` | Required per CLAUDE.md |
| Build green | Production build succeeds | `npm run build` | Required before deploy |
| Contrast ratio (manual) | `--primary` in light theme >= 4.5:1 on white | Manual browser check + calculation | Node.js script in Pitfalls section | hsl(185 100% 26%) = 5.12:1 confirmed |
| Theme toggle (manual) | Click Sun/Moon → class toggles on `<html>` | Human-UAT | Browser DevTools | |
| FOUC (manual) | Production build: no flash on first load | Human-UAT | `npm run build && npm run start` in incognito | dev mode flash is acceptable |
| Mobile sidebar drawer (manual) | <768px: hamburger opens Sheet | Human-UAT | Browser mobile viewport | |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build` (catches `use server` errors that tsc misses, per CLAUDE.md)
- **Phase gate:** `npm run build` green + full vitest suite green + human-UAT of both themes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/providers/ThemeProvider.tsx` — must be created (Wave 0)
- [ ] `src/components/shell/AppSidebar.tsx` — must be created (Wave 0)
- [ ] `src/components/shell/SidebarNavClient.tsx` — must be created (Wave 0)
- [ ] `src/components/shell/PageHeader.tsx` — must be created (Wave 0)
- [ ] `src/components/shell/ThemeToggle.tsx` — must be created (Wave 0)
- [ ] `src/hooks/useSidebarStore.ts` — must be created (Wave 0)
- [ ] `src/app/(dashboard)/clinica/*/loading.tsx` — 8+ files, all Wave 0 gaps
- [ ] `src/app/(dashboard)/clinica/*/error.tsx` — 8+ files, all Wave 0 gaps
- [ ] `next-themes` install — Wave 0 prerequisite
- [ ] shadcn sidebar/dropdown-menu/avatar install — Wave 0 prerequisite

---

## Security Domain

`security_enforcement` is not explicitly `false` in `.planning/config.json` — section required.

Phase 6 is frontend styling only. No new API routes, no new server actions, no new data access patterns.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows |
| V3 Session Management | No | No session changes |
| V4 Access Control | Partial | AppSidebar must continue to role-gate nav items (Equipe: admin only). Pattern unchanged from clinica/page.tsx. |
| V5 Input Validation | No | No new form inputs |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for Shell UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side role check only | Elevation of privilege | NavItem visibility is UI-only. The actual routes must remain protected by Supabase RLS + server-side role checks (already implemented in prior phases). Phase 6 does NOT change this. |
| ThemeToggle XSS | Tampering | `next-themes` uses localStorage (not innerHTML injection). No XSS surface. |
| Logo asset path disclosure | Info disclosure | Logo moved to `public/` — intentionally public. No sensitive data. |

**LGPD note:** No new data is displayed in the shell. The sidebar footer shows user email (already visible post-auth) and clinic name (already visible on hub page). No new PII surface.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fynxia-logo.png` exists at `.firecrawl/fynxia-logo.png` | Architecture — SidebarHeader | Logo not available; fallback is text wordmark "F" monogram chip. Low risk. |
| A2 | shadcn `add sidebar` with `base-nova` style produces a sidebar.tsx compatible with Tailwind v4 after the `w-[var(--sidebar-width)]` fix | Standard Stack | If the CLI downloads v3 registry, additional token wiring may be needed. Workaround: use custom fixed-width sidebar layout (avoids the issue entirely). |
| A3 | The `Space_Grotesk` identifier works in `next/font/google` import (underscore, not hyphen) | Pattern 5 | Build error at font import. If wrong, use `Space_Grotesk` (confirmed naming from Next.js font docs). [ASSUMED] |

---

## Open Questions

1. **Sidebar: shadcn SidebarProvider vs. custom layout**
   - What we know: shadcn sidebar has a Tailwind v4 CSS variable width bug; the custom layout (`ml-[240px]` via Zustand) sidesteps it.
   - What's unclear: Whether the bug is fixed in the current shadcn CLI version for `base-nova` style projects.
   - Recommendation: Use the shadcn sidebar's interior primitives (SidebarMenu, SidebarMenuItem, etc.) for structure and a11y, but skip SidebarProvider and use a custom layout with Zustand. Verify after `npx shadcn add sidebar` by checking the generated sidebar.tsx for the `w-[--sidebar-width]` pattern.

2. **`--primary` lightness for globals.css**
   - What we know: hsl(185 100% 26%) = #007a85 = 5.12:1 AA pass. hsl(185 100% 30%) = #008c99 = 4.02:1 AA fail.
   - What's unclear: Whether the UI-SPEC intended the hex (#007a85) or the lightness (30%). The hex is the safer target.
   - Recommendation: Use `hsl(185 100% 26%)` to match the stated hex. Document this as a UI-SPEC correction.

3. **Mobile sidebar trigger placement**
   - What we know: The UI-SPEC says hamburger appears in PageHeader `<md`.
   - What's unclear: PageHeader is a Server Component — the hamburger must trigger a client-side Sheet. This requires PageHeader to accept a slot for a `MobileMenuTrigger` ('use client') component.
   - Recommendation: Add an `mobileMenuTrigger?: React.ReactNode` prop to PageHeader, rendered on the left at `md:hidden`. Each page passes `<MobileMenuTrigger />`.

---

## Sources

### Primary (HIGH confidence)
- `src/app/globals.css` — current token state (oklch grayscale, no brand colours)
- `src/app/layout.tsx` — current font setup (Geist only, no ThemeProvider)
- `package.json` — installed versions confirmed
- `npm view next-themes version` + `peerDependencies` — 0.4.6, React 19 confirmed
- `node.js contrast calculation` — contrast ratios verified algorithmically

### Secondary (MEDIUM confidence)
- [github.com/pacocoursey/next-themes](https://github.com/pacocoursey/next-themes) — ThemeProvider API, FOUC prevention, suppressHydrationWarning
- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 support, @theme directive
- [ui.shadcn.com/docs/components/sidebar](https://ui.shadcn.com/docs/components/sidebar) — sidebar sub-components, CSS variables
- [iifx.dev — Enabling Class-Based Dark Mode with Next 15 + next-themes + Tailwind 4](https://iifx.dev/en/articles/456423217/solved-enabling-class-based-dark-mode-with-next-15-next-themes-and-tailwind-4)
- [medium.com - Using Custom Fonts in Next.js + Tailwind CSS V4](https://medium.com/@divineosehotue/using-custom-fonts-in-next-js-tailwind-css-v4-a37057b18f7f)
- [nextjs.org/docs/app/api-reference/file-conventions/loading](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [nextjs.org/docs/app/getting-started/error-handling](https://nextjs.org/docs/app/getting-started/error-handling)

### Tertiary (LOW confidence — verified by cross-reference)
- [github.com/shadcn-ui/ui/issues/8242](https://github.com/shadcn-ui/ui/issues/8242) — sidebar CSS variable syntax bug in Tailwind v4
- [github.com/shadcn-ui/ui/issues/8447](https://github.com/shadcn-ui/ui/issues/8447) — sidebar overlapping content in Tailwind v4
- [github.com/shadcn-ui/ui/pull/8253](https://github.com/shadcn-ui/ui/pull/8253) — fix PR (unclear if merged)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry and package.json
- Theme mechanism: HIGH — next-themes API verified, React 19 peer deps confirmed
- Token migration pattern: HIGH — Tailwind v4 docs + existing globals.css structure examined
- Sidebar implementation: MEDIUM — known Tailwind v4 CSS variable bug; workaround documented
- Contrast ratios: HIGH — algorithmically verified
- Font wiring: HIGH — next/font pattern is stable, confirmed by official docs

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable libraries; shadcn sidebar Tailwind v4 fix may arrive sooner)
