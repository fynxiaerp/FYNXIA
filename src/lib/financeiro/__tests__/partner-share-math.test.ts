/**
 * Phase 19 — partner-share-math.test.ts
 *
 * Real unit tests (TDD RED→GREEN) for src/lib/financeiro/partner-share-math.ts.
 * Pure business logic — no DB, no I/O.
 *
 * Covers REP-03: vigência resolution (D-20), sum-to-100% validation (D-22),
 * and signed proportional distribution (D-27) per 19-01-PLAN.md <behavior>.
 *
 * Phase: 19-relat-rios-or-amento-bi / Plan 01
 * Requirements: REP-03
 */

import { describe, it, expect } from 'vitest'
import {
  resolveActiveShares,
  validateSharesSumTo100,
  distributeResult,
  type ShareRow,
} from '@/lib/financeiro/partner-share-math'

describe('resolveActiveShares (D-20)', () => {
  it('a row with vigencia_fim=null resolves as active for a later date', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 1, vigencia_inicio: '2026-01-01', vigencia_fim: null },
    ]
    expect(resolveActiveShares(rows, '2026-07-01')).toHaveLength(1)
  })

  it('a row with vigencia_fim set is NOT active after it but IS active before it', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 1, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-06-30' },
    ]
    expect(resolveActiveShares(rows, '2026-07-01')).toHaveLength(0)
    expect(resolveActiveShares(rows, '2026-06-15')).toHaveLength(1)
  })

  it('a row with vigencia_inicio in the future is NOT active', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 1, vigencia_inicio: '2026-08-01', vigencia_fim: null },
    ]
    expect(resolveActiveShares(rows, '2026-07-01')).toHaveLength(0)
  })
})

describe('validateSharesSumTo100 (D-22)', () => {
  const data = '2026-07-01'

  it('two active rows 0.6 + 0.4 → valid=true, sum=1', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 0.6, vigencia_inicio: '2026-01-01', vigencia_fim: null },
      { user_id: 'u2', percentual: 0.4, vigencia_inicio: '2026-01-01', vigencia_fim: null },
    ]
    const result = validateSharesSumTo100(rows, data)
    expect(result.valid).toBe(true)
    expect(result.sum).toBe(1)
  })

  it('two active rows 0.6 + 0.3 → valid=false, sum=0.9', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 0.6, vigencia_inicio: '2026-01-01', vigencia_fim: null },
      { user_id: 'u2', percentual: 0.3, vigencia_inicio: '2026-01-01', vigencia_fim: null },
    ]
    const result = validateSharesSumTo100(rows, data)
    expect(result.valid).toBe(false)
    expect(result.sum).toBeCloseTo(0.9, 4)
  })

  it('rounding: 0.3333 + 0.3333 + 0.3334 → valid=true (within tolerance of 1)', () => {
    const rows: ShareRow[] = [
      { user_id: 'u1', percentual: 0.3333, vigencia_inicio: '2026-01-01', vigencia_fim: null },
      { user_id: 'u2', percentual: 0.3333, vigencia_inicio: '2026-01-01', vigencia_fim: null },
      { user_id: 'u3', percentual: 0.3334, vigencia_inicio: '2026-01-01', vigencia_fim: null },
    ]
    const result = validateSharesSumTo100(rows, data)
    expect(result.valid).toBe(true)
  })
})

describe('distributeResult (D-27)', () => {
  const data = '2026-07-01'
  const rows: ShareRow[] = [
    { user_id: 'u1', percentual: 0.6, vigencia_inicio: '2026-01-01', vigencia_fim: null },
    { user_id: 'u2', percentual: 0.4, vigencia_inicio: '2026-01-01', vigencia_fim: null },
  ]

  it('resultado=10000, shares 0.6/0.4 → [6000, 4000]', () => {
    const result = distributeResult(rows, data, 10000)
    expect(result.map((r) => r.valor)).toEqual([6000, 4000])
  })

  it('resultado=-5000, shares 0.6/0.4 → [-3000, -2000] (negative preserved, D-27)', () => {
    const result = distributeResult(rows, data, -5000)
    expect(result.map((r) => r.valor)).toEqual([-3000, -2000])
  })
})
