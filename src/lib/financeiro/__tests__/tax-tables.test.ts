/**
 * Phase 16 — Tax math RED specs (TRIB-02)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1 Plan 04 creates src/lib/financeiro/tax-tables.ts.
 * existsSync guard: first assertion in each suite checks file presence → RED immediately.
 *
 * Requirements encoded:
 *   TRIB-02 — computeInss: 11% flat with teto cap (R$ 932.31) + progressivo with parcela_deduzir
 *   TRIB-02 — computeIrrf: isento ≤5000, gradual band 5000.01–7350, flat 27.5% − 908.73 above 7350
 *   TRIB-02 — Pitfall 3: teto cap at R$ 8475.55 × 11% = R$ 932.31
 *   TRIB-02 — Pitfall 4: IRRF base = valorBruto − INSS retido (not valorBruto directly)
 *   TRIB-02 — computeIss: integer-cent, no float drift
 *   TRIB-02 — selectBracketsByVigencia: temporal selection by vigencia_inicio/vigencia_fim
 *   TRIB-02 — computeRpaWithholdings: orchestrator applying Pitfall 4 (INSS before IRRF)
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144: @-alias causes TS2307 when target missing) ─

const TAX_MOD = join(process.cwd(), 'src/lib/financeiro/tax-tables.ts')

// ─── Inline 2026 brackets (matches the seed in RESEARCH.md §"Seed 2026 INSS") ─

interface InssBracket {
  vigencia_inicio: string
  vigencia_fim: string | null
  faixa_min: number
  faixa_max: number | null
  aliquota: number
  parcela_deduzir: number
  teto: number | null
}

interface IrrfBracket {
  vigencia_inicio: string
  vigencia_fim: string | null
  faixa_min: number
  faixa_max: number | null
  aliquota: number
  parcela_deduzir: number
  formula_desconto?: string | null
}

// INSS progressivo 2026 (contribuinte individual segurado)
const BRACKETS_2026: InssBracket[] = [
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 0,       faixa_max: 1621.00,  aliquota: 0.0750, parcela_deduzir: 0,      teto: null     },
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 1621.01, faixa_max: 2902.84,  aliquota: 0.0900, parcela_deduzir: 24.32,  teto: null     },
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 2902.85, faixa_max: 4354.27,  aliquota: 0.1200, parcela_deduzir: 111.40, teto: null     },
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 4354.28, faixa_max: 8475.55,  aliquota: 0.1400, parcela_deduzir: 198.49, teto: 8475.55  },
]

// IRRF progressivo 2026 (Lei 15.270/2025)
const IRRF_2026: IrrfBracket[] = [
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 0,       faixa_max: 5000.00,  aliquota: 0.0000, parcela_deduzir: 0 },
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 5000.01, faixa_max: 7350.00,  aliquota: 0.2750, parcela_deduzir: 0,  formula_desconto: '978.62 - (0.133145 * base)' },
  { vigencia_inicio: '2026-01-01', vigencia_fim: null, faixa_min: 7350.01, faixa_max: null,     aliquota: 0.2750, parcela_deduzir: 908.73 },
]

// INSS 2025 brackets (to test vigência exclusion)
const BRACKETS_2025: InssBracket[] = [
  { vigencia_inicio: '2025-01-01', vigencia_fim: '2025-12-31', faixa_min: 0, faixa_max: 8000.00, aliquota: 0.11, parcela_deduzir: 0, teto: 8000.00 },
]

// ─── computeInss — TRIB-02 (Pitfall 3: teto cap) ─────────────────────────────

describe('tax-tables.ts — computeInss 11pct flat (Pitfall 3: teto cap)', () => {
  it('src/lib/financeiro/tax-tables.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(TAX_MOD)).toBe(true)
  })

  it('computeInss(5000, "11pct", BRACKETS_2026) → { valor: 550.00, aliquota: 0.11 }', async () => {
    const { computeInss } = await import(TAX_MOD) as {
      computeInss: (valorBruto: number, modalidade: '11pct' | 'progressivo', brackets: InssBracket[]) => { valor: number; aliquota: number }
    }
    const result = computeInss(5000, '11pct', BRACKETS_2026)
    expect(result.valor).toBe(550.00)
    expect(result.aliquota).toBe(0.11)
  })

  it('computeInss(100000, "11pct", BRACKETS_2026) → valor === 932.31 (teto R$ 8475.55 × 11%)', async () => {
    const { computeInss } = await import(TAX_MOD) as {
      computeInss: (valorBruto: number, modalidade: '11pct' | 'progressivo', brackets: InssBracket[]) => { valor: number; aliquota: number }
    }
    // teto 8475.55 × 0.11 = 932.3105 → rounds to 932.31
    const result = computeInss(100000, '11pct', BRACKETS_2026)
    expect(result.valor).toBe(932.31)
  })
})

// ─── computeInss — progressivo (faixa com parcela_deduzir) ───────────────────

describe('tax-tables.ts — computeInss progressivo (parcela_deduzir)', () => {
  it('computeInss(3000, "progressivo", BRACKETS_2026) → valor === 248.60 (faixa 12% − 111.40)', async () => {
    const { computeInss } = await import(TAX_MOD) as {
      computeInss: (valorBruto: number, modalidade: '11pct' | 'progressivo', brackets: InssBracket[]) => { valor: number; aliquota: number }
    }
    // 3000 × 0.12 = 360; 360 − 111.40 = 248.60
    const expected = Math.round((3000 * 0.12 - 111.40) * 100) / 100
    const result = computeInss(3000, 'progressivo', BRACKETS_2026)
    expect(result.valor).toBe(expected) // 248.60
    expect(expected).toBe(248.60)
  })
})

// ─── computeIrrf — TRIB-02 (Lei 15.270/2025) ─────────────────────────────────

describe('tax-tables.ts — computeIrrf isento (≤ R$ 5000)', () => {
  it('computeIrrf(4000, IRRF_2026) → { valor: 0, aliquota: 0 } (isento)', async () => {
    const { computeIrrf } = await import(TAX_MOD) as {
      computeIrrf: (baseCalculo: number, brackets: IrrfBracket[]) => { valor: number; aliquota: number }
    }
    const result = computeIrrf(4000, IRRF_2026)
    expect(result.valor).toBe(0)
    expect(result.aliquota).toBe(0)
  })

  it('computeIrrf(5000, IRRF_2026) → { valor: 0, aliquota: 0 } (exactly at threshold, isento)', async () => {
    const { computeIrrf } = await import(TAX_MOD) as {
      computeIrrf: (baseCalculo: number, brackets: IrrfBracket[]) => { valor: number; aliquota: number }
    }
    const result = computeIrrf(5000, IRRF_2026)
    expect(result.valor).toBe(0)
  })
})

describe('tax-tables.ts — computeIrrf gradual band (R$ 5000.01 – R$ 7350.00)', () => {
  it('computeIrrf(6000, IRRF_2026) → exact gradual band value', async () => {
    const { computeIrrf } = await import(TAX_MOD) as {
      computeIrrf: (baseCalculo: number, brackets: IrrfBracket[]) => { valor: number; aliquota: number }
    }
    // desconto = 978.62 − (0.133145 × 6000) = 978.62 − 798.87 = 179.75
    // bruto = 6000 × 0.275 = 1650
    // valor = max(0, round((1650 − 179.75) × 100) / 100) = round(1470.25) = 1470.25
    const expected = Math.max(0, Math.round((6000 * 0.275 - (978.62 - 0.133145 * 6000)) * 100) / 100)
    const result = computeIrrf(6000, IRRF_2026)
    expect(result.valor).toBe(expected)
  })
})

describe('tax-tables.ts — computeIrrf above R$ 7350 (flat 27.5% − 908.73)', () => {
  it('computeIrrf(10000, IRRF_2026) → exact flat-rate value', async () => {
    const { computeIrrf } = await import(TAX_MOD) as {
      computeIrrf: (baseCalculo: number, brackets: IrrfBracket[]) => { valor: number; aliquota: number }
    }
    // 10000 × 0.275 − 908.73 = 2750 − 908.73 = 1841.27
    const expected = Math.round((10000 * 0.275 - 908.73) * 100) / 100
    const result = computeIrrf(10000, IRRF_2026)
    expect(result.valor).toBe(expected)
    expect(expected).toBe(1841.27)
  })
})

// ─── Pitfall 4: INSS before IRRF (computeRpaWithholdings orchestrator) ────────

describe('tax-tables.ts — computeRpaWithholdings (Pitfall 4: IRRF base = bruto − INSS)', () => {
  it('src/lib/financeiro/tax-tables.ts computeRpaWithholdings exists (RED until Plan 04)', () => {
    expect(existsSync(TAX_MOD)).toBe(true)
  })

  it('computeRpaWithholdings(6000, "11pct", BRACKETS_2026, IRRF_2026, 0) → irrf base is 6000 − 660 = 5340 (NOT 6000)', async () => {
    const { computeRpaWithholdings } = await import(TAX_MOD) as {
      computeRpaWithholdings: (
        valorBruto: number,
        modalidade: '11pct' | 'progressivo',
        brackets: InssBracket[],
        irrfBrackets: IrrfBracket[],
        issAliquota: number
      ) => { inss: number; irrf: number; iss: number; liquido: number }
    }
    const result = computeRpaWithholdings(6000, '11pct', BRACKETS_2026, IRRF_2026, 0)
    // INSS = 6000 × 0.11 = 660 (teto not hit)
    expect(result.inss).toBe(660)
    // IRRF base = 6000 − 660 = 5340 (5340 is in gradual band 5000.01–7350)
    // desconto = 978.62 − 0.133145 × 5340 = 978.62 − 710.79 = 267.83
    // bruto_irrf = 5340 × 0.275 = 1468.5
    // irrf = max(0, round((1468.5 − 267.83) × 100) / 100) = 1200.67
    const expectedIrrf = Math.max(0, Math.round((5340 * 0.275 - (978.62 - 0.133145 * 5340)) * 100) / 100)
    expect(result.irrf).toBe(expectedIrrf)
    // ISS = 0 (aliquota 0)
    expect(result.iss).toBe(0)
    // liquido = 6000 − 660 − irrf − 0
    expect(result.liquido).toBe(Math.round((6000 - 660 - expectedIrrf) * 100) / 100)
  })

  it('IRRF base must NOT be computed on valorBruto directly (Pitfall 4 guard)', async () => {
    const { computeRpaWithholdings } = await import(TAX_MOD) as {
      computeRpaWithholdings: (
        valorBruto: number,
        modalidade: '11pct' | 'progressivo',
        brackets: InssBracket[],
        irrfBrackets: IrrfBracket[],
        issAliquota: number
      ) => { inss: number; irrf: number; iss: number; liquido: number }
    }
    // If IRRF were applied on 6000 (wrong), result would differ from applying on 5340
    const result = computeRpaWithholdings(6000, '11pct', BRACKETS_2026, IRRF_2026, 0)
    const wrongIrrf = Math.max(0, Math.round((6000 * 0.275 - (978.62 - 0.133145 * 6000)) * 100) / 100)
    const correctIrrf = Math.max(0, Math.round((5340 * 0.275 - (978.62 - 0.133145 * 5340)) * 100) / 100)
    // The two bases produce different IRRF values — assert implementation uses the correct (lower) base
    expect(result.irrf).toBe(correctIrrf)
    expect(result.irrf).not.toBe(wrongIrrf)
  })
})

// ─── computeIss — integer-cent, no float drift ────────────────────────────────

describe('tax-tables.ts — computeIss (integer-cent, no float drift)', () => {
  it('computeIss(1200, 0.05) === 60 (integer-cent result)', async () => {
    const { computeIss } = await import(TAX_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    expect(computeIss(1200, 0.05)).toBe(60)
  })

  it('computeIss(1000, 0) === 0 (zero aliquota → zero ISS)', async () => {
    const { computeIss } = await import(TAX_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    expect(computeIss(1000, 0)).toBe(0)
  })

  it('computeIss(333.33, 0.03) has no float drift (result is integer-cent representable)', async () => {
    const { computeIss } = await import(TAX_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    const result = computeIss(333.33, 0.03)
    // result × 100 must be a whole number (no sub-cent remainders)
    expect(Math.round(result * 100)).toBe(result * 100)
  })
})

// ─── selectBracketsByVigencia — temporal selection ───────────────────────────

describe('tax-tables.ts — selectBracketsByVigencia (temporal vigência filtering)', () => {
  it('selectBracketsByVigencia returns 2026 brackets for a 2026 date', async () => {
    const { selectBracketsByVigencia } = await import(TAX_MOD) as {
      selectBracketsByVigencia: <T extends { vigencia_inicio: string; vigencia_fim: string | null }>(rows: T[], date: Date) => T[]
    }
    const all = [...BRACKETS_2026, ...BRACKETS_2025]
    const selected = selectBracketsByVigencia(all, new Date('2026-06-01'))
    // Should include 2026 brackets (vigencia_inicio='2026-01-01', vigencia_fim=null)
    expect(selected.length).toBeGreaterThan(0)
    selected.forEach(b => {
      expect(b.vigencia_inicio).toBe('2026-01-01')
    })
  })

  it('selectBracketsByVigencia excludes 2026-only brackets for a 2025 date', async () => {
    const { selectBracketsByVigencia } = await import(TAX_MOD) as {
      selectBracketsByVigencia: <T extends { vigencia_inicio: string; vigencia_fim: string | null }>(rows: T[], date: Date) => T[]
    }
    const selected = selectBracketsByVigencia(BRACKETS_2026, new Date('2025-06-01'))
    // BRACKETS_2026 have vigencia_inicio='2026-01-01', so none should be selected for 2025
    expect(selected.length).toBe(0)
  })

  it('selectBracketsByVigencia includes bracket with vigencia_fim=null (open-ended current table)', async () => {
    const { selectBracketsByVigencia } = await import(TAX_MOD) as {
      selectBracketsByVigencia: <T extends { vigencia_inicio: string; vigencia_fim: string | null }>(rows: T[], date: Date) => T[]
    }
    // 2026 brackets have vigencia_fim=null (still active); should be selected for any 2026+ date
    const selected = selectBracketsByVigencia(BRACKETS_2026, new Date('2030-01-01'))
    expect(selected.length).toBe(BRACKETS_2026.length)
  })
})
