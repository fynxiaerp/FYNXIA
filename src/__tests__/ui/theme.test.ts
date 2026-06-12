/**
 * theme.test.ts — Wave 0 scaffold (Phase 6)
 *
 * Source-inspection test: asserts that globals.css and layout.tsx contain
 * the required Phase 6 theme token contracts. Uses readFileSync + toMatch
 * — NEVER imports app modules — so tsc stays green even while the contracts
 * are unimplemented.
 *
 * Status: RED-by-design until 06-02 implements the token blocks.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function read(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ---------------------------------------------------------------------------
// globals.css assertions
// ---------------------------------------------------------------------------

describe('globals.css — dual-theme token blocks', () => {
  const css = read('src/app/globals.css')

  it('has a :root { block (light theme)', () => {
    expect(css).toMatch(/:root\s*\{/)
  })

  it('has a .dark { block (dark theme)', () => {
    expect(css).toMatch(/\.dark\s*\{/)
  })

  it('light :root declares --primary as hsl(185 100% 26%) — the AA-compliant value', () => {
    // Must contain this exact token
    expect(css).toMatch(/--primary:\s*hsl\(185 100% 26%\)/)
  })

  it('does NOT contain the AA-failing values 30%/38% as --primary in :root', () => {
    // Extract only the :root block to avoid false positives from .dark
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(rootBlock).not.toMatch(/185 100% 30%/)
    expect(rootBlock).not.toMatch(/185 100% 38%/)
  })

  it('light :root does NOT use oklch for --primary (must be hsl)', () => {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? ''
    // Should not have oklch on the primary token line
    const primaryLine = rootBlock.match(/--primary:[^\n;]*/)?.[0] ?? ''
    expect(primaryLine).not.toMatch(/oklch/)
  })

  it('dark .dark block allows hsl(185 100% 50%) for --primary (neon cyan)', () => {
    const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(darkBlock).toMatch(/--primary:\s*hsl\(185 100% 50%\)/)
  })

  it('globals.css declares --background in both :root and .dark', () => {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? ''
    const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(rootBlock).toMatch(/--background:/)
    expect(darkBlock).toMatch(/--background:/)
  })

  it('globals.css declares --foreground in both :root and .dark', () => {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? ''
    const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(rootBlock).toMatch(/--foreground:/)
    expect(darkBlock).toMatch(/--foreground:/)
  })

  it('globals.css declares --card in both :root and .dark', () => {
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? ''
    const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(rootBlock).toMatch(/--card:/)
    expect(darkBlock).toMatch(/--card:/)
  })

  it('globals.css has at least 16 --sidebar token occurrences (full sidebar token set)', () => {
    const count = (css.match(/--sidebar/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(16)
  })

  it('@theme inline maps --font-display to var(--font-space-grotesk)', () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-space-grotesk\)/)
  })

  it('@theme inline maps --font-sans to var(--font-inter)', () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-inter\)/)
  })

  it('@layer base maps h1..h6 or .font-display to --font-display', () => {
    // Either a heading selector or .font-display rule referencing --font-display
    expect(css).toMatch(/h1[\s\S]*?--font-display|\.font-display[\s\S]*?--font-display/)
  })
})

// ---------------------------------------------------------------------------
// layout.tsx assertions
// ---------------------------------------------------------------------------

describe('layout.tsx — font wiring + ThemeProvider + html attributes', () => {
  const layout = read('src/app/layout.tsx')

  it('imports Space_Grotesk from next/font/google', () => {
    expect(layout).toMatch(/Space_Grotesk/)
    expect(layout).toMatch(/next\/font\/google/)
  })

  it('imports Inter from next/font/google', () => {
    expect(layout).toMatch(/Inter/)
    expect(layout).toMatch(/next\/font\/google/)
  })

  it('declares variable: --font-space-grotesk for Space Grotesk', () => {
    expect(layout).toMatch(/variable:\s*['"]--font-space-grotesk['"]/)
  })

  it('declares variable: --font-inter for Inter', () => {
    expect(layout).toMatch(/variable:\s*['"]--font-inter['"]/)
  })

  it('<html> has lang="pt-BR"', () => {
    expect(layout).toMatch(/lang=["']pt-BR["']/)
  })

  it('<html> has suppressHydrationWarning', () => {
    expect(layout).toMatch(/suppressHydrationWarning/)
  })

  it('references ThemeProvider', () => {
    expect(layout).toMatch(/ThemeProvider/)
  })
})
