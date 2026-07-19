/**
 * src/lib/financeiro/partner-share-math.ts — Pure partner-share vigência resolution,
 * sum-to-100% validation, and signed distribution (REP-03).
 *
 * Pure functions — no 'use server', no DB/I/O.
 * Importable by Vitest tests and Server Actions alike.
 *
 * CORRECTNESS:
 *   D-20: vigência resolution — vigencia_inicio <= data AND
 *         (vigencia_fim IS NULL OR vigencia_fim >= data). 'YYYY-MM-DD' string
 *         comparison is lexicographically safe (no Date parsing/timezone drift).
 *   D-22: sum-to-100% validation blocks a partner-share set that does not
 *         reconcile — tolerance 0.0001 to absorb rounding on NUMERIC(5,4).
 *   D-27: negative consolidated result distributes proportionally as negative
 *         per-sócio values — sign is preserved, never zeroed/clamped.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareRow {
  user_id: string
  percentual: number // NUMERIC(5,4): 0.2500 = 25%
  vigencia_inicio: string // 'YYYY-MM-DD'
  vigencia_fim: string | null // NULL = vigente
}

// ─── resolveActiveShares ──────────────────────────────────────────────────────

/**
 * Returns only the rows active on `data` (D-20).
 * 'YYYY-MM-DD' strings compare correctly with lexicographic (<=, >=) operators.
 */
export function resolveActiveShares(rows: ShareRow[], data: string): ShareRow[] {
  return rows.filter((row) => {
    const startsOk = row.vigencia_inicio <= data
    const endsOk = row.vigencia_fim === null || row.vigencia_fim >= data
    return startsOk && endsOk
  })
}

// ─── validateSharesSumTo100 ───────────────────────────────────────────────────

const SUM_TOLERANCE = 0.0001

/**
 * Sums percentual of active rows on `data`; valid when the sum reconciles
 * to 100% within tolerance (D-22).
 */
export function validateSharesSumTo100(
  rows: ShareRow[],
  data: string
): { valid: boolean; sum: number } {
  const active = resolveActiveShares(rows, data)
  const sum = active.reduce((total, row) => total + row.percentual, 0)
  return { valid: Math.abs(sum - 1) < SUM_TOLERANCE, sum }
}

// ─── distributeResult ─────────────────────────────────────────────────────────

/**
 * Distributes `resultado` proportionally across active shares on `data`.
 * Sign of `resultado` is preserved per-sócio — negative results distribute
 * as negative values, never zeroed/clamped (D-27).
 */
export function distributeResult(
  rows: ShareRow[],
  data: string,
  resultado: number
): Array<{ user_id: string; percentual: number; valor: number }> {
  const active = resolveActiveShares(rows, data)
  return active.map((row) => ({
    user_id: row.user_id,
    percentual: row.percentual,
    valor: row.percentual * resultado,
  }))
}
