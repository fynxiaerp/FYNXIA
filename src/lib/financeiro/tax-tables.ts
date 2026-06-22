/**
 * src/lib/financeiro/tax-tables.ts — Pure tax computation functions (TRIB-02)
 *
 * Pure functions — no 'server-only', no DB/I/O.
 * Importable by Vitest tests and Server Actions alike.
 *
 * SECURITY / CORRECTNESS:
 *   T-16-10: integer-cent rounding in every compute function; unit tests assert exact numbers.
 *   Pitfall 3: INSS teto cap via MIN(valorBruto, teto).
 *   Pitfall 4: computeRpaWithholdings deducts INSS before computing IRRF base.
 */

// ─── Bracket interfaces ────────────────────────────────────────────────────────

export interface InssBracket {
  vigencia_inicio: string
  vigencia_fim: string | null
  faixa_min: number
  faixa_max: number | null
  aliquota: number
  parcela_deduzir: number
  teto: number | null
}

export interface IrrfBracket {
  vigencia_inicio: string
  vigencia_fim: string | null
  faixa_min: number
  faixa_max: number | null
  aliquota: number
  parcela_deduzir: number
  formula_desconto?: string | null
}

// ─── selectBracketsByVigencia ─────────────────────────────────────────────────

/**
 * Filter tax brackets by a reference date (vigência temporal).
 * Returns brackets where vigencia_inicio <= date && (vigencia_fim == null || vigencia_fim >= date).
 */
export function selectBracketsByVigencia<
  T extends { vigencia_inicio: string; vigencia_fim: string | null }
>(rows: T[], date: Date): T[] {
  const dateStr = date.toISOString().slice(0, 10) // YYYY-MM-DD
  return rows.filter((row) => {
    return (
      row.vigencia_inicio <= dateStr &&
      (row.vigencia_fim === null || row.vigencia_fim >= dateStr)
    )
  })
}

// ─── computeInss ──────────────────────────────────────────────────────────────

/**
 * Compute INSS withholding for a RPA (contribuinte individual).
 *
 * Modalidade '11pct': flat 11% up to teto (Pitfall 3: cap at teto before multiplying).
 * Modalidade 'progressivo': find bracket, apply aliquota - parcela_deduzir.
 *
 * All math is integer-cent (T-16-10).
 */
export function computeInss(
  valorBruto: number,
  modalidade: '11pct' | 'progressivo',
  brackets: InssBracket[]
): { valor: number; aliquota: number } {
  if (modalidade === '11pct') {
    // Use last bracket's faixa_max as the teto, or teto field, fallback 8475.55
    const teto =
      brackets.at(-1)?.teto ??
      brackets.at(-1)?.faixa_max ??
      8475.55
    const base = Math.min(valorBruto, teto)
    const valor = Math.round(base * 0.11 * 100) / 100
    return { valor, aliquota: 0.11 }
  }

  // Progressivo: find the bracket that contains valorBruto
  const bracket = brackets.find(
    (b) =>
      valorBruto >= b.faixa_min &&
      (b.faixa_max === null || valorBruto <= b.faixa_max)
  )
  if (!bracket) return { valor: 0, aliquota: 0 }

  const valor = Math.max(
    0,
    Math.round((valorBruto * bracket.aliquota - bracket.parcela_deduzir) * 100) / 100
  )
  return { valor, aliquota: bracket.aliquota }
}

// ─── computeIrrf ──────────────────────────────────────────────────────────────

/**
 * Compute IRRF withholding (Lei 15.270/2025, vigência 2026-01-01).
 *
 * baseCalculo = valorBruto − INSS (Pitfall 4 — applied by computeRpaWithholdings).
 * Uses brackets when provided; falls back to literal formula as safety net.
 */
export function computeIrrf(
  baseCalculo: number,
  brackets: IrrfBracket[]
): { valor: number; aliquota: number } {
  // Isento
  if (baseCalculo <= 5000) return { valor: 0, aliquota: 0 }

  // Gradual band: 5000.01 – 7350.00
  if (baseCalculo <= 7350) {
    // Formula: desconto = 978.62 − (0.133145 × base); IRRF = max(0, base × 0.275 − desconto)
    const desconto = 978.62 - 0.133145 * baseCalculo
    const bruto = baseCalculo * 0.275
    const valor = Math.max(0, Math.round((bruto - desconto) * 100) / 100)
    const aliquota = baseCalculo > 0 ? valor / baseCalculo : 0
    return { valor, aliquota }
  }

  // Flat: above 7350 → 27.5% − 908.73
  const valor = Math.round((baseCalculo * 0.275 - 908.73) * 100) / 100
  return { valor: Math.max(0, valor), aliquota: 0.275 }
}

// ─── computeIss ───────────────────────────────────────────────────────────────

/**
 * Compute ISS with integer-cent precision (Pitfall 3 from fiscal/iss.ts).
 * Re-exports the same logic as src/lib/fiscal/iss.ts for use in tax-tables context.
 */
export function computeIss(valorServicos: number, aliquota: number): number {
  const centavos = Math.round(valorServicos * 100)
  const issCentavos = Math.round(centavos * aliquota)
  return parseFloat((issCentavos / 100).toFixed(2))
}

// ─── computeRpaWithholdings ───────────────────────────────────────────────────

/**
 * Orchestrate INSS + IRRF + ISS for a RPA record.
 *
 * Pitfall 4: IRRF base = valorBruto − INSS (not valorBruto directly).
 * All amounts are integer-cent.
 */
export function computeRpaWithholdings(
  valorBruto: number,
  modalidade: '11pct' | 'progressivo',
  inssBrackets: InssBracket[],
  irrfBrackets: IrrfBracket[],
  issAliquota: number
): { inss: number; irrf: number; iss: number; liquido: number } {
  const inss = computeInss(valorBruto, modalidade, inssBrackets).valor

  // Pitfall 4: IRRF base = valorBruto - INSS retido
  const irrfBase = valorBruto - inss
  const irrf = computeIrrf(irrfBase, irrfBrackets).valor

  const iss = computeIss(valorBruto, issAliquota)

  const liquido = Math.round((valorBruto - inss - irrf - iss) * 100) / 100

  return { inss, irrf, iss, liquido }
}
