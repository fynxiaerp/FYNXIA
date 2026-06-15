/**
 * panel.ts — Pure panel-row helpers for the waiting-room TV display (RES-03)
 *
 * PURE module — no 'use server', no 'server-only', no Supabase imports.
 * Importable from client components (WaitingPanel), server components, and tests alike.
 *
 * LGPD contract (Pitfall 3):
 *   PanelRow NEVER contains full_name or cpf — only initials + presence metadata.
 *   Initials are computed server-side from full_name before the row reaches the client.
 */

// ─── PanelRow ─────────────────────────────────────────────────────────────────
// The LGPD-safe shape passed to the TV panel client component.
// full_name and cpf are intentionally ABSENT.

export interface PanelRow {
  id: string
  presence_status: string
  initials: string
  arrived_at: string | null
  called_at: string | null
}

// ─── toInitials ───────────────────────────────────────────────────────────────
/**
 * Convert a patient full name to privacy-safe initials.
 *
 * Rules:
 *   - Split on whitespace; take the first letter of the first and last distinct tokens
 *     (ignoring particles such as "da", "de", "do", "das", "dos" that are lowercase
 *     single/double-letter words) — up to 2 tokens.
 *   - Each initial is uppercased and joined with '.', with a trailing '.'.
 *   - Empty / null / undefined → "?".
 *
 * Examples:
 *   "João da Silva"  → "J.S."
 *   "Maria"         → "M."
 *   "Ana de Souza"  → "A.S."
 *   null            → "?"
 *   ""              → "?"
 */
export function toInitials(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return '?'

  // Split into tokens, filter out empty strings
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return '?'

  if (tokens.length === 1) {
    const first = tokens[0]!
    return first[0]!.toUpperCase() + '.'
  }

  // Pick first and last token (first and last name); join as initials
  const firstToken = tokens[0]!
  const lastToken = tokens[tokens.length - 1]!

  const firstInitial = firstToken[0]!.toUpperCase()
  const lastInitial = lastToken[0]!.toUpperCase()

  return `${firstInitial}.${lastInitial}.`
}
