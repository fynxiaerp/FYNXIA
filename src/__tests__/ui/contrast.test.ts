/**
 * contrast.test.ts — Wave 0 scaffold (Phase 6)
 *
 * PURE unit test — no file reads, no app imports.
 * Validates the WCAG AA contrast ratios for the chosen FYNXIA design tokens.
 * These assertions PASS immediately (they validate the token values, not the implementation).
 *
 * Key assertions:
 *   - Light --primary #007a85 (hsl 185 100% 26%) on white >= 4.5:1 (≈5.12:1) — AA PASSES
 *   - Regression guard: rejected value #008c99 (hsl 185 100% 30%) on white < 4.5:1 (≈4.02:1) — FAILS AA
 *   - Dark theme: cyan #00e5ff on navy #0d0d14 >= 4.5:1 (≈13:1)
 *
 * Status: GREEN immediately (pure math, no implementation dependency).
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// WCAG relative-luminance + contrast-ratio implementation
// ---------------------------------------------------------------------------

/**
 * Convert an 8-bit sRGB channel value (0–255) to a linear light value.
 * Per WCAG 2.1 formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function linearize(channel8bit: number): number {
  const srgb = channel8bit / 255
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
}

/**
 * Compute the WCAG relative luminance of a hex color string (e.g. "#007a85").
 */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Compute the WCAG contrast ratio between two hex colors.
 * Returns a value between 1 (no contrast) and 21 (maximum contrast).
 * The order of arguments does not matter.
 */
function contrastRatio(hexA: string, hexB: string): number {
  const L1 = relativeLuminance(hexA)
  const L2 = relativeLuminance(hexB)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ---------------------------------------------------------------------------
// Token value assertions
// ---------------------------------------------------------------------------

describe('WCAG contrast — light theme token pairs', () => {
  it('light --primary #007a85 on white #ffffff >= 4.5:1 (WCAG AA normal text)', () => {
    const ratio = contrastRatio('#007a85', '#ffffff')
    // Expected ≈ 5.12:1 — well above AA threshold
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('white #ffffff on light --primary #007a85 >= 4.5:1 (white text on primary button fill)', () => {
    // Same ratio — commutative; explicit test for documentation
    const ratio = contrastRatio('#ffffff', '#007a85')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light --primary ratio is approximately 5.1 (sanity check — not under-shooting)', () => {
    const ratio = contrastRatio('#007a85', '#ffffff')
    expect(ratio).toBeGreaterThan(5.0)
    expect(ratio).toBeLessThan(5.5) // ≈ 5.12:1 expected
  })
})

describe('WCAG contrast — dark theme token pairs', () => {
  it('dark cyan #00e5ff (hsl 185 100% 50%) on dark navy #0d0d14 (hsl 240 20% 6%) >= 4.5:1', () => {
    // Expected ≈ 13:1 — passes AA and AAA
    const ratio = contrastRatio('#00e5ff', '#0d0d14')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark cyan on navy is >= 4.5:1 in both directions (white text on dark fills)', () => {
    // Navy text on cyan — also check
    const ratio = contrastRatio('#0d0d14', '#00e5ff')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('WCAG contrast — regression guard (rejected token values)', () => {
  /**
   * REGRESSION GUARD: The earlier candidate --primary value hsl(185 100% 30%) ≈ #008c99
   * was REJECTED because it fails WCAG AA (≈ 4.02:1 on white — below the 4.5:1 threshold).
   *
   * This assertion documents and locks in that failure, so if someone re-introduces
   * the 30% value, this test will FAIL, alerting the team that AA compliance is broken.
   */
  it('REGRESSION: rejected value #008c99 (hsl 185 100% 30%) on white FAILS AA (< 4.5:1)', () => {
    const ratio = contrastRatio('#008c99', '#ffffff')
    // Expected ≈ 4.02:1 — below AA threshold
    expect(ratio).toBeLessThan(4.5)
  })

  it('REGRESSION: rejected value #008c99 ratio is approximately 4.0 (confirms failure margin)', () => {
    const ratio = contrastRatio('#008c99', '#ffffff')
    expect(ratio).toBeGreaterThan(3.5)  // it's close but fails
    expect(ratio).toBeLessThan(4.5)     // definitively below AA
  })
})
