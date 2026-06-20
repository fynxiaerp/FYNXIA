/**
 * OS Math & State Machine Helpers — Phase 15 / Plan 05
 *
 * Pure helpers: no 'use server', no Supabase client. Importable by tests,
 * server actions, and any module that needs OS-domain math or transitions.
 *
 * D-25: integer-cent arithmetic — avoids IEEE-754 float drift on BRL values.
 * OS-01: isValidOsTransition enforces the rascunho → faturada/cancelada
 *        state machine (faturada ↛ rascunho; cancelada → nothing).
 */

// ─── OS total (D-25) ─────────────────────────────────────────────────────────
/**
 * Computes the OS total using integer-cent math to avoid float drift.
 *
 *   total = sum(item.valorTotal) - descontoTotal + acrescimoTotal
 *
 * All arithmetic is done in integer cents (×100) and divided at the end.
 * This guarantees 0.1 + 0.2 = 0.3 (not 0.30000000000000004).
 */
export function computeOsTotal(
  items: { valorTotal: number }[],
  descontoTotal: number,
  acrescimoTotal: number,
): number {
  const itemsCents = items.reduce((sum, item) => sum + Math.round(item.valorTotal * 100), 0)
  const descontoCents = Math.round(descontoTotal * 100)
  const acrescimoCents = Math.round(acrescimoTotal * 100)
  const totalCents = itemsCents - descontoCents + acrescimoCents
  return totalCents / 100
}

// ─── Item total ───────────────────────────────────────────────────────────────
/**
 * Computes a single line-item total using integer-cent math.
 *
 *   valorTotal = (valorUnitario × quantity) - desconto
 */
export function computeItemTotal(
  valorUnitario: number,
  quantity: number,
  desconto: number,
): number {
  const unitCents = Math.round(valorUnitario * 100)
  const descontoCents = Math.round(desconto * 100)
  const totalCents = unitCents * quantity - descontoCents
  return totalCents / 100
}

// ─── OS state machine (OS-01) ─────────────────────────────────────────────────
/**
 * Allowed status transitions for service_orders.
 *
 *   rascunho → faturada | cancelada
 *   faturada → cancelada  (requires alçada — enforced at action layer, D-19)
 *   cancelada → (nothing)
 */
const VALID_OS_TRANSITIONS: Record<string, string[]> = {
  rascunho: ['faturada', 'cancelada'],
  faturada: ['cancelada'],
  cancelada: [],
}

/**
 * Returns true iff `from → to` is a legal OS status transition.
 */
export function isValidOsTransition(from: string, to: string): boolean {
  const allowed = VALID_OS_TRANSITIONS[from] ?? []
  return allowed.includes(to)
}
