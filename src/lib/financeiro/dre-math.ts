/**
 * src/lib/financeiro/dre-math.ts — Pure DRE aggregation + budget semaphore (REP-01, REP-02)
 *
 * Pure functions — no 'use server', no DB/I/O.
 * Importable by Vitest tests and Server Actions alike.
 *
 * CORRECTNESS:
 *   D-08: each DreLine carries pctReceita = line.total / receitaTotal (análise vertical).
 *   D-15: budgetDeviationSemaphore thresholds — <5% verde, 5–15% amarelo, >15% vermelho.
 *   NULL account_id/account_name rows bucket into 'Não classificado' (Open Question 1 —
 *   consolidated DRE must include unclassified rows, not silently drop them).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DreTxRow {
  amount: number
  type: 'receita' | 'despesa'
  account_id: string | null
  account_name: string | null
  account_type: 'grupo' | 'receita' | 'despesa' | null
  cost_center_id: string | null
}

export interface DreLine {
  account_id: string | null
  account_name: string
  type: 'receita' | 'despesa'
  total: number
  pctReceita: number
}

export interface DreResult {
  receitaTotal: number
  despesaTotal: number
  resultado: number
  margem: number
  lines: DreLine[]
}

// ─── aggregateDre ─────────────────────────────────────────────────────────────

const NAO_CLASSIFICADO = 'Não classificado'

/**
 * Group DRE rows by account_id, sum amount per line, split receita/despesa.
 * NULL account_id rows bucket into a single 'Não classificado' line.
 */
export function aggregateDre(rows: DreTxRow[]): DreResult {
  const groups = new Map<string, { account_id: string | null; account_name: string; type: 'receita' | 'despesa'; total: number }>()

  let receitaTotal = 0
  let despesaTotal = 0

  for (const row of rows) {
    const key = row.account_id ?? '__unclassified__'
    const name = row.account_id === null ? NAO_CLASSIFICADO : (row.account_name ?? NAO_CLASSIFICADO)

    if (row.type === 'receita') {
      receitaTotal += row.amount
    } else {
      despesaTotal += row.amount
    }

    const existing = groups.get(key)
    if (existing) {
      existing.total += row.amount
    } else {
      groups.set(key, {
        account_id: row.account_id,
        account_name: name,
        type: row.type,
        total: row.amount,
      })
    }
  }

  const resultado = receitaTotal - despesaTotal
  const margem = receitaTotal === 0 ? 0 : resultado / receitaTotal

  const lines: DreLine[] = Array.from(groups.values()).map((line) => ({
    account_id: line.account_id,
    account_name: line.account_name,
    type: line.type,
    total: line.total,
    pctReceita: receitaTotal === 0 ? 0 : line.total / receitaTotal,
  }))

  return { receitaTotal, despesaTotal, resultado, margem, lines }
}

// ─── budgetDeviationSemaphore ─────────────────────────────────────────────────

export const SEMAPHORE_VERDE_MAX = 5
export const SEMAPHORE_AMARELO_MAX = 15

export type DeviationSemaphore = 'verde' | 'amarelo' | 'vermelho'

/**
 * Compute the budget-deviation semaphore (D-15).
 * deviation < 5%  → verde
 * deviation 5–15% → amarelo
 * deviation > 15% → vermelho
 * meta === 0 is a special case: realizado === 0 → verde, else vermelho (avoids divide-by-zero).
 */
export function budgetDeviationSemaphore(realizado: number, meta: number): DeviationSemaphore {
  if (meta === 0) {
    return realizado === 0 ? 'verde' : 'vermelho'
  }

  const deviationPct = Math.abs((realizado - meta) / meta) * 100

  if (deviationPct < SEMAPHORE_VERDE_MAX) return 'verde'
  if (deviationPct <= SEMAPHORE_AMARELO_MAX) return 'amarelo'
  return 'vermelho'
}
