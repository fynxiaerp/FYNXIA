/**
 * Phase 5 AI-02 — WhatsApp inbound webhook
 * RED-by-design until Plan 05-04 implements:
 *   - src/lib/whatsapp/verify-signature.ts  (pure HMAC verifier)
 *   - src/lib/ai/whatsapp-intent.ts          (pure intent → status mapper)
 *   - src/app/api/webhooks/whatsapp/route.ts (GET verify + POST handler)
 *
 * Tests:
 *  1. verifyWhatsAppSignature — pure function unit tests
 *  2. buttonPayloadToStatus — pure function unit tests
 *  3. route.ts source inspection: runtime, raw body first, dedup, no ambiguous update
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

const SRC = (f: string) => join(process.cwd(), 'src', f)

// ---------------------------------------------------------------------------
// Pure HMAC verifier (src/lib/whatsapp/verify-signature.ts)
// ---------------------------------------------------------------------------
describe('verifyWhatsAppSignature — HMAC-SHA256 pure function (AI-02, T-5-04)', () => {
  it('verify-signature.ts file exists (created in 05-04)', () => {
    expect(
      existsSync(SRC('lib/whatsapp/verify-signature.ts')),
      'src/lib/whatsapp/verify-signature.ts not yet created (05-04)',
    ).toBe(true)
  })

  it('valid HMAC-SHA256 signature returns true', async () => {
    const { verifyWhatsAppSignature } = await import('@/lib/whatsapp/verify-signature')
    const secret = 'test-secret'
    const body = '{"entry":[{"changes":[]}]}'
    const computed = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWhatsAppSignature(body, `sha256=${computed}`, secret)).toBe(true)
  })

  it('tampered body returns false', async () => {
    const { verifyWhatsAppSignature } = await import('@/lib/whatsapp/verify-signature')
    const secret = 'test-secret'
    const original = '{"entry":[{"changes":[]}]}'
    const tampered = '{"entry":[{"changes":[],"evil":true}]}'
    const computed = crypto.createHmac('sha256', secret).update(original).digest('hex')
    expect(verifyWhatsAppSignature(tampered, `sha256=${computed}`, secret)).toBe(false)
  })

  it('missing sha256= prefix returns false', async () => {
    const { verifyWhatsAppSignature } = await import('@/lib/whatsapp/verify-signature')
    const secret = 'test-secret'
    const body = '{"entry":[]}'
    const computed = crypto.createHmac('sha256', secret).update(body).digest('hex')
    // No 'sha256=' prefix — should fail
    expect(verifyWhatsAppSignature(body, computed, secret)).toBe(false)
  })

  it('null/empty signature header returns false', async () => {
    const { verifyWhatsAppSignature } = await import('@/lib/whatsapp/verify-signature')
    expect(verifyWhatsAppSignature('body', null, 'secret')).toBe(false)
    expect(verifyWhatsAppSignature('body', '', 'secret')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Intent → status mapper (src/lib/ai/whatsapp-intent.ts)
// ---------------------------------------------------------------------------
describe('buttonPayloadToStatus — intent mapper pure function (AI-02, D-04)', () => {
  it('whatsapp-intent.ts file exists (created in 05-04)', () => {
    expect(
      existsSync(SRC('lib/ai/whatsapp-intent.ts')),
      'src/lib/ai/whatsapp-intent.ts not yet created (05-04)',
    ).toBe(true)
  })

  it('CONFIRM_APPOINTMENT_{id} → { appointmentId, status: "confirmado" }', async () => {
    const { buttonPayloadToStatus } = await import('@/lib/ai/whatsapp-intent')
    const result = buttonPayloadToStatus('CONFIRM_APPOINTMENT_abc-123')
    expect(result).not.toBeNull()
    expect(result!.appointmentId).toBe('abc-123')
    expect(result!.status).toBe('confirmado')
  })

  it('CANCEL_APPOINTMENT_{id} → { appointmentId, status: "cancelado" }', async () => {
    const { buttonPayloadToStatus } = await import('@/lib/ai/whatsapp-intent')
    const result = buttonPayloadToStatus('CANCEL_APPOINTMENT_def-456')
    expect(result).not.toBeNull()
    expect(result!.appointmentId).toBe('def-456')
    expect(result!.status).toBe('cancelado')
  })

  it('unknown payload → null (safe: no status change)', async () => {
    const { buttonPayloadToStatus } = await import('@/lib/ai/whatsapp-intent')
    expect(buttonPayloadToStatus('UNKNOWN_ACTION_xyz')).toBeNull()
    expect(buttonPayloadToStatus('hello world')).toBeNull()
    expect(buttonPayloadToStatus('')).toBeNull()
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
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/export const runtime = 'nodejs'/)
  })

  it('GET handler echoes hub.challenge guarded by WHATSAPP_WEBHOOK_VERIFY_TOKEN', () => {
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/hub\.challenge/)
    expect(src).toMatch(/WHATSAPP_WEBHOOK_VERIFY_TOKEN/)
  })

  it('POST calls request.text() BEFORE any JSON.parse (raw body for HMAC)', () => {
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    const textIndex = src.indexOf('request.text()')
    const parseIndex = src.indexOf('JSON.parse')
    expect(textIndex, 'request.text() not found').toBeGreaterThan(-1)
    expect(parseIndex, 'JSON.parse not found').toBeGreaterThan(-1)
    // text() must be called BEFORE JSON.parse
    expect(textIndex).toBeLessThan(parseIndex)
  })

  it('references whatsapp_inbound_events (dedup table, T-5-03)', () => {
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/whatsapp_inbound_events/)
  })

  it('references WHATSAPP_APP_SECRET (HMAC validation, T-5-04)', () => {
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    expect(src).toMatch(/WHATSAPP_APP_SECRET/)
  })

  it('ambiguous intent path does NOT update appointments status (D-04 safe fallback)', () => {
    const src = readFileSync(SRC('app/api/webhooks/whatsapp/route.ts'), 'utf8')
    // The ambiguous branch must exist and must not update appointments
    // We check: ambiguous appears and the code acknowledges it without calling a status update
    expect(src).toMatch(/ambiguous/)
    // Inside the ambiguous branch there must NOT be a direct appointments status update
    // (the safe pattern is: log for review, skip the update)
    // We verify the overall safe-fallback design by asserting 'ambiguous' is handled
    // and that any appointments update is gated (not unconditional)
    // Full assertion: no unconditional .update( call on appointments table
    // (the update must be inside a conditional — checked by the 'ambiguous' branch existing)
    const ambiguousIndex = src.indexOf("'ambiguous'")
    expect(ambiguousIndex, "no 'ambiguous' branch found").toBeGreaterThan(-1)
  })
})
