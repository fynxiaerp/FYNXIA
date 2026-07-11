/**
 * Phase 17 — estoque/custo-medio.test.ts
 *
 * Unit tests for src/lib/stock/custo-medio.ts (pure function, no DB, no mocks needed).
 *
 * Requirements: EST-01, D-02 (custo médio móvel), Pitfall 6 (divisão por zero / primeiro lote)
 *
 * Phase: 17-estoque-materiais / Plan 03
 */

import { describe, it, expect } from 'vitest'
import { calcularCustoMedioMovel } from '@/lib/stock/custo-medio'

describe('calcularCustoMedioMovel', () => {
  it('primeiro lote (saldo anterior 0) retorna o próprio custo unitário', () => {
    expect(calcularCustoMedioMovel(0, 0, 10, 5)).toBe(5)
  })

  it('pondera saldo atual e entrada corretamente', () => {
    // (10*5 + 10*7) / 20 = 120/20 = 6
    expect(calcularCustoMedioMovel(10, 5, 10, 7)).toBe(6)
  })

  it('guard: saldo negativo retorna custo_unitario (sem ponderar com custo anterior inválido)', () => {
    expect(calcularCustoMedioMovel(-3, 5, 10, 7)).toBe(7)
  })

  it('arredonda o resultado a 4 casas decimais', () => {
    const expected = Number(((3 * 4 + 2 * 9) / 5).toFixed(4))
    expect(calcularCustoMedioMovel(3, 4, 2, 9)).toBe(expected)
    expect(calcularCustoMedioMovel(3, 4, 2, 9)).toBe(6)
  })

  it('nunca retorna NaN', () => {
    expect(Number.isNaN(calcularCustoMedioMovel(0, 0, 10, 5))).toBe(false)
    expect(Number.isNaN(calcularCustoMedioMovel(10, 5, 10, 7))).toBe(false)
    expect(Number.isNaN(calcularCustoMedioMovel(-3, 5, 10, 7))).toBe(false)
  })

  it('nunca retorna Infinity', () => {
    expect(Number.isFinite(calcularCustoMedioMovel(0, 0, 10, 5))).toBe(true)
    expect(Number.isFinite(calcularCustoMedioMovel(10, 5, 10, 7))).toBe(true)
    expect(Number.isFinite(calcularCustoMedioMovel(-3, 5, 10, 7))).toBe(true)
  })
})
