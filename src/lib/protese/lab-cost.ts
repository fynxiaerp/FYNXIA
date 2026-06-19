/**
 * Pure helpers for Laboratório de Prótese cost logic (LAB-02).
 *
 * PURE — no 'use server', no 'server-only'. Safe to import in both
 * server actions and client components.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 03
 * Requirements: LAB-01, LAB-02
 */

/**
 * Returns true iff a lab order cost should trigger a financial_transactions
 * despesa entry (LAB-02). Zero, null, and negative values are not postable.
 */
export function isCostPostable(cost: number | null): boolean {
  return cost !== null && cost > 0
}

/**
 * Builds a human-readable pt-BR description for the despesa created in
 * financial_transactions when a lab order cost is posted (LAB-02).
 *
 * The returned string always includes orderNumber, prosthesisType, and labName
 * so the cash-flow entry is traceable back to the OS protética.
 */
export function buildLabExpenseDescription(params: {
  labName: string
  prosthesisType: string
  orderNumber: string
}): string {
  const { labName, prosthesisType, orderNumber } = params
  return `OS protética ${orderNumber} — ${prosthesisType} (${labName})`
}
