/**
 * Phase 12 — clinical-documents.test.ts (RX-01/RX-03 source-inspection scaffold)
 *
 * Source-inspection on:
 *   - src/actions/clinical-documents.ts (issueClinicDocument, signClinicDocument)
 *   - src/components/pdf/ReceituarioPDF.tsx, AtestadoPDF.tsx, ExamePDF.tsx
 *   - src/lib/clinical/doc-number.ts (formatDocNumber — PURE)
 *
 * New-artifact assertions are RED by design (Wave 0):
 *   - SRC() returns '' when file absent → assertions fail on content, NOT on crash.
 *   - Dynamic import of formatDocNumber guarded by existsSync + early return.
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 * D-144/D-161/D-168: dynamic import via resolve(process.cwd(), ...) not @-alias.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 01 (Wave 0 RED scaffold)
 * Requirements: RX-01, RX-03
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'

// Mock server-only so source files importing it load cleanly in Vitest
vi.mock('server-only', () => ({}))

/**
 * SRC(rel): read source file by relative path. Returns '' when missing.
 * Assertion fails on empty content — RED by design, not a crash.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── RX-01 / RX-02: src/actions/clinical-documents.ts source-inspection ─────

describe('Phase 12 action — clinical-documents.ts (RX-01/RX-02/RX-03)', () => {
  const actionSrc = SRC('src/actions/clinical-documents.ts')

  // Security: server action fundamentals
  it('imports createClient from @/lib/supabase/server', () => {
    expect(actionSrc).toMatch(/createClient/)
    expect(actionSrc).toMatch(/@\/lib\/supabase\/server/)
  })

  it('imports createAdminClient for service-role column-REVOKE bypass', () => {
    expect(actionSrc).toMatch(/createAdminClient/)
  })

  it('calls assertNotReadOnly() as write guard (T-12-01)', () => {
    expect(actionSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('calls logBusinessEvent for audit trail', () => {
    expect(actionSrc).toMatch(/logBusinessEvent/)
  })

  it('has role gate restricting to dentist (and admin/superadmin)', () => {
    expect(actionSrc).toMatch(/dentist/)
  })

  // RX-02: allergy check wiring — decrypt server-side, never against ciphertext
  it('imports decrypt from @/lib/crypto (allergy decrypted server-side — T-12-02)', () => {
    expect(actionSrc).toMatch(/decrypt/)
    expect(actionSrc).toMatch(/from '@\/lib\/crypto'/)
  })

  it('references checkMedicationAllergy (calls allergy check before emit)', () => {
    expect(actionSrc).toMatch(/checkMedicationAllergy/)
  })

  // RX-01: atomic sequential numbering via Postgres RPC
  it('references next_doc_number (atomic counter RPC — not MAX+1)', () => {
    expect(actionSrc).toMatch(/next_doc_number/)
  })

  it('calls .rpc( for next_doc_number (atomic Postgres function, not MAX+1)', () => {
    expect(actionSrc).toMatch(/\.rpc\(/)
  })

  it('does NOT use MAX( for doc number computation (race-unsafe pattern forbidden)', () => {
    expect(actionSrc).not.toMatch(/MAX\(/)
  })

  // RX-03: ICP signing reuse
  it('references signPdfBuffer (reuses Phase 8 signing engine)', () => {
    expect(actionSrc).toMatch(/signPdfBuffer/)
  })

  it('imports signPdfBuffer from @/lib/icp/sign-document', () => {
    expect(actionSrc).toMatch(/@\/lib\/icp\/sign-document/)
  })

  // RX-03: immutability race guard (Phase 8 pattern)
  it('has .is("signature", null) atomic guard (T-12-03 re-sign prevention)', () => {
    expect(actionSrc).toMatch(/\.is\('signature', null\)|\.is\("signature", null\)/)
  })

  it('uploads to clinical-documents-pdf bucket', () => {
    expect(actionSrc).toMatch(/clinical-documents-pdf/)
  })

  // RX-03: portal visibility flag
  it('references portal_visible flag (RX-03 patient portal)', () => {
    expect(actionSrc).toMatch(/portal_visible/)
  })

  // Exported functions
  it('exports issueClinicDocument as async function (RX-01)', () => {
    expect(actionSrc).toMatch(/export async function issueClinicDocument/)
  })

  it('exports signClinicDocument as async function (RX-03)', () => {
    expect(actionSrc).toMatch(/export async function signClinicDocument/)
  })
})

// ─── RX-01/RX-03: PDF components source-inspection ──────────────────────────

describe('Phase 12 PDF — ReceituarioPDF.tsx (@react-pdf/renderer, Flexbox-only)', () => {
  const src = SRC('src/components/pdf/ReceituarioPDF.tsx')

  it('imports from @react-pdf/renderer', () => {
    expect(src).toMatch(/@react-pdf\/renderer/)
  })

  it('does NOT use display: grid (Flexbox-only — CLAUDE.md)', () => {
    expect(src).not.toMatch(/display:\s*['"]grid['"]/)
    expect(src).not.toMatch(/display:\s*"grid"/)
  })

  it('references generatedAt for deterministic timestamp (Pitfall 1 prevention)', () => {
    expect(src).toMatch(/generatedAt/)
  })
})

describe('Phase 12 PDF — AtestadoPDF.tsx (@react-pdf/renderer, Flexbox-only)', () => {
  const src = SRC('src/components/pdf/AtestadoPDF.tsx')

  it('imports from @react-pdf/renderer', () => {
    expect(src).toMatch(/@react-pdf\/renderer/)
  })

  it('does NOT use display: grid (Flexbox-only — CLAUDE.md)', () => {
    expect(src).not.toMatch(/display:\s*['"]grid['"]/)
    expect(src).not.toMatch(/display:\s*"grid"/)
  })

  it('references generatedAt for deterministic timestamp (Pitfall 1 prevention)', () => {
    expect(src).toMatch(/generatedAt/)
  })
})

describe('Phase 12 PDF — ExamePDF.tsx (@react-pdf/renderer, Flexbox-only)', () => {
  const src = SRC('src/components/pdf/ExamePDF.tsx')

  it('imports from @react-pdf/renderer', () => {
    expect(src).toMatch(/@react-pdf\/renderer/)
  })

  it('does NOT use display: grid (Flexbox-only — CLAUDE.md)', () => {
    expect(src).not.toMatch(/display:\s*['"]grid['"]/)
    expect(src).not.toMatch(/display:\s*"grid"/)
  })

  it('references generatedAt for deterministic timestamp (Pitfall 1 prevention)', () => {
    expect(src).toMatch(/generatedAt/)
  })
})

// ─── RX-01: formatDocNumber pure-unit (absolute-path dynamic import) ─────────

describe('formatDocNumber — doc_number format by type (RX-01)', () => {
  const docNumberPath = resolve(process.cwd(), 'src/lib/clinical/doc-number.ts')

  it('receita_simples → prefix REC (REC-YYYY-NNNN format)', async () => {
    if (!existsSync(docNumberPath)) return // RED guard — Wave 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ docNumberPath) as any
    const fn = mod.formatDocNumber
    if (!fn) return

    const result = fn('receita_simples', 42, 2026)
    expect(result).toMatch(/^REC-2026-0042$/)
  })

  it('receita_controle_especial → prefix RCC', async () => {
    if (!existsSync(docNumberPath)) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ docNumberPath) as any
    const fn = mod.formatDocNumber
    if (!fn) return

    const result = fn('receita_controle_especial', 7, 2026)
    expect(result).toMatch(/^RCC-2026-0007$/)
  })

  it('atestado → prefix ATE', async () => {
    if (!existsSync(docNumberPath)) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ docNumberPath) as any
    const fn = mod.formatDocNumber
    if (!fn) return

    const result = fn('atestado', 1, 2026)
    expect(result).toMatch(/^ATE-2026-0001$/)
  })

  it('solicitacao_exame → prefix EXM', async () => {
    if (!existsSync(docNumberPath)) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ docNumberPath) as any
    const fn = mod.formatDocNumber
    if (!fn) return

    const result = fn('solicitacao_exame', 100, 2026)
    expect(result).toMatch(/^EXM-2026-0100$/)
  })
})
