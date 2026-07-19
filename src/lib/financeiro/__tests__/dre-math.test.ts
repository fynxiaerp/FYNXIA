/**
 * Phase 19 — dre-math.test.ts
 *
 * Real unit tests (TDD RED→GREEN) for src/lib/financeiro/dre-math.ts.
 * Pure business logic — no DB, no I/O.
 *
 * Covers REP-01 (DRE aggregation + análise vertical D-08) and
 * REP-02 (budget-deviation semaphore D-15) per 19-01-PLAN.md <behavior>.
 *
 * Phase: 19-relat-rios-or-amento-bi / Plan 01
 * Requirements: REP-01, REP-02
 */

import { describe, it, expect } from 'vitest'
import {
  aggregateDre,
  budgetDeviationSemaphore,
  type DreTxRow,
} from '@/lib/financeiro/dre-math'

describe('aggregateDre (REP-01)', () => {
  it('sums two receita rows and one despesa row into totals + resultado + margem', () => {
    const rows: DreTxRow[] = [
      { amount: 1000, type: 'receita', account_id: 'a1', account_name: 'Consultas', account_type: 'receita', cost_center_id: null },
      { amount: 500, type: 'receita', account_id: 'a2', account_name: 'Procedimentos', account_type: 'receita', cost_center_id: null },
      { amount: 300, type: 'despesa', account_id: 'a3', account_name: 'Aluguel', account_type: 'despesa', cost_center_id: null },
    ]
    const result = aggregateDre(rows)
    expect(result.receitaTotal).toBe(1500)
    expect(result.despesaTotal).toBe(300)
    expect(result.resultado).toBe(1200)
    expect(result.margem).toBe(0.8)
  })

  it('each DreLine carries pctReceita = line.total / receitaTotal (D-08)', () => {
    const rows: DreTxRow[] = [
      { amount: 1500, type: 'receita', account_id: 'a1', account_name: 'Consultas', account_type: 'receita', cost_center_id: null },
      { amount: 300, type: 'despesa', account_id: 'a2', account_name: 'Aluguel', account_type: 'despesa', cost_center_id: null },
    ]
    const result = aggregateDre(rows)
    const despesaLine = result.lines.find((l) => l.account_id === 'a2')
    expect(despesaLine?.pctReceita).toBe(0.2)
  })

  it('groups rows by account_id — two rows with the same account_id sum into one line', () => {
    const rows: DreTxRow[] = [
      { amount: 100, type: 'receita', account_id: 'a1', account_name: 'Consultas', account_type: 'receita', cost_center_id: null },
      { amount: 200, type: 'receita', account_id: 'a1', account_name: 'Consultas', account_type: 'receita', cost_center_id: null },
    ]
    const result = aggregateDre(rows)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].total).toBe(300)
  })

  it('empty rows → all totals zero, no divide-by-zero', () => {
    const result = aggregateDre([])
    expect(result.receitaTotal).toBe(0)
    expect(result.despesaTotal).toBe(0)
    expect(result.resultado).toBe(0)
    expect(result.margem).toBe(0)
    expect(result.lines).toHaveLength(0)
  })

  it("rows with account_id=null bucket into a line with account_name 'Não classificado'", () => {
    const rows: DreTxRow[] = [
      { amount: 400, type: 'receita', account_id: null, account_name: null, account_type: null, cost_center_id: null },
    ]
    const result = aggregateDre(rows)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].account_name).toBe('Não classificado')
    expect(result.receitaTotal).toBe(400)
  })
})

describe('budgetDeviationSemaphore (REP-02, D-15)', () => {
  it('realizado === meta → 0% deviation → verde', () => {
    expect(budgetDeviationSemaphore(100, 100)).toBe('verde')
  })

  it('4% deviation → verde; 10% → amarelo; 20% → vermelho', () => {
    expect(budgetDeviationSemaphore(104, 100)).toBe('verde')
    expect(budgetDeviationSemaphore(110, 100)).toBe('amarelo')
    expect(budgetDeviationSemaphore(120, 100)).toBe('vermelho')
  })

  it('boundary: exactly 5% → amarelo; exactly 15% → amarelo; 16% → vermelho', () => {
    expect(budgetDeviationSemaphore(105, 100)).toBe('amarelo')
    expect(budgetDeviationSemaphore(115, 100)).toBe('amarelo')
    expect(budgetDeviationSemaphore(116, 100)).toBe('vermelho')
  })

  it('meta=0: realizado=0 → verde; realizado=50 → vermelho', () => {
    expect(budgetDeviationSemaphore(0, 0)).toBe('verde')
    expect(budgetDeviationSemaphore(50, 0)).toBe('vermelho')
  })
})
