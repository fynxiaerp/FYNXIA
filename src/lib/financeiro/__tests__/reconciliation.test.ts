/**
 * Phase 16 — Reconciliation algorithm RED specs (FOP-02)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1 Plan 04 creates src/lib/financeiro/reconciliation.ts.
 * existsSync guard: first assertion checks file presence → RED immediately.
 *
 * Requirements encoded:
 *   FOP-02 — matchExact: casa por |amount| < 0.01 e |dias| <= 3 (janela exata)
 *   FOP-02 — matchFuzzy: score composto (amount 0.6 + date 0.3 + memo 0.1); ≥0.5 sugestão; ≥0.85 alta confiança
 *   FOP-02 — matchNToOne: 1 depósito ↔ N receivables; fee = deposit − soma (taxa bancária)
 *   FOP-02 — matchNToOne returns null quando nenhuma combinação dentro da tolerância
 *   FOP-02 — matchNToOne caps N ≤ 20 para não explodir combinatória
 *   D-09   — fee positivo = despesa de taxa (Pitfall 5)
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144: @-alias causes TS2307 when target missing) ─

const RECON_MOD = join(process.cwd(), 'src/lib/financeiro/reconciliation.ts')

// ─── Inline types (mirrors the lib's public interface) ───────────────────────

interface StatementLine {
  id: string
  amount: number          // positivo = crédito, negativo = débito
  transaction_date: string // ISO date string 'YYYY-MM-DD'
  memo?: string
}

interface TransactionRow {
  id: string
  amount: number
  transaction_date: string
  description?: string
}

interface ExactMatch {
  transaction_id: string
  confidence: 'exact'
}

interface ScoredMatch {
  transaction_id: string
  score: number
  confidence: 'high' | 'low'
}

interface NToOneMatch {
  transaction_ids: string[]
  fee: number  // deposit.amount − soma(matched amounts); positive = fee expense
}

// ─── matchExact — exact amount + date tolerance ───────────────────────────────

describe('reconciliation.ts — matchExact file presence', () => {
  it('src/lib/financeiro/reconciliation.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(RECON_MOD)).toBe(true)
  })
})

describe('reconciliation.ts — matchExact hit (1 day difference, same amount)', () => {
  it('matchExact({amount:150, date:"2026-06-10"}, [{amount:150, date:"2026-06-11"}]) → { transaction_id:"t1", confidence:"exact" }', async () => {
    const { matchExact } = await import(RECON_MOD) as {
      matchExact: (line: StatementLine, candidates: TransactionRow[], dateTol?: number, amountTol?: number) => ExactMatch | null
    }
    const line: StatementLine = { id: 'l1', amount: 150, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [{ id: 't1', amount: 150, transaction_date: '2026-06-11' }]
    const result = matchExact(line, candidates)
    expect(result).not.toBeNull()
    expect(result?.transaction_id).toBe('t1')
    expect(result?.confidence).toBe('exact')
  })

  it('matchExact returns null when amount differs by > 0.01', async () => {
    const { matchExact } = await import(RECON_MOD) as {
      matchExact: (line: StatementLine, candidates: TransactionRow[]) => ExactMatch | null
    }
    const line: StatementLine = { id: 'l1', amount: 150, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [{ id: 't1', amount: 150.02, transaction_date: '2026-06-10' }]
    expect(matchExact(line, candidates)).toBeNull()
  })

  it('matchExact returns null when date differs by > 3 days', async () => {
    const { matchExact } = await import(RECON_MOD) as {
      matchExact: (line: StatementLine, candidates: TransactionRow[]) => ExactMatch | null
    }
    const line: StatementLine = { id: 'l1', amount: 150, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [{ id: 't1', amount: 150, transaction_date: '2026-06-14' }]  // 4 days
    expect(matchExact(line, candidates)).toBeNull()
  })

  it('matchExact accepts amount within 0.01 tolerance (centavo precision)', async () => {
    const { matchExact } = await import(RECON_MOD) as {
      matchExact: (line: StatementLine, candidates: TransactionRow[]) => ExactMatch | null
    }
    const line: StatementLine = { id: 'l1', amount: 150.001, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [{ id: 't1', amount: 150, transaction_date: '2026-06-10' }]
    // |150.001 − 150| = 0.001 < 0.01 → should match
    expect(matchExact(line, candidates)).not.toBeNull()
  })
})

// ─── matchFuzzy — composite score ordering + thresholds ──────────────────────

describe('reconciliation.ts — matchFuzzy score ordering and thresholds', () => {
  it('matchFuzzy returns ScoredMatch[] ordered descending by score', async () => {
    const { matchFuzzy } = await import(RECON_MOD) as {
      matchFuzzy: (line: StatementLine, candidates: TransactionRow[]) => ScoredMatch[]
    }
    const line: StatementLine = {
      id: 'l1',
      amount: 1000,
      transaction_date: '2026-06-10',
      memo: 'PAGAMENTO CONVENIO UNIMED',
    }
    const candidates: TransactionRow[] = [
      { id: 't1', amount: 1000, transaction_date: '2026-06-11', description: 'PAGAMENTO CONVENIO UNIMED' },  // high score
      { id: 't2', amount: 5000, transaction_date: '2026-01-01', description: 'OUTRO LANCAMENTO' },              // low score
    ]
    const results = matchFuzzy(line, candidates)
    expect(results.length).toBeGreaterThan(0)
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    }
  })

  it('matchFuzzy: same-amount near-date candidate has score >= 0.85 (high confidence)', async () => {
    const { matchFuzzy } = await import(RECON_MOD) as {
      matchFuzzy: (line: StatementLine, candidates: TransactionRow[]) => ScoredMatch[]
    }
    const line: StatementLine = { id: 'l1', amount: 500, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [
      { id: 't1', amount: 500, transaction_date: '2026-06-11' },  // perfect amount, 1 day off
    ]
    const results = matchFuzzy(line, candidates)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThanOrEqual(0.85)
    expect(results[0].confidence).toBe('high')
  })

  it('matchFuzzy: distant-amount candidate has score < 0.5 and is excluded from suggestions', async () => {
    const { matchFuzzy } = await import(RECON_MOD) as {
      matchFuzzy: (line: StatementLine, candidates: TransactionRow[]) => ScoredMatch[]
    }
    const line: StatementLine = { id: 'l1', amount: 100, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [
      { id: 't1', amount: 99999, transaction_date: '2025-01-01' },  // massive amount diff + date diff
    ]
    const results = matchFuzzy(line, candidates)
    // Either empty (score < 0.5 filtered out) or score < 0.5
    if (results.length > 0) {
      expect(results[0].score).toBeLessThan(0.5)
    }
  })
})

// ─── matchNToOne — N receivables → 1 deposit (D-09, Pitfall 5) ──────────────

describe('reconciliation.ts — matchNToOne (1 deposit ↔ N receivables + fee)', () => {
  it('matchNToOne({amount:1000}, [{amount:600},{amount:395}], 5.00) → match with fee === 5', async () => {
    const { matchNToOne } = await import(RECON_MOD) as {
      matchNToOne: (depositLine: StatementLine, candidates: TransactionRow[], tolerance?: number) => NToOneMatch | null
    }
    const deposit: StatementLine = { id: 'd1', amount: 1000, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [
      { id: 'r1', amount: 600, transaction_date: '2026-06-08' },
      { id: 'r2', amount: 395, transaction_date: '2026-06-09' },
    ]
    const result = matchNToOne(deposit, candidates, 5.00)
    expect(result).not.toBeNull()
    expect(result!.transaction_ids).toContain('r1')
    expect(result!.transaction_ids).toContain('r2')
    // fee = 1000 − (600 + 395) = 5 (positive = bank fee expense, Pitfall 5)
    expect(result!.fee).toBe(5)
  })

  it('matchNToOne returns null when no combination fits within tolerance', async () => {
    const { matchNToOne } = await import(RECON_MOD) as {
      matchNToOne: (depositLine: StatementLine, candidates: TransactionRow[], tolerance?: number) => NToOneMatch | null
    }
    const deposit: StatementLine = { id: 'd1', amount: 1000, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [
      { id: 'r1', amount: 300, transaction_date: '2026-06-08' },
      { id: 'r2', amount: 300, transaction_date: '2026-06-09' },
      // 300 + 300 = 600 — too far from 1000 (diff = 400, tolerance only 5)
    ]
    const result = matchNToOne(deposit, candidates, 5.00)
    expect(result).toBeNull()
  })

  it('matchNToOne caps N ≤ 20 candidates to prevent combinatorial explosion', async () => {
    const { matchNToOne } = await import(RECON_MOD) as {
      matchNToOne: (depositLine: StatementLine, candidates: TransactionRow[], tolerance?: number) => NToOneMatch | null
    }
    // Generate 30 candidates — function should still return in bounded time (no hang)
    const manyCandidates: TransactionRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      amount: 33.33,
      transaction_date: '2026-06-10',
    }))
    const deposit: StatementLine = { id: 'd1', amount: 999.99, transaction_date: '2026-06-10' }
    // Must complete without timing out — caps at 20 candidates
    const start = Date.now()
    matchNToOne(deposit, manyCandidates, 5.00)
    expect(Date.now() - start).toBeLessThan(2000) // must complete in < 2s
  })

  it('fee is positive = bank expense (Pitfall 5: deposit − soma > 0 = fee despesa)', async () => {
    const { matchNToOne } = await import(RECON_MOD) as {
      matchNToOne: (depositLine: StatementLine, candidates: TransactionRow[], tolerance?: number) => NToOneMatch | null
    }
    const deposit: StatementLine = { id: 'd1', amount: 1000, transaction_date: '2026-06-10' }
    const candidates: TransactionRow[] = [
      { id: 'r1', amount: 600, transaction_date: '2026-06-08' },
      { id: 'r2', amount: 395, transaction_date: '2026-06-09' },
    ]
    const result = matchNToOne(deposit, candidates, 5.00)
    // fee = 1000 − 995 = 5 (positive → bank fee, to be recorded as despesa)
    expect(result?.fee).toBeGreaterThan(0)
  })
})
