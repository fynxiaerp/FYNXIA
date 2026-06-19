/**
 * cycle-status.ts — CME block-guard logic (PURE)
 *
 * Phase 13 (CME-02): isCycleUsable encodes the patient-safety rule:
 *   a kit may only be used if its sterilization cycle has biological_result === 'aprovado'
 *   AND the material has not passed its validade (expiry date).
 *
 * PURE: no server directives, no Supabase.
 * Importable in both server actions (Plan 04 authoritative enforcement) and
 * client components (non-blocking pre-warning in the UI).
 *
 * Date comparison: ISO YYYY-MM-DD strings sort lexicographically in the same order
 * as chronological order — strict string comparison is correct for date comparison.
 * Expiry rule: validade < referenceDate means expired (validade === today is still valid).
 */

export type BiologicalResult = 'pendente' | 'aprovado' | 'reprovado'
export type CycleStatus = 'aprovado' | 'reprovado' | 'vencido'

/** Returns today's date as YYYY-MM-DD ISO string (UTC) */
const today = (): string => new Date().toISOString().slice(0, 10)

/**
 * Returns true if the cycle's sterilized material has expired.
 * Expiry is STRICT: validade < referenceDate.
 * validade === referenceDate (same day) is NOT expired.
 * validade === null means no expiry recorded — never expired.
 */
const isExpired = (validade: string | null, ref: string): boolean =>
  validade !== null && validade < ref

/**
 * deriveCycleStatus — determines the effective cycle status given the biological
 * indicator result and the validade date.
 *
 * Rules (CME-01 + CME-02):
 *   - 'reprovado' → 'reprovado' (indicator failed — regardless of validade)
 *   - 'pendente'  → 'pendente'  (indicator result not yet read)
 *   - 'aprovado'  + validade < today → 'vencido' (material expired)
 *   - 'aprovado'  + validade >= today (or null) → 'aprovado' (safe to use)
 */
export function deriveCycleStatus(params: {
  biologicalResult: BiologicalResult
  validade: string | null
  referenceDate?: string
}): CycleStatus | 'pendente' {
  const { biologicalResult, validade, referenceDate } = params
  const ref = referenceDate ?? today()

  if (biologicalResult === 'reprovado') return 'reprovado'
  if (biologicalResult === 'pendente') return 'pendente'
  // biologicalResult === 'aprovado'
  if (isExpired(validade, ref)) return 'vencido'
  return 'aprovado'
}

/**
 * isCycleUsable — returns the patient-safety block decision (CME-02).
 *
 * usable=false cases:
 *   - biological indicator 'reprovado' (failed — cycle must not be used)
 *   - biological indicator 'pendente' (result not read yet — cycle not cleared)
 *   - 'aprovado' but validade < referenceDate (material expired)
 *
 * usable=true:
 *   - 'aprovado' AND (validade === null OR validade >= referenceDate)
 *
 * Never throws — designed to be called defensively in the UI and in Server Actions.
 */
export function isCycleUsable(params: {
  biologicalResult: BiologicalResult
  validade: string | null
  referenceDate?: string
}): { usable: boolean; reason: string | null } {
  const { biologicalResult, validade, referenceDate } = params
  const ref = referenceDate ?? today()

  if (biologicalResult === 'reprovado') {
    return {
      usable: false,
      reason: 'Ciclo com indicador biológico reprovado — uso bloqueado',
    }
  }

  if (biologicalResult === 'pendente') {
    return {
      usable: false,
      reason: 'Indicador biológico pendente — ciclo ainda não aprovado para uso',
    }
  }

  // biologicalResult === 'aprovado'
  if (isExpired(validade, ref)) {
    return {
      usable: false,
      reason: 'Ciclo vencido (validade expirada) — uso bloqueado',
    }
  }

  return { usable: true, reason: null }
}
