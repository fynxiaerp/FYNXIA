/**
 * Phase 18 — crc/roi-math.test.ts
 *
 * Real unit tests (TDD RED→GREEN) for src/lib/crc/roi-math.ts.
 * Pure business logic — no DB, no I/O.
 *
 * Covers CRC-02 (CPL/CAC) and CRC-04 (NPS classification/score) per
 * 18-CONTEXT.md D-06/D-14 and 18-01-PLAN.md <behavior>.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-02, CRC-04
 */

import { describe, it, expect } from 'vitest'
import {
  computeCpl,
  computeCac,
  classifyNps,
  computeNpsScore,
} from '@/lib/crc/roi-math'

describe('computeCpl (CRC-02, D-06)', () => {
  it('returns null when leads is 0 (never Infinity/NaN)', () => {
    expect(computeCpl(1000, 0)).toBeNull()
  })

  it('returns cost / leads when leads > 0', () => {
    expect(computeCpl(1000, 10)).toBe(100)
  })

  it('handles fractional results', () => {
    expect(computeCpl(100, 3)).toBeCloseTo(33.333, 2)
  })
})

describe('computeCac (CRC-02, D-06)', () => {
  it('returns null when converted is 0 (never Infinity/NaN)', () => {
    expect(computeCac(1000, 0)).toBeNull()
  })

  it('returns cost / converted when converted > 0', () => {
    expect(computeCac(1000, 5)).toBe(200)
  })
})

describe('classifyNps (CRC-04, D-14)', () => {
  it('classifies 9 and 10 as promotor', () => {
    expect(classifyNps(9)).toBe('promotor')
    expect(classifyNps(10)).toBe('promotor')
  })

  it('classifies 7 and 8 as neutro', () => {
    expect(classifyNps(7)).toBe('neutro')
    expect(classifyNps(8)).toBe('neutro')
  })

  it('classifies 0 through 6 as detrator', () => {
    for (let s = 0; s <= 6; s++) {
      expect(classifyNps(s)).toBe('detrator')
    }
  })

  it('throws RangeError for out-of-range scores', () => {
    expect(() => classifyNps(-1)).toThrow(RangeError)
    expect(() => classifyNps(11)).toThrow(RangeError)
  })
})

describe('computeNpsScore (CRC-04, D-14)', () => {
  it('returns null for an empty array', () => {
    expect(computeNpsScore([])).toBeNull()
  })

  it('returns 100 when all scores are promotores', () => {
    expect(computeNpsScore([9, 10, 9])).toBe(100)
  })

  it('returns -100 when all scores are detratores', () => {
    expect(computeNpsScore([0, 3, 6])).toBe(-100)
  })

  it('returns 0 when promotores and detratores balance out', () => {
    expect(computeNpsScore([10, 0])).toBe(0)
  })

  it('computes %promotores - %detratores, rounded to integer', () => {
    // 2 promotores (9,10), 1 neutro (7), 1 detrator (5) => 50% - 25% = 25
    expect(computeNpsScore([9, 10, 7, 5])).toBe(25)
  })
})
