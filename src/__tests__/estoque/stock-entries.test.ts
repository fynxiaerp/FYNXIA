/**
 * Phase 17 — estoque/stock-entries.test.ts (Wave 0 RED scaffold)
 *
 * Source-inspection tests for src/actions/stock-entries.ts
 * RED by design until Plan 05 creates that file.
 *
 * Checks:
 * - EST-01: calcularCustoMedioMovel present in the action (D-02)
 * - EST-01: product_batches updated on each entry
 * - EST-01: 'use server' directive present
 *
 * Also checks:
 * - src/lib/stock/custo-medio.ts exports calcularCustoMedioMovel (Plan 03 target)
 *
 * Convention: SRC(relPath) returns '' if file missing — RED on content, not ENOENT.
 * This prevents ENOENT-based failures from masking real issues when the file exists
 * but is missing the expected pattern.
 *
 * Phase: 17-estoque-materiais / Plan 01
 * Requirements: EST-01
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

// ─── stock-entries.ts source-inspection ──────────────────────────────────────
// RED until Plan 05 creates src/actions/stock-entries.ts

describe('src/actions/stock-entries.ts source-inspection (EST-01)', () => {
  const src = SRC('src/actions/stock-entries.ts')

  it("has 'use server' directive (required for Server Actions)", () => {
    expect(src).toMatch(/'use server'/)
  })

  it('references custo_medio_movel (D-02: moving average cost tracking)', () => {
    expect(src).toMatch(/custo_medio_movel/)
  })

  it('calls calcularCustoMedioMovel (D-02: calculates weighted average on each entry)', () => {
    expect(src).toMatch(/calcularCustoMedioMovel/)
  })

  it('references product_batches (D-11: each entry creates a batch record)', () => {
    expect(src).toMatch(/product_batches/)
  })

  it('references stock_entries table insert (records the entry)', () => {
    expect(src).toMatch(/stock_entries/)
  })
})

// ─── custo-medio.ts lib source-inspection ────────────────────────────────────
// RED until Plan 03 creates src/lib/stock/custo-medio.ts

describe('src/lib/stock/custo-medio.ts source-inspection (EST-01, D-02)', () => {
  const src = SRC('src/lib/stock/custo-medio.ts')

  it('exports calcularCustoMedioMovel function (pure lib — Plan 03 target)', () => {
    expect(src).toMatch(/calcularCustoMedioMovel/)
  })
})
