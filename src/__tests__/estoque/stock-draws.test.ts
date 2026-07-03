/**
 * Phase 17 — estoque/stock-draws.test.ts (Wave 0 RED scaffold)
 *
 * Source-inspection tests for src/actions/stock-draws.ts
 * RED by design until Plan 06 creates that file.
 *
 * Checks:
 * - EST-02: saldo_disponivel updated on each draw (D-09)
 * - EST-02: FIFO batch selection present (D-11)
 * - EST-02: drawMaterialsForProcedures exported (D-06 integration point)
 * - EST-03/D-19: logBusinessEvent called for audit trail
 * - 'use server' directive present
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 *
 * Phase: 17-estoque-materiais / Plan 01
 * Requirements: EST-02, EST-03
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))

// ─── SRC helper ──────────────────────────────────────────────────────────────

function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── stock-draws.ts source-inspection ────────────────────────────────────────
// RED until Plan 06 creates src/actions/stock-draws.ts

describe('src/actions/stock-draws.ts source-inspection (EST-02, EST-03)', () => {
  const src = SRC('src/actions/stock-draws.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('references saldo_disponivel (D-09: tracks available balance per batch)', () => {
    expect(src).toMatch(/saldo_disponivel/)
  })

  it('references FIFO (D-11: FIFO batch selection — oldest batch first)', () => {
    expect(src).toMatch(/FIFO/)
  })

  it('exports drawMaterialsForProcedures (D-06: called from appointments action on concluido)', () => {
    expect(src).toMatch(/drawMaterialsForProcedures/)
  })

  it('calls logBusinessEvent (D-19: audit trail for manual draws)', () => {
    expect(src).toMatch(/logBusinessEvent/)
  })
})
