/**
 * Phase 3 — ReceiboPDF tests (FIN-08)
 * Test type: source-inspection via existsSync + readFileSync
 *
 * NOTE: Do NOT use renderToBuffer here.
 * ReceiboPDF uses 'use server' / server-only imports — importing it directly in Vitest
 * would throw. Use source inspection per 03-VALIDATION.md note.
 *
 * RED until Plan 04 authors src/components/pdf/ReceiboPDF.tsx.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RECIBO_PATH = resolve(process.cwd(), 'src/components/pdf/ReceiboPDF.tsx')

describe('ReceiboPDF component — src/components/pdf/ReceiboPDF.tsx (FIN-08)', () => {
  it('file exists (fails RED until Plan 04)', () => {
    expect(existsSync(RECIBO_PATH)).toBe(true)
  })

  it('registers a custom font (Font.register) — BRL rendering', () => {
    if (!existsSync(RECIBO_PATH)) {
      expect(existsSync(RECIBO_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECIBO_PATH, 'utf8')
    expect(src).toMatch(/Font\.register/)
  })

  it('uses Flexbox layout only (no CSS Grid — @react-pdf/renderer constraint)', () => {
    if (!existsSync(RECIBO_PATH)) {
      expect(existsSync(RECIBO_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECIBO_PATH, 'utf8')
    expect(src).toMatch(/flexDirection/)
    // Ensure no CSS Grid usage
    expect(src).not.toMatch(/display:\s*['"]grid['"]/)
  })

  it('formats currency in pt-BR locale (toLocaleString pt-BR)', () => {
    if (!existsSync(RECIBO_PATH)) {
      expect(existsSync(RECIBO_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECIBO_PATH, 'utf8')
    expect(src).toMatch(/toLocaleString\(['"]pt-BR['"]/)
  })
})
