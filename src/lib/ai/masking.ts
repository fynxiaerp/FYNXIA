// src/lib/ai/masking.ts
// PII masking helpers for copilot tool outputs (D-01 / AI-01)
// Keep last 2 digits of CPF; keep last 4 digits of phone — never expose raw PII to LLM
import 'server-only'

/**
 * maskCPF — masks a Brazilian CPF, keeping only the last 2 digits.
 *
 * Input can be formatted (123.456.789-00) or raw digits (12345678900).
 * Output: ***.***.***-XX where XX is the last 2 digits.
 *
 * Examples:
 *   maskCPF('123.456.789-00') → '***.***.***-00'
 *   maskCPF('12345678900')    → '***.***.***-00'
 *   maskCPF('')               → ''
 */
export function maskCPF(cpf: string): string {
  if (!cpf) return ''
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return '***.***.***-**'
  const last2 = digits.slice(9, 11) // verifier digits (positions 9-10)
  return `***.***.***-${last2}`
}

/**
 * maskPhone — masks a Brazilian phone number, keeping only the last 4 digits.
 *
 * Input can be formatted or raw digits.
 * Output: (**) *****-XXXX for mobile (11 digits) or (**) ****-XXXX for landline (10 digits).
 *
 * Examples:
 *   maskPhone('(11) 99999-1234') → '(**) *****-1234'
 *   maskPhone('11999991234')     → '(**) *****-1234'
 *   maskPhone('')                → ''
 */
export function maskPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  const last4 = digits.slice(-4)
  if (digits.length === 11) {
    // Mobile: DDD (2) + 9 (1) + number (8) → (XX) 9****-XXXX
    return `(**) *****-${last4}`
  }
  if (digits.length === 10) {
    // Landline: DDD (2) + number (8) → (XX) ****-XXXX
    return `(**) ****-${last4}`
  }
  // Fallback: mask all but last 4
  const masked = '*'.repeat(Math.max(0, digits.length - 4))
  return `${masked}${last4}`
}
