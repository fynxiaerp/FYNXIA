/**
 * Pure scheduling helpers: waiting-room / presence state (RES-03)
 *
 * PURE module — no 'use server', no 'server-only', no Supabase imports.
 * Importable in client components (TV panel), server components, and tests alike.
 *
 * waitingMinutes: computes patient wait time from arrival to call (or to now).
 * PRESENCE_FLOW: ordered list of presence states for the check-in state machine.
 * isValidPresenceTransition: enforces one-step-forward-only transitions.
 */

/**
 * The four presence states in order.
 * NULL (pre-checkin) → 'aguardando' is the initial transition (patient arrives).
 */
export const PRESENCE_FLOW = [
  'aguardando',
  'chamado',
  'em_atendimento',
  'finalizado',
] as const

export type PresenceStatus = (typeof PRESENCE_FLOW)[number]

/**
 * Returns the waiting time in minutes.
 *
 * - If arrivedAt is null → returns null (patient has not checked in).
 * - If calledAt is provided → minutes between arrivedAt and calledAt.
 * - If calledAt is null   → minutes between arrivedAt and `now` (still waiting).
 *
 * @param arrivedAt - ISO timestamp string when patient arrived, or null.
 * @param calledAt  - ISO timestamp string when receptionist called, or null.
 * @param now       - Reference point for "still waiting" calculation. Defaults to new Date().
 */
export function waitingMinutes(
  arrivedAt: string | null,
  calledAt: string | null,
  now: Date = new Date(),
): number | null {
  if (!arrivedAt) return null
  const arrived = new Date(arrivedAt)
  const end = calledAt ? new Date(calledAt) : now
  return Math.round((end.getTime() - arrived.getTime()) / 60000)
}

/**
 * Returns true if the transition from→to is exactly one step forward in PRESENCE_FLOW.
 * from=null is treated as the pre-arrival state, allowing the first transition to 'aguardando'.
 *
 * Valid: null→aguardando, aguardando→chamado, chamado→em_atendimento, em_atendimento→finalizado
 * Invalid: aguardando→finalizado (skips states), backwards transitions, etc.
 */
export function isValidPresenceTransition(
  from: string | null,
  to: string,
): boolean {
  if (from === null) {
    return to === PRESENCE_FLOW[0]
  }
  const fromIdx = PRESENCE_FLOW.indexOf(from as PresenceStatus)
  const toIdx = PRESENCE_FLOW.indexOf(to as PresenceStatus)
  if (fromIdx === -1 || toIdx === -1) return false
  return toIdx === fromIdx + 1
}
