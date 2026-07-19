/**
 * Phase 19 — forecast-math.test.ts
 *
 * Real unit tests (TDD RED→GREEN) for src/lib/bi/forecast-math.ts.
 * Pure business logic — no DB, no I/O.
 *
 * Covers BI-01/BI-02 per 19-02-PLAN.md <behavior>:
 * - computeLinearTrend: ordinary least squares over x=0..n-1 months
 * - isDecliningVsTrend: D-33b decline-vs-trend alert threshold (>15% below projection)
 * - insufficientData when fewer than 3 monthly points supplied (D-32)
 *
 * Phase: 19-relat-rios-or-amento-bi / Plan 02
 * Requirements: BI-01, BI-02
 */

import { describe, it, expect } from 'vitest'
import {
  computeLinearTrend,
  isDecliningVsTrend,
  DECLINE_THRESHOLD_PCT,
  type TrendPoint,
} from '@/lib/bi/forecast-math'

describe('computeLinearTrend (BI-02)', () => {
  it('perfectly increasing y=[10,20,30,40] (4 points) → slope=10, intercept=10, projectedNext=50, insufficientData=false', () => {
    const points: TrendPoint[] = [
      { month: '2026-01', value: 10 },
      { month: '2026-02', value: 20 },
      { month: '2026-03', value: 30 },
      { month: '2026-04', value: 40 },
    ]
    const result = computeLinearTrend(points)
    expect(result.slope).toBe(10)
    expect(result.intercept).toBe(10)
    expect(result.projectedNext).toBe(50)
    expect(result.insufficientData).toBe(false)
  })

  it('flat y=[100,100,100] (3 points) → slope=0, projectedNext=100', () => {
    const points: TrendPoint[] = [
      { month: '2026-01', value: 100 },
      { month: '2026-02', value: 100 },
      { month: '2026-03', value: 100 },
    ]
    const result = computeLinearTrend(points)
    expect(result.slope).toBe(0)
    expect(result.projectedNext).toBe(100)
    expect(result.insufficientData).toBe(false)
  })

  it('2 points → insufficientData=true, projectedNext = last value (no regression run) (D-32)', () => {
    const points: TrendPoint[] = [
      { month: '2026-01', value: 50 },
      { month: '2026-02', value: 70 },
    ]
    const result = computeLinearTrend(points)
    expect(result.insufficientData).toBe(true)
    expect(result.projectedNext).toBe(70)
  })

  it('0 points → insufficientData=true, projectedNext=0 (D-32)', () => {
    const result = computeLinearTrend([])
    expect(result.insufficientData).toBe(true)
    expect(result.projectedNext).toBe(0)
  })
})

describe('isDecliningVsTrend (D-33b)', () => {
  it('projected=100, actual=80 → 20% below → true', () => {
    expect(isDecliningVsTrend(80, 100)).toBe(true)
  })

  it('projected=100, actual=90 → 10% below → false', () => {
    expect(isDecliningVsTrend(90, 100)).toBe(false)
  })

  it('projected=100, actual=110 → above trend → false', () => {
    expect(isDecliningVsTrend(110, 100)).toBe(false)
  })

  it('projected=0 → false (guard divide-by-zero)', () => {
    expect(isDecliningVsTrend(50, 0)).toBe(false)
  })

  it('DECLINE_THRESHOLD_PCT default is 15', () => {
    expect(DECLINE_THRESHOLD_PCT).toBe(15)
  })
})
