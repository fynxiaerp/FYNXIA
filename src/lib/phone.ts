// src/lib/phone.ts
// Brazilian phone normalizer — converts user-entered phone strings to E.164.
// Pure function (no 'server-only') — safe to import anywhere including tests.

// Valid Brazilian area codes (DDDs). Numbers with any other 2-digit prefix are
// rejected up front so malformed data never reaches the paid Meta WhatsApp API.
const VALID_DDDS = new Set<string>([
  // SP
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // RJ / ES
  '21', '22', '24', '27', '28',
  // MG
  '31', '32', '33', '34', '35', '37', '38',
  // PR / SC
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // RS
  '51', '53', '54', '55',
  // Centro-Oeste / TO / RO / AC
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  // BA / SE
  '71', '73', '74', '75', '77', '79',
  // Nordeste
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  // Norte
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

/**
 * Validates the national (DDD + subscriber) portion of a Brazilian number.
 *
 * Accepts:
 *  - 11 digits: DDD (2) + mobile (9) where the subscriber number starts with '9'.
 *  - 10 digits: DDD (2) + landline (8) where the first subscriber digit is 2–5
 *    (the valid range for fixed lines). NOTE: landlines cannot receive WhatsApp
 *    template messages — callers must treat these as email-only.
 *
 * Rejects unknown DDDs and mobile numbers missing the leading 9.
 */
function isValidBrNational(national: string): boolean {
  if (national.length !== 10 && national.length !== 11) return false

  const ddd = national.slice(0, 2)
  if (!VALID_DDDS.has(ddd)) return false

  const subscriber = national.slice(2)

  if (subscriber.length === 9) {
    // Mobile: must start with 9 (the mandatory 9th digit).
    return subscriber.startsWith('9')
  }

  // Landline (8 digits): first digit is 2–5 for valid fixed lines.
  return /^[2-5]/.test(subscriber)
}

/**
 * Converts a user-entered Brazilian phone string to E.164 format (+55...).
 *
 * Validation (WR-05):
 *  1. Strip all non-digit characters.
 *  2. Drop a leading "55" country code if present.
 *  3. Require a valid DDD and a structurally valid mobile (DDD + 9 + 8 digits)
 *     or landline (DDD + 8 digits) national number.
 *  4. Return null for anything else so the caller skips the channel rather than
 *     paying the Meta API for a number it will reject.
 *
 * Examples:
 *   "(11) 99999-9999" → "+5511999999999"
 *   "11999999999"     → "+5511999999999"
 *   "+5511999999999"  → "+5511999999999"
 *   "5511999999999"   → "+5511999999999"
 *   "1199999999"      → null  (mobile missing leading 9)
 *   "0099999999999"   → null  (invalid DDD)
 *   ""               → null
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null

  let digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null

  // Strip a leading country code: a 12–13 digit string starting with "55" is
  // "55" + a 10–11 digit national number.
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }

  if (!isValidBrNational(digits)) return null

  return `+55${digits}`
}
