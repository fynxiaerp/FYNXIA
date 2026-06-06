// ─── BRL Money Formatting Helpers ────────────────────────────────────────────
// Pure client/server helpers — no 'use server' / 'use client' directive.
// Used by: CashFlowTotals, TransactionList, ReceivablesTable, ChargeForm, ReceiboPDF
//
// UI-SPEC §Money Formatting Contract:
//   - toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) → R$ 1.234,56
//   - Negative amounts use U+2212 (−) not hyphen
//   - Zero value: R$ 0,00 (never blank)
//
// D-04: vencido derived at read-time — never stored in DB
//   CHECK constraint is ('pendente','pago','estornado'); 'vencido' is UI-only

import { isPast, parseISO } from 'date-fns'

/**
 * Format a number as Brazilian Real currency.
 * Output: "R$ 1.234,56"
 */
export function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Format a number as signed BRL string for cash flow display.
 * Entrada: "+R$ 1.234,56" in text-green-700
 * Saída:   "−R$ 1.234,56" in text-red-600  (U+2212 true minus)
 */
export function formatBRLSigned(
  amount: number,
  direction: 'entrada' | 'saida'
): string {
  const base = formatBRL(Math.abs(amount))
  return direction === 'entrada' ? `+${base}` : `−${base}`
}

/**
 * Derive receivable display status at read-time (D-04).
 * The DB only stores 'pendente' | 'pago' | 'estornado'.
 * 'vencido' is derived here: status !== 'pago' AND due_date is in the past.
 *
 * @param status  - The stored DB status string
 * @param dueDate - ISO date string "YYYY-MM-DD"
 * @returns 'pendente' | 'pago' | 'vencido' | 'estornado'
 */
export function deriveReceivableStatus(
  status: string,
  dueDate: string
): 'pendente' | 'pago' | 'vencido' | 'estornado' {
  if (status === 'pago') return 'pago'
  if (status === 'estornado') return 'estornado'
  // For pendente: check if past due
  if (isPast(parseISO(dueDate))) return 'vencido'
  return 'pendente'
}
