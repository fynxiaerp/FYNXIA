/**
 * DocumentoPDF component — source-inspection test scaffold (RED by design)
 *
 * Reads src/components/pdf/DocumentoPDF.tsx as text and asserts structural
 * contracts. Tests are RED until Plan 02 creates this file.
 *
 * Uses readFileSync (not import) so tsc stays green and tests fail clearly at
 * runtime when the target file is absent.
 *
 * Mirrors the pattern from recibo.test.ts (Phase 3).
 *
 * Phase: 08-documentos-assinatura-icp-brasil / Plan 01 (Wave 0 RED scaffold)
 * DOC-01/02: DocumentoPDF component contract (Flexbox, Font.register, signature block)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DOCUMENTO_PATH = resolve(
  process.cwd(),
  'src/components/pdf/DocumentoPDF.tsx'
)

describe('DocumentoPDF component — src/components/pdf/DocumentoPDF.tsx (DOC-01/02)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    // readFileSync throws clearly if file absent
    expect(() => readFileSync(DOCUMENTO_PATH, 'utf8')).not.toThrow()
  })

  it('exports DocumentoPDF (named export)', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).toMatch(/export.*DocumentoPDF/i)
  })

  it('registers a custom font via Font.register', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).toMatch(/Font\.register/i)
  })

  it('uses Flexbox layout (flexDirection present — @react-pdf/renderer constraint)', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).toMatch(/flexDirection/i)
  })

  it('contains NO CSS Grid (display: grid is unsupported by @react-pdf/renderer)', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).not.toMatch(/display:\s*['"]grid['"]/i)
    expect(src).not.toMatch(/display:\s*'grid'/i)
    expect(src).not.toMatch(/display:\s*"grid"/i)
  })

  it('is NOT a client component (no "use client" directive)', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).not.toMatch(/['"]use client['"]/i)
  })

  it('props include a signatureBlock field (DOC-02 signed document support)', () => {
    const src = readFileSync(DOCUMENTO_PATH, 'utf8')
    expect(src).toMatch(/signatureBlock/i)
  })
})
