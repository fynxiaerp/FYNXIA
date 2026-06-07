// src/lib/cron-auth.ts
// Shared CRON_SECRET authorization for Vercel Cron endpoints.
//
// SECURITY (CR-01): fail CLOSED and use a constant-time comparison.
//  - If CRON_SECRET is unset/empty (misconfiguration, missing Vercel env on a
//    preview deploy), reject EVERYTHING — never accept "Bearer undefined".
//  - Use crypto.timingSafeEqual over equal-length buffers (length guarded first)
//    so the `!==` string compare can no longer leak timing information.
import 'server-only'

import { timingSafeEqual } from 'crypto'

/**
 * Validates a Vercel Cron Authorization header against CRON_SECRET.
 *
 * Returns false (reject) when:
 *  - CRON_SECRET is unset or empty (fail closed — misconfiguration),
 *  - no Authorization header was supplied,
 *  - the header does not constant-time match `Bearer {CRON_SECRET}`.
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  // Fail closed: no secret configured → reject everything.
  if (!secret) return false
  if (!authHeader) return false

  const a = Buffer.from(authHeader)
  const b = Buffer.from(`Bearer ${secret}`)
  // Length guard required: timingSafeEqual throws on unequal-length buffers.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
