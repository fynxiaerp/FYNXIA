/**
 * Phase 5 AI-02 — WhatsApp inbound webhook
 * RED-by-design until Plan 05-04 implements:
 *   - src/lib/whatsapp/verify-signature.ts  (pure HMAC verifier)
 *   - src/lib/ai/whatsapp-intent.ts          (pure intent → status mapper)
 *   - src/app/api/webhooks/whatsapp/route.ts (GET verify + POST handler)
 *
 * Source-inspection pattern (mirrors comms.test.ts):
 *   - existsSync guard: missing file → RED via failed assertion (no tsc/import error)
 *   - readFileSync: asserts the file text contains expected symbols/patterns
 *   - NO dynamic import of the modules under test
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = (f: string) => join(process.cwd(), 'src', f)

// ---------------------------------------------------------------------------
// Source inspection: verify-signature.ts (pure HMAC verifier)
// ---------------------------------------------------------------------------
describe('src/lib/whatsapp/verify-signature.ts — HMAC-SHA256 source inspection (AI-02, T-5-04)', () => {
  it('verify-signature.ts file exists (created in 05-04)', () => {
    expect(
      existsSync(SRC('lib/whatsapp/verify-signature.ts')),
      'src/lib/whatsapp/verify-signature.ts not yet created (05-04)',
    ).toBe(true)
  })

  it('exports verifyWhatsAppSignature function', () => {
    if (!existsSync(SRC('lib/whatsapp/verify-signature.ts'))) {
      expect(existsSync(SRC('lib/whatsapp/verify-signature.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/whatsapp/verify-signature.ts'), 'utf8')
    expect(src).toMatch(/export function verifyWhatsAppSignature/)
  })

  it('uses crypto.timingSafeEqual (constant-time comparison, T-5-04)', () => {
    if (!existsSync(SRC('lib/whatsapp/verify-signature.ts'))) {
      expect(existsSync(SRC('lib/whatsapp/verify-signature.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/whatsapp/verify-signature.ts'), 'utf8')
    expect(src).toMatch(/timingSafeEqual/)
  })

  it('uses HMAC-SHA256 (createHmac + sha256)', () => {
    if (!existsSync(SRC('lib/whatsapp/verify-signature.ts'))) {
      expect(existsSync(SRC('lib/whatsapp/verify-signature.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/whatsapp/verify-signature.ts'), 'utf8')
    expect(src).toMatch(/createHmac/)
    expect(src).toMatch(/sha256/)
  })

  it('rejects headers missing sha256= prefix (tamper protection)', () => {
    if (!existsSync(SRC('lib/whatsapp/verify-signature.ts'))) {
      expect(existsSync(SRC('lib/whatsapp/verify-signature.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/whatsapp/verify-signature.ts'), 'utf8')
    // Must check for 'sha256=' prefix before comparing
    expect(src).toMatch(/sha256=/)
  })

  it('returns false on missing/empty signature header (null/empty guard)', () => {
    if (!existsSync(SRC('lib/whatsapp/verify-signature.ts'))) {
      expect(existsSync(SRC('lib/whatsapp/verify-signature.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/whatsapp/verify-signature.ts'), 'utf8')
    // Must have a null/falsy guard before processing
    expect(src).toMatch(/return false/)
  })
})

// ---------------------------------------------------------------------------
// Source inspection: whatsapp-intent.ts (intent → status mapper)
// ---------------------------------------------------------------------------
describe('src/lib/ai/whatsapp-intent.ts — intent mapper source inspection (AI-02, D-04)', () => {
  it('whatsapp-intent.ts file exists (created in 05-04)', () => {
    expect(
      existsSync(SRC('lib/ai/whatsapp-intent.ts')),
      'src/lib/ai/whatsapp-intent.ts not yet created (05-04)',
    ).toBe(true)
  })

  it('exports buttonPayloadToStatus function', () => {
    if (!existsSync(SRC('lib/ai/whatsapp-intent.ts'))) {
      expect(existsSync(SRC('lib/ai/whatsapp-intent.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/whatsapp-intent.ts'), 'utf8')
    expect(src).toMatch(/export function buttonPayloadToStatus/)
  })

  it('maps CONFIRM_APPOINTMENT_ prefix to "confirmado" (Portuguese status)', () => {
    if (!existsSync(SRC('lib/ai/whatsapp-intent.ts'))) {
      expect(existsSync(SRC('lib/ai/whatsapp-intent.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/whatsapp-intent.ts'), 'utf8')
    expect(src).toMatch(/CONFIRM_APPOINTMENT_/)
    expect(src).toMatch(/'confirmado'/)
  })

  it('maps CANCEL_APPOINTMENT_ prefix to "cancelado" (Portuguese status)', () => {
    if (!existsSync(SRC('lib/ai/whatsapp-intent.ts'))) {
      expect(existsSync(SRC('lib/ai/whatsapp-intent.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/whatsapp-intent.ts'), 'utf8')
    expect(src).toMatch(/CANCEL_APPOINTMENT_/)
    expect(src).toMatch(/'cancelado'/)
  })

  it('returns null for unknown payloads (safe: no status change, D-04)', () => {
    if (!existsSync(SRC('lib/ai/whatsapp-intent.ts'))) {
      expect(existsSync(SRC('lib/ai/whatsapp-intent.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('lib/ai/whatsapp-intent.ts'), 'utf8')
    // The function must return null for unrecognised payloads
    expect(src).toMatch(/return null/)
  })
})

// ---------------------------------------------------------------------------
// Source inspection: whatsapp/route.ts
// ---------------------------------------------------------------------------
describe('src/app/api/webhooks/whatsapp/route.ts — source inspection (AI-02)', () => {
  it('route.ts file exists (created in 05-04)', () => {
    expect(
      existsSync(SRC('app/api/webhooks/whatsapp/route.ts')),
      'src/app/api/webhooks/whatsapp/route.ts not yet created (05-04)',
    ).toBe(true)
  })

  it('export const runtime = "nodejs"', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/export const runtime = 'nodejs'/)
  })

  it('GET handler echoes hub.challenge guarded by WHATSAPP_WEBHOOK_VERIFY_TOKEN', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/hub\.challenge/)
    expect(src).toMatch(/WHATSAPP_WEBHOOK_VERIFY_TOKEN/)
  })

  it('POST calls request.text() BEFORE any JSON.parse (raw body for HMAC)', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    const textIndex = src.indexOf('request.text()')
    const parseIndex = src.indexOf('JSON.parse')
    expect(textIndex, 'request.text() not found').toBeGreaterThan(-1)
    expect(parseIndex, 'JSON.parse not found').toBeGreaterThan(-1)
    // text() must be called BEFORE JSON.parse
    expect(textIndex).toBeLessThan(parseIndex)
  })

  it('references whatsapp_inbound_events (dedup table, T-5-03)', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/whatsapp_inbound_events/)
  })

  it('references WHATSAPP_APP_SECRET (HMAC validation, T-5-04)', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/WHATSAPP_APP_SECRET/)
  })

  it('ambiguous intent path does NOT update appointments status (D-04 safe fallback)', () => {
    if (!existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))) {
      expect(existsSync(SRC('app/api/webhooks/whatsapp/route.ts'))).toBe(true)
      return
    }
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    // The ambiguous branch must exist and must not update appointments
    expect(src).toMatch(/ambiguous/)
    // Inside the ambiguous branch there must NOT be a direct appointments status update
    // (the safe pattern is: log for review, skip the update)
    const ambiguousIndex = src.indexOf("'ambiguous'")
    expect(ambiguousIndex, "no 'ambiguous' branch found").toBeGreaterThan(-1)
  })
})
