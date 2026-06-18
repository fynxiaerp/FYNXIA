/**
 * formatDocNumber — PURE helper (RX-01/RX-03)
 *
 * Formats a sequential document number for clinical documents:
 *   formatDocNumber('receita_simples', 42, 2026) === 'REC-2026-0042'
 *
 * Format: {PREFIX}-{YYYY}-{NNNN}
 *   PREFIX: 3-letter code per doc_type (see DOC_TYPE_PREFIX)
 *   YYYY:   4-digit year (passed explicitly for determinism)
 *   NNNN:   seq zero-padded to 4 digits (e.g. 1 → '0001', 100 → '0100')
 *
 * PURE — no 'use server', no Supabase, no server-only imports.
 * The seq value comes from next_doc_number() Postgres RPC (Plan 12-02 migration).
 * The year comes from the Server Action (Plan 04) using new Date().getFullYear().
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 02
 * Requirements: RX-01, RX-03
 */

export type ClinicalDocType =
  | 'receita_simples'
  | 'receita_controle_especial'
  | 'atestado'
  | 'solicitacao_exame'

/**
 * Maps each clinical document type to its 3-letter prefix.
 * Mirrors the CASE statement in next_doc_number() Postgres function.
 */
export const DOC_TYPE_PREFIX: Record<ClinicalDocType, string> = {
  receita_simples: 'REC',
  receita_controle_especial: 'RCC',
  atestado: 'ATE',
  solicitacao_exame: 'EXM',
}

/**
 * Format a doc_number from components.
 *
 * @param docType  - The clinical document type (must be one of ClinicalDocType)
 * @param seq      - The sequential counter value from next_doc_number() RPC
 * @param year     - The 4-digit year (e.g. new Date().getFullYear())
 * @returns        - Formatted string e.g. 'REC-2026-0042'
 */
export function formatDocNumber(docType: ClinicalDocType, seq: number, year: number): string {
  const prefix = DOC_TYPE_PREFIX[docType]
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}
