/**
 * src/lib/financeiro/payout-math.ts — Pure payout/commission computation (TRIB-01)
 *
 * Pure functions — no 'server-only', no DB/I/O.
 * Importable by Vitest tests and Server Actions alike.
 *
 * CORRECTNESS:
 *   D-13: Base = valor_recebido − deduções NOMEADAS na regra (not all deductions).
 *   Precedência: service_id exact > '*' wildcard > null → 0% + alerta:'sem_regra'.
 *   T-16-10: integer-cent rounding.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommissionRule {
  service_id: string   // '*' for wildcard
  percentual: number
  deducoes?: string[]  // named deduction keys to subtract from valor_recebido
}

export type PayoutDeductions = Record<string, number>

export interface PayoutItemInput {
  service_id: string
  valor_recebido: number
  descricao?: string
}

export interface PayoutItemResult {
  service_id: string
  valor_recebido: number
  percentual: number
  valor_base: number
  valor_repasse: number
  alerta?: string
}

export interface PayoutResult {
  items: PayoutItemResult[]
  total_repasse: number
}

// ─── applyDeductions ──────────────────────────────────────────────────────────

/**
 * Subtract ONLY the deductions named in ruleDeducoes from valor_recebido.
 * D-13: empty ruleDeducoes → returns valorRecebido unchanged.
 * Integer-cent result.
 */
export function applyDeductions(
  valorRecebido: number,
  deducoes: PayoutDeductions,
  ruleDeducoes: string[]
): number {
  if (!ruleDeducoes || ruleDeducoes.length === 0) return valorRecebido

  let total = valorRecebido
  for (const key of ruleDeducoes) {
    if (Object.prototype.hasOwnProperty.call(deducoes, key)) {
      total -= deducoes[key]
    }
  }
  // Integer-cent round to avoid drift
  return Math.round(total * 100) / 100
}

// ─── computePayout ────────────────────────────────────────────────────────────

/**
 * Compute payout for a list of items against commission rules.
 *
 * Precedence (Claude's Discretion):
 *   1. Exact service_id match
 *   2. Wildcard '*' match
 *   3. No match → { percentual: 0, valor_repasse: 0, alerta: 'sem_regra' }
 *
 * Integer-cent math throughout (T-16-10).
 */
export function computePayout(
  items: PayoutItemInput[],
  rules: CommissionRule[],
  deducoes: PayoutDeductions
): PayoutResult {
  const resultItems: PayoutItemResult[] = items.map((item) => {
    // 1. Exact service_id match
    const exactRule = rules.find((r) => r.service_id === item.service_id)
    // 2. Wildcard fallback
    const wildcardRule = rules.find((r) => r.service_id === '*')
    const rule = exactRule ?? wildcardRule ?? null

    if (!rule) {
      return {
        service_id: item.service_id,
        valor_recebido: item.valor_recebido,
        percentual: 0,
        valor_base: item.valor_recebido,
        valor_repasse: 0,
        alerta: 'sem_regra',
      }
    }

    const valorBase = applyDeductions(
      item.valor_recebido,
      deducoes,
      rule.deducoes ?? []
    )

    const valor_repasse = Math.round(valorBase * rule.percentual * 100) / 100

    return {
      service_id: item.service_id,
      valor_recebido: item.valor_recebido,
      percentual: rule.percentual,
      valor_base: valorBase,
      valor_repasse,
    }
  })

  const total_repasse =
    Math.round(resultItems.reduce((sum, i) => sum + i.valor_repasse, 0) * 100) / 100

  return { items: resultItems, total_repasse }
}

// ─── aggregatePayout ──────────────────────────────────────────────────────────

/**
 * Aggregate payout item results into header-level totals.
 * Integer-cent sums for the professional_payouts row.
 */
export function aggregatePayout(itemResults: PayoutItemResult[]): {
  valor_bruto: number
  valor_base: number
  valor_repasse: number
} {
  const valor_bruto =
    Math.round(itemResults.reduce((s, i) => s + i.valor_recebido, 0) * 100) / 100
  const valor_base =
    Math.round(itemResults.reduce((s, i) => s + i.valor_base, 0) * 100) / 100
  const valor_repasse =
    Math.round(itemResults.reduce((s, i) => s + i.valor_repasse, 0) * 100) / 100
  return { valor_bruto, valor_base, valor_repasse }
}
