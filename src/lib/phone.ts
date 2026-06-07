// src/lib/phone.ts
// Brazilian phone normalizer — converts user-entered phone strings to E.164.
// Pure function (no 'server-only') — safe to import anywhere including tests.

/**
 * Converts a user-entered Brazilian phone string to E.164 format (+55...).
 *
 * Rules:
 *  1. Strip all non-digit characters.
 *  2. If result is empty → return null (unusable).
 *  3. If result starts with "55" and is 12–13 digits → prepend "+".
 *  4. Otherwise (local 10–11 digit number) → prepend "+55".
 *  5. If the raw input already started with "+55" and stripping yields >=12 digits → preserve.
 *
 * Returns null for unusable input (callers should skip the channel).
 *
 * Examples:
 *   "(11) 99999-9999" → "+5511999999999"
 *   "11999999999"     → "+5511999999999"
 *   "+5511999999999"  → "+5511999999999"
 *   "5511999999999"   → "+5511999999999"
 *   ""               → null
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

  if (digits.length === 0) return null

  // Already has country code 55 prefix and is 12–13 digits (e.g. "5511999999999")
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`
  }

  // Local Brazilian number: 10 digits (DDD + 8-digit) or 11 digits (DDD + 9-digit)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  // Anything else (too short, too long, or unexpected format) → null
  return null
}
