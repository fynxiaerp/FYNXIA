// src/lib/crc/roi-math.ts
// Pure CPL/CAC/NPS math for Phase 18 (CRC & Marketing) — no imports, no I/O, no PII.
// Zero-denominator inputs return null (rendered as "—" by the UI) instead of
// Infinity/NaN — this is the single place D-06/D-14 arithmetic is enforced,
// per 18-RESEARCH.md "Don't Hand-Roll" (avoid ad-hoc inline arithmetic).
//
// Requirements: CRC-02 (CPL/CAC), CRC-04 (NPS classification/score)

/**
 * Custo Por Lead = custo total da campanha / número de leads.
 * Returns null when leads is 0 (never Infinity/NaN — D-06).
 */
export function computeCpl(cost: number, leads: number): number | null {
  if (leads === 0) return null
  return cost / leads
}

/**
 * Custo de Aquisição de Cliente = custo total da campanha / número de
 * pacientes convertidos. Returns null when converted is 0 (never Infinity/NaN — D-06).
 */
export function computeCac(cost: number, converted: number): number | null {
  if (converted === 0) return null
  return cost / converted
}

export type NpsBucket = 'promotor' | 'neutro' | 'detrator'

/**
 * Classifies a single NPS score (0-10) into the standard NPS bucket (D-14):
 *   9-10 → promotor, 7-8 → neutro, 0-6 → detrator.
 * Throws RangeError for scores outside [0, 10].
 */
export function classifyNps(score: number): NpsBucket {
  if (score < 0 || score > 10) {
    throw new RangeError(`classifyNps: score must be between 0 and 10, got ${score}`)
  }
  if (score >= 9) return 'promotor'
  if (score >= 7) return 'neutro'
  return 'detrator'
}

/**
 * NPS = %promotores - %detratores, rounded to the nearest integer (D-14).
 * Returns null for an empty array (no responses yet — rendered as "—").
 */
export function computeNpsScore(scores: number[]): number | null {
  if (scores.length === 0) return null

  let promotores = 0
  let detratores = 0
  for (const score of scores) {
    const bucket = classifyNps(score)
    if (bucket === 'promotor') promotores++
    else if (bucket === 'detrator') detratores++
  }

  const total = scores.length
  const pctPromotores = (promotores / total) * 100
  const pctDetratores = (detratores / total) * 100
  return Math.round(pctPromotores - pctDetratores)
}
