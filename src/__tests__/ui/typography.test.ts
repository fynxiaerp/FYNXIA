/**
 * typography.test.ts — Wave 0 scaffold (Phase 6)
 *
 * Source-inspection test: enforces the 2-weight typography system (400/600)
 * across audited app screens. Uses readFileSync + toMatch — NEVER imports
 * app modules — so tsc stays green.
 *
 * Enforced rules per 06-UI-SPEC.md Typography section:
 *   - No `font-medium` anywhere in audited screens
 *   - No `text-3xl` (max Display size is text-2xl)
 *   - No `text-lg` (off-scale; use text-xl for section headings)
 *   - `font-bold` is ONLY allowed on the brand wordmark line (paired with font-display)
 *     — the single brand-wordmark exception documented in the spec
 *
 * Status: RED-by-design until the per-module typography sweep (06-05+) removes violations.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function read(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

/**
 * Audited app screens — per-module pages listed in 06-UI-SPEC Per-Module Design Direction.
 * Note: src/components/ui/** is EXCLUDED (shadcn primitives use their own weight conventions).
 * Note: files that do not exist yet return '' and all assertions trivially pass on '' —
 * this is intentional; they become meaningful once the file is created.
 */
const AUDITED_FILES: Array<{ label: string; path: string }> = [
  // Dashboard hub
  { label: 'clinica hub', path: 'src/app/(dashboard)/clinica/page.tsx' },

  // Auth forms (src/components/auth — not ui/)
  { label: 'LoginForm', path: 'src/components/auth/LoginForm.tsx' },
  { label: 'SignupForm', path: 'src/components/auth/SignupForm.tsx' },
  { label: 'ForgotPasswordForm', path: 'src/components/auth/ForgotPasswordForm.tsx' },

  // Auth pages
  { label: 'reset-password page', path: 'src/app/(auth)/reset-password/page.tsx' },

  // Equipe
  { label: 'equipe page', path: 'src/app/(dashboard)/clinica/equipe/page.tsx' },

  // Invite (public)
  { label: 'invite token page', path: 'src/app/invite/[token]/page.tsx' },

  // Public scheduling + anamnesis
  { label: 'agendar page', path: 'src/app/agendar/[clinic-slug]/page.tsx' },
  { label: 'anamnese page', path: 'src/app/anamnese/[patient-id]/[token]/page.tsx' },

  // Financeiro
  { label: 'fluxo-de-caixa page', path: 'src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx' },
  { label: 'contas-a-receber page', path: 'src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx' },
]

// ---------------------------------------------------------------------------
// Per-file typography assertions
// ---------------------------------------------------------------------------

for (const { label, path } of AUDITED_FILES) {
  describe(`Typography contract — ${label}`, () => {
    const src = read(path)

    /**
     * 2-weight rule: only font-normal (400) and font-semibold (600) are allowed.
     * font-medium (500) is eliminated per the spec.
     */
    it(`no font-medium (spec: eliminated — use font-semibold or font-normal)`, () => {
      expect(src).not.toMatch(/font-medium/)
    })

    /**
     * Type scale rule: max Display size is text-2xl (28px).
     * text-3xl (30px) is off-scale for this ERP UI.
     */
    it(`no text-3xl (spec: max size is text-2xl for Display role)`, () => {
      expect(src).not.toMatch(/text-3xl/)
    })

    /**
     * text-lg (18px) is off-scale. Section headings use text-xl font-semibold (20px).
     * Eliminated per audit findings.
     */
    it(`no text-lg (spec: off-scale — use text-xl for headings, text-sm for body)`, () => {
      expect(src).not.toMatch(/text-lg/)
    })

    /**
     * font-bold (700) is ONLY allowed on the FYNXIA brand wordmark.
     * The wordmark always appears as: font-bold font-display (or font-display font-bold).
     *
     * Algorithm:
     *   1. Remove all occurrences of the brand-wordmark combo from the source.
     *   2. Assert the residue contains no remaining `font-bold`.
     *
     * This ensures font-bold cannot appear anywhere except paired with font-display.
     */
    it(`font-bold only on brand wordmark (paired with font-display — the single allowed exception)`, () => {
      // Remove the brand-wordmark exception patterns from the source
      let residue = src
      // Pattern A: font-bold ... font-display (or font-display ... font-bold) on the same class string
      // We remove "font-bold font-display" and "font-display font-bold" combos (with any chars between)
      residue = residue.replace(/font-bold\s+font-display/g, '')
      residue = residue.replace(/font-display\s+font-bold/g, '')
      // Also remove the reverse ordering as it may appear in different class orderings
      // e.g. "text-2xl font-bold font-display tracking-tight" → remove the bold+display pair
      residue = residue.replace(/font-bold[^"'`\n]*font-display/g, '')
      residue = residue.replace(/font-display[^"'`\n]*font-bold/g, '')

      // After removing all brand-wordmark combos, no font-bold should remain
      expect(residue).not.toMatch(/font-bold/)
    })
  })
}
