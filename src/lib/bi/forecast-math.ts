/**
 * src/lib/bi/forecast-math.ts — Pure BI forecasting math (BI-01, BI-02)
 *
 * Pure functions — no 'server-only', no DB/I/O, importable by Vitest tests
 * and Server Actions/cron routes alike. Mirrors src/lib/financeiro/payout-math.ts
 * convention.
 *
 * CORRECTNESS:
 *   D-31: extrapolação estatística via regressão linear simples (OLS), x = 0..n-1.
 *   D-32: insufficientData = true quando points.length < 3 (janela mínima).
 *   D-33b: alerta de queda-vs-tendência dispara apenas quando actual está
 *          > thresholdPct abaixo do valor projetado pela tendência.
 *
 * Deliberate exception (19-RESEARCH "Don't Hand-Roll"): hand-rolled OLS, no
 * simple-statistics/regression dependency — ~15 lines, trivially unit-testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendPoint {
  month: string
  value: number
}

export interface TrendResult {
  slope: number
  intercept: number
  projectedNext: number
  insufficientData: boolean
}

// ─── computeLinearTrend ─────────────────────────────────────────────────────

/**
 * Ordinary least squares linear trend over monthly points.
 * x = 0..n-1 (month index), y = point.value.
 *
 * D-32: fewer than 3 points → insufficientData=true, no regression run;
 * projectedNext falls back to the last known value (or 0 when no points at all).
 */
export function computeLinearTrend(points: TrendPoint[]): TrendResult {
  const n = points.length
  if (n < 3) {
    const last = points.at(-1)?.value ?? 0
    return { slope: 0, intercept: last, projectedNext: last, insufficientData: true }
  }

  const xs = points.map((_, i) => i)
  const ys = points.map((p) => p.value)
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  const num = xs.reduce((s, x, i) => s + (x - xMean) * ((ys[i] ?? 0) - yMean), 0)
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0)
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  const projectedNext = slope * n + intercept

  return { slope, intercept, projectedNext, insufficientData: false }
}

// ─── isDecliningVsTrend ─────────────────────────────────────────────────────

export const DECLINE_THRESHOLD_PCT = 15

/**
 * D-33b: fires only when `actual` is more than `thresholdPct` below `projected`.
 * Guards against divide-by-zero when projected <= 0 (returns false — no trend
 * to decline against).
 */
export function isDecliningVsTrend(
  actual: number,
  projected: number,
  thresholdPct = DECLINE_THRESHOLD_PCT
): boolean {
  if (projected <= 0) return false
  return ((projected - actual) / projected) * 100 > thresholdPct
}
