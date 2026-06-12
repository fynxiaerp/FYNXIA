/**
 * shell.test.ts — Wave 0 scaffold (Phase 6)
 *
 * Source-inspection test: asserts that the app shell components exist and
 * contain the required structural contracts per 06-UI-SPEC.md.
 * Uses readFileSync + toMatch — NEVER imports app modules.
 *
 * Status: RED-by-design until 06-03 builds the shell components.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function read(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

function fileExists(rel: string): boolean {
  return existsSync(resolve(process.cwd(), rel))
}

// ---------------------------------------------------------------------------
// clinica/layout.tsx — shell upgrade assertions
// ---------------------------------------------------------------------------

describe('clinica/layout.tsx — must mount AppSidebar (not a bare passthrough)', () => {
  const layout = read('src/app/(dashboard)/clinica/layout.tsx')

  it('imports AppSidebar', () => {
    expect(layout).toMatch(/AppSidebar/)
  })

  it('is not a bare fragment-only passthrough (must do more than <>children</>)', () => {
    // The old passthrough body is just: return (<>{children}<CopilotTrigger /></>)
    // After Phase 6 it must include AppSidebar — so we assert AppSidebar is referenced
    // (redundant with above but makes the intent explicit)
    expect(layout).toMatch(/AppSidebar/)
  })

  it('wraps content in a flex container (shell layout)', () => {
    // The spec requires: <div className="flex h-screen overflow-hidden">
    expect(layout).toMatch(/flex/)
  })
})

// ---------------------------------------------------------------------------
// AppSidebar component assertions
// ---------------------------------------------------------------------------

describe('AppSidebar.tsx — exists and contains required shell structure', () => {
  const sidebar = read('src/components/shell/AppSidebar.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/shell/AppSidebar.tsx')).toBe(true)
  })

  it('contains role-gate for admin role', () => {
    expect(sidebar).toMatch(/admin/)
  })

  it('contains nav label "Agenda"', () => {
    expect(sidebar).toMatch(/Agenda/)
  })

  it('contains nav label "Pacientes"', () => {
    expect(sidebar).toMatch(/Pacientes/)
  })

  it('contains nav label "Financeiro"', () => {
    expect(sidebar).toMatch(/Financeiro/)
  })

  it('contains nav label "Equipe"', () => {
    expect(sidebar).toMatch(/Equipe/)
  })

  it('contains nav label "IA" (for IA / Agentes module)', () => {
    expect(sidebar).toMatch(/IA/)
  })

  it('references SidebarFooter', () => {
    expect(sidebar).toMatch(/SidebarFooter/)
  })

  it('references ThemeToggle', () => {
    expect(sidebar).toMatch(/ThemeToggle/)
  })

  it('contains "Sair" (sign-out button label)', () => {
    expect(sidebar).toMatch(/Sair/)
  })
})

// ---------------------------------------------------------------------------
// SidebarNavClient — client component with pathname-based active state
// ---------------------------------------------------------------------------

describe('SidebarNavClient.tsx — exists and uses usePathname', () => {
  const navClient = read('src/components/shell/SidebarNavClient.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/shell/SidebarNavClient.tsx')).toBe(true)
  })

  it('references usePathname (for active item detection)', () => {
    expect(navClient).toMatch(/usePathname/)
  })

  it("has 'use client' directive", () => {
    expect(navClient).toMatch(/'use client'/)
  })
})

// ---------------------------------------------------------------------------
// ThemeToggle — client component using next-themes
// ---------------------------------------------------------------------------

describe('ThemeToggle.tsx — exists with correct structure', () => {
  const toggle = read('src/components/shell/ThemeToggle.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/shell/ThemeToggle.tsx')).toBe(true)
  })

  it("has 'use client' directive", () => {
    expect(toggle).toMatch(/'use client'/)
  })

  it('uses useTheme from next-themes', () => {
    expect(toggle).toMatch(/useTheme/)
  })

  it('imports from next-themes', () => {
    expect(toggle).toMatch(/next-themes/)
  })
})

// ---------------------------------------------------------------------------
// ThemeProvider — wraps next-themes
// ---------------------------------------------------------------------------

describe('ThemeProvider.tsx — exists and references next-themes', () => {
  const provider = read('src/components/providers/ThemeProvider.tsx')

  it('file exists', () => {
    expect(fileExists('src/components/providers/ThemeProvider.tsx')).toBe(true)
  })

  it('imports from next-themes', () => {
    expect(provider).toMatch(/next-themes/)
  })
})

// ---------------------------------------------------------------------------
// useSidebarStore — Zustand store for collapse state
// ---------------------------------------------------------------------------

describe('useSidebarStore.ts — exists and uses Zustand with isCollapsed', () => {
  const store = read('src/hooks/useSidebarStore.ts')

  it('file exists', () => {
    expect(fileExists('src/hooks/useSidebarStore.ts')).toBe(true)
  })

  it('imports from zustand (create function)', () => {
    expect(store).toMatch(/zustand/)
  })

  it('defines create (Zustand store factory)', () => {
    expect(store).toMatch(/create/)
  })

  it('has isCollapsed state', () => {
    expect(store).toMatch(/isCollapsed/)
  })
})
