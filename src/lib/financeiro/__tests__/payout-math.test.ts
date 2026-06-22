/**
 * Phase 16 — Payout math RED specs (TRIB-01)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1 Plan 04 creates src/lib/financeiro/payout-math.ts.
 * existsSync guard: first assertion checks file presence → RED immediately.
 *
 * Requirements encoded:
 *   TRIB-01 — computePayout: precedência regra por service_id > regra '*' > sem regra → 0% + alerta
 *   TRIB-01 — applyDeductions: subtrai apenas deduções nomeadas na regra (D-13)
 *   TRIB-01 — integer-cent: no float drift in repasse calculation
 *   D-13    — deducoes vazias → base = bruto (no deduction applied)
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144: @-alias causes TS2307 when target missing) ─

const PAYOUT_MOD = join(process.cwd(), 'src/lib/financeiro/payout-math.ts')

// ─── Inline types (mirrors the lib's public interface) ───────────────────────

interface PayoutItem {
  service_id: string
  valor_recebido: number
}

interface CommissionRule {
  service_id: string   // '*' for wildcard
  percentual: number
  deducoes?: string[]  // named deductions to subtract
}

interface PayoutItemResult {
  service_id: string
  valor_recebido: number
  valor_repasse: number
  percentual: number
  alerta?: string
}

interface PayoutResult {
  items: PayoutItemResult[]
  total_repasse: number
}

// ─── computePayout — precedência service_id > wildcard > sem regra ────────────

describe('payout-math.ts — computePayout file presence', () => {
  it('src/lib/financeiro/payout-math.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(PAYOUT_MOD)).toBe(true)
  })
})

describe('payout-math.ts — computePayout exact service_id match', () => {
  it('service_id "A" rule at 60% → valor_repasse === 600 on 1000 received', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    const result = computePayout(
      [{ service_id: 'A', valor_recebido: 1000 }],
      [{ service_id: 'A', percentual: 0.6, deducoes: [] }],
      {}
    )
    expect(result.items[0].valor_repasse).toBe(600)
    expect(result.items[0].percentual).toBe(0.6)
  })
})

describe('payout-math.ts — computePayout precedência: service_id > wildcard', () => {
  it('specific service_id "A" rule wins over wildcard "*" when both present', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    const rules: CommissionRule[] = [
      { service_id: '*', percentual: 0.5, deducoes: [] },
      { service_id: 'A', percentual: 0.6, deducoes: [] },
    ]
    const result = computePayout(
      [{ service_id: 'A', valor_recebido: 1000 }],
      rules,
      {}
    )
    // Must use 0.6 (specific rule), NOT 0.5 (wildcard)
    expect(result.items[0].percentual).toBe(0.6)
    expect(result.items[0].valor_repasse).toBe(600)
  })
})

describe('payout-math.ts — computePayout wildcard fallback', () => {
  it('service_id "Z" with only wildcard rule → uses wildcard 50%', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    const rules: CommissionRule[] = [
      { service_id: '*', percentual: 0.5 },
    ]
    const result = computePayout(
      [{ service_id: 'Z', valor_recebido: 800 }],
      rules,
      {}
    )
    expect(result.items[0].percentual).toBe(0.5)
    expect(result.items[0].valor_repasse).toBe(400)
  })
})

describe('payout-math.ts — computePayout sem regra → 0% + alerta', () => {
  it('service_id "X" with no matching rule → { percentual: 0, valor_repasse: 0, alerta: "sem_regra" }', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    const rules: CommissionRule[] = [
      { service_id: 'A', percentual: 0.6, deducoes: [] },
    ]
    const result = computePayout(
      [{ service_id: 'X', valor_recebido: 500 }],
      rules,
      {}
    )
    expect(result.items[0].percentual).toBe(0)
    expect(result.items[0].valor_repasse).toBe(0)
    expect(result.items[0].alerta).toBe('sem_regra')
  })

  it('sem_regra does not throw — returns structured result gracefully', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    expect(() =>
      computePayout(
        [{ service_id: 'UNKNOWN', valor_recebido: 1000 }],
        [],
        {}
      )
    ).not.toThrow()
  })
})

// ─── applyDeductions — D-13 named deductions only ───────────────────────────

describe('payout-math.ts — applyDeductions named deductions (D-13)', () => {
  it('applyDeductions(1000, { lab: 100, taxa_cartao: 50, materiais: 0 }, ["lab","taxa_cartao"]) === 850', async () => {
    const { applyDeductions } = await import(PAYOUT_MOD) as {
      applyDeductions: (valorRecebido: number, deducoes: Record<string, number>, ruleDeducoes: string[]) => number
    }
    expect(applyDeductions(1000, { lab: 100, taxa_cartao: 50, materiais: 0 }, ['lab', 'taxa_cartao'])).toBe(850)
  })

  it('applyDeductions(1000, { lab: 100 }, []) === 1000 (empty rule deductions → base = bruto, D-13)', async () => {
    const { applyDeductions } = await import(PAYOUT_MOD) as {
      applyDeductions: (valorRecebido: number, deducoes: Record<string, number>, ruleDeducoes: string[]) => number
    }
    expect(applyDeductions(1000, { lab: 100 }, [])).toBe(1000)
  })

  it('applyDeductions subtracts ONLY deductions listed in ruleDeducoes (not all available)', async () => {
    const { applyDeductions } = await import(PAYOUT_MOD) as {
      applyDeductions: (valorRecebido: number, deducoes: Record<string, number>, ruleDeducoes: string[]) => number
    }
    // Only 'lab' is named in rule; 'taxa_cartao' should be ignored
    expect(applyDeductions(1000, { lab: 100, taxa_cartao: 50 }, ['lab'])).toBe(900)
  })
})

// ─── Integer-cent: no float drift ────────────────────────────────────────────

describe('payout-math.ts — computePayout integer-cent (no float drift)', () => {
  it('computePayout([{service_id:"A", valor_recebido:0.1}], [{service_id:"A",percentual:1}], {}) → 0.1 (no drift)', async () => {
    const { computePayout } = await import(PAYOUT_MOD) as {
      computePayout: (items: PayoutItem[], rules: CommissionRule[], deducoes: Record<string, number>) => PayoutResult
    }
    const result = computePayout(
      [{ service_id: 'A', valor_recebido: 0.1 }],
      [{ service_id: 'A', percentual: 1, deducoes: [] }],
      {}
    )
    // 0.1 × 1.0 should not drift to 0.10000000000000001
    expect(result.items[0].valor_repasse).toBe(0.1)
    // Verify integer-cent representable (no sub-cent remainder)
    expect(Math.round(result.items[0].valor_repasse * 100)).toBe(
      result.items[0].valor_repasse * 100
    )
  })
})
