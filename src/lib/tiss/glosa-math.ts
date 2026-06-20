/**
 * src/lib/tiss/glosa-math.ts — Pure glosa math utilities (D-28, CONV-03)
 *
 * computeGuiaGlosaTotals: integer-cent sum of item-level glosa values.
 * deriveGuideStatus: Pitfall 5 — guide status is DERIVED from items, never set directly.
 *
 * Priority order (D-28 / Pitfall 5):
 *   any item em_recurso  → guide 'recurso'
 *   any item glosada     → guide 'glosada'
 *   all items paga       → guide 'paga'
 *   default              → guide 'em_analise'
 *
 * Integer-cent arithmetic prevents floating-point drift when summing BRL values.
 *
 * Pure functions — no side effects, no imports, safe in any context.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 * Requirements: CONV-03, D-28
 */

// ─── computeGuiaGlosaTotals ───────────────────────────────────────────────────

export interface GlosaTotals {
  valorTotal: number
  valorGlosado: number
  valorAutorizado: number
  glosaRate: number
}

/**
 * Compute guide-level glosa totals from item-level data.
 *
 * Uses integer-cent math to prevent decimal drift:
 *   glosadoCents = round(sum * 100); result = glosadoCents / 100
 *
 * The test uses camelCase keys (valorTotal / valorGlosado) — match that contract.
 */
export function computeGuiaGlosaTotals(
  items: { valorTotal: number; valorGlosado: number }[],
): GlosaTotals {
  if (!items || items.length === 0) {
    return { valorTotal: 0, valorGlosado: 0, valorAutorizado: 0, glosaRate: 0 }
  }

  // Integer-cent summation (RESEARCH lines 1003-1018)
  const totalCents = items.reduce((s, i) => s + Math.round(i.valorTotal * 100), 0)
  const glosadoCents = items.reduce((s, i) => s + Math.round(i.valorGlosado * 100), 0)

  const valorTotal = totalCents / 100
  const valorGlosado = glosadoCents / 100
  const valorAutorizado = (totalCents - glosadoCents) / 100
  const glosaRate = totalCents > 0 ? glosadoCents / totalCents : 0

  return { valorTotal, valorGlosado, valorAutorizado, glosaRate }
}

// ─── deriveGuideStatus ────────────────────────────────────────────────────────

export type GuideStatus = 'em_analise' | 'glosada' | 'recurso' | 'paga' | 'autorizada'

/**
 * Derive guide status from items' individual glosa_status values (Pitfall 5).
 *
 * Priority order (must be applied in this exact sequence):
 *   1. Any item 'em_recurso'  → guide 'recurso'
 *   2. Any item 'glosada'     → guide 'glosada'
 *   3. All items 'paga' (and items.length > 0) → guide 'paga'
 *   4. Default               → guide 'em_analise'
 *
 * This prevents a single recurso from hiding a glosada, and a single glosada
 * from falsely marking the whole guide as paga.
 */
export function deriveGuideStatus(
  items: { glosa_status: string | null }[],
): GuideStatus {
  if (!items || items.length === 0) {
    return 'em_analise'
  }

  const statuses = items.map((i) => i.glosa_status ?? 'pendente')

  // Priority 1: any em_recurso → recurso
  if (statuses.some((s) => s === 'em_recurso')) {
    return 'recurso'
  }

  // Priority 2: any glosada → glosada
  if (statuses.some((s) => s === 'glosada')) {
    return 'glosada'
  }

  // Priority 3: all items paga → paga
  if (statuses.length > 0 && statuses.every((s) => s === 'paga')) {
    return 'paga'
  }

  // Default
  return 'em_analise'
}
