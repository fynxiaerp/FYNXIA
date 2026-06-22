/**
 * src/lib/financeiro/reconciliation.ts — Pure 3-stage reconciliation algorithm (FOP-02)
 *
 * Pure functions — no 'server-only', no DB/I/O.
 * Importable by Vitest tests and Server Actions alike.
 *
 * Algorithm:
 *   Stage 1 — matchExact: |amount| < 0.01 AND |days| ≤ 3 → auto-match
 *   Stage 2 — matchFuzzy: composite score (amount 0.6 + date 0.3 + memo 0.1); ≥0.5 → suggestion
 *   Stage 3 — matchNToOne: 1 deposit ↔ N receivables; fee = deposit − sum (D-09, Pitfall 5)
 *
 * CORRECTNESS:
 *   T-16-10: integer-cent fee in matchNToOne.
 *   Pitfall 5: fee positivo = despesa de taxa bancária (never receita).
 *   N-cap at 20 to prevent combinatorial explosion.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatementLineInput {
  id: string
  amount: number           // positive = credit, negative = debit
  transaction_date: string // 'YYYY-MM-DD'
  memo?: string
  bank_account_id?: string
}

export interface TransactionRow {
  id: string
  amount: number
  transaction_date: string
  description?: string
  bank_account_id?: string
}

export interface ExactMatch {
  transaction_id: string
  confidence: 'exact'
}

export interface ScoredMatch {
  transaction_id: string
  score: number
  confidence: 'high' | 'low'
}

export interface NToOneMatch {
  transaction_ids: string[]
  fee: number  // deposit.amount − sum(matched); positive = bank fee (despesa)
}

// ─── matchExact ───────────────────────────────────────────────────────────────

/**
 * Stage 1: exact match within tolerances.
 * Returns first candidate where |amount diff| ≤ amountTolerance AND |days| ≤ dateTolerance.
 */
export function matchExact(
  line: StatementLineInput,
  candidates: TransactionRow[],
  dateTolerance = 3,
  amountTolerance = 0.01
): ExactMatch | null {
  const lineDate = new Date(line.transaction_date)

  const match = candidates.find((tx) => {
    const txDate = new Date(tx.transaction_date)
    const daysDiff = Math.abs(
      (lineDate.getTime() - txDate.getTime()) / 86400000
    )
    const amountDiff = Math.abs(line.amount - tx.amount)
    return daysDiff <= dateTolerance && amountDiff <= amountTolerance
  })

  return match ? { transaction_id: match.id, confidence: 'exact' } : null
}

// ─── matchFuzzy ───────────────────────────────────────────────────────────────

/**
 * Stage 2: fuzzy scored suggestions.
 *
 * score = (1 − |amountDiff| / |lineAmount|) × 0.6
 *       + (1 − min(dateDiffDays, 30) / 30)   × 0.3
 *       + memoSimilarity                      × 0.1
 *
 * Returns candidates with score ≥ 0.5, sorted descending.
 * confidence: 'high' if score ≥ 0.85, else 'low'.
 */
export function matchFuzzy(
  line: StatementLineInput,
  candidates: TransactionRow[]
): ScoredMatch[] {
  const lineDate = new Date(line.transaction_date)
  const lineAmount = Math.abs(line.amount)

  const scored: ScoredMatch[] = []

  for (const tx of candidates) {
    const txDate = new Date(tx.transaction_date)
    const dateDiffDays = Math.abs(
      (lineDate.getTime() - txDate.getTime()) / 86400000
    )
    const amountDiff = Math.abs(line.amount - tx.amount)

    // Amount score: 0 when diff is ≥ lineAmount, 1 when identical
    const amountScore =
      lineAmount > 0
        ? Math.max(0, 1 - amountDiff / lineAmount)
        : amountDiff === 0
        ? 1
        : 0

    // Date score: 0 when ≥ 30 days apart, 1 when same day
    const dateScore = Math.max(0, 1 - Math.min(dateDiffDays, 30) / 30)

    // Memo similarity: simple token overlap (0–1)
    const memoScore = computeMemoSimilarity(
      line.memo ?? '',
      tx.description ?? ''
    )

    const score = amountScore * 0.6 + dateScore * 0.3 + memoScore * 0.1

    if (score >= 0.5) {
      scored.push({
        transaction_id: tx.id,
        score: Math.round(score * 10000) / 10000,
        confidence: score >= 0.85 ? 'high' : 'low',
      })
    }
  }

  // Sort descending by score
  return scored.sort((a, b) => b.score - a.score)
}

/** Simple token overlap similarity (0–1) between two strings. */
function computeMemoSimilarity(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0

  const tokensA = new Set(a.toUpperCase().split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toUpperCase().split(/\s+/).filter(Boolean))

  if (tokensA.size === 0 && tokensB.size === 0) return 1

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }

  const union = tokensA.size + tokensB.size - intersection
  return union > 0 ? intersection / union : 0
}

// ─── matchNToOne ──────────────────────────────────────────────────────────────

const MAX_N = 20

/**
 * Stage 3: match 1 deposit to N receivables (D-09).
 *
 * Tries combinations N=2..min(candidates.length, MAX_N=20) of the candidates
 * (sorted by date proximity) until |sum − deposit.amount| ≤ tolerance.
 *
 * Returns { transaction_ids, fee } where fee = deposit.amount − sum.
 * fee > 0 → bank/card fee (despesa, Pitfall 5).
 * Returns null if no combination fits.
 *
 * Integer-cent fee (T-16-10).
 */
export function matchNToOne(
  depositLine: StatementLineInput,
  candidates: TransactionRow[],
  tolerance = 5.00
): NToOneMatch | null {
  const depositDate = new Date(depositLine.transaction_date)

  // Sort candidates by date proximity to deposit
  const sorted = [...candidates]
    .slice(0, MAX_N)
    .sort((a, b) => {
      const diffA = Math.abs(new Date(a.transaction_date).getTime() - depositDate.getTime())
      const diffB = Math.abs(new Date(b.transaction_date).getTime() - depositDate.getTime())
      return diffA - diffB
    })

  const n = sorted.length

  // Try combinations starting from N=2
  for (let size = 2; size <= n; size++) {
    const result = findCombination(sorted, size, depositLine.amount, tolerance)
    if (result) {
      const fee = Math.round((depositLine.amount - result.sum) * 100) / 100
      return { transaction_ids: result.ids, fee }
    }
  }

  return null
}

/** Find a combination of exactly `size` candidates whose sum is within tolerance of target. */
function findCombination(
  candidates: TransactionRow[],
  size: number,
  target: number,
  tolerance: number
): { ids: string[]; sum: number } | null {
  const n = candidates.length

  function backtrack(
    start: number,
    remaining: number,
    chosen: string[],
    sum: number
  ): { ids: string[]; sum: number } | null {
    if (chosen.length === size) {
      if (Math.abs(target - sum) <= tolerance) {
        return { ids: [...chosen], sum }
      }
      return null
    }

    for (let i = start; i <= n - (remaining - 1) - 1; i++) {
      const next = candidates[i]
      const result = backtrack(
        i + 1,
        remaining - 1,
        [...chosen, next.id],
        sum + next.amount
      )
      if (result) return result
    }
    return null
  }

  return backtrack(0, size, [], 0)
}
