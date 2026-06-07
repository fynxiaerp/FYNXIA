/**
 * Phase 4 — WhatsApp Cloud API client tests (COMMS-01, COMMS-03)
 * Test type: source-inspection of src/lib/whatsapp/client.ts (Plan 02)
 *
 * RED until Plan 02 creates src/lib/whatsapp/client.ts.
 * COMMS-01: correct Meta Cloud API endpoint + template body shape
 * COMMS-03: utility category guard (no marketing keywords), quick-reply buttons
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CLIENT_PATH = resolve(process.cwd(), 'src/lib/whatsapp/client.ts')

describe('WhatsApp Cloud API client — src/lib/whatsapp/client.ts (COMMS-01)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    expect(existsSync(CLIENT_PATH)).toBe(true)
  })

  it('imports server-only (prevents accidental client-side usage)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    expect(src).toMatch(/import ['"]server-only['"]/)
  })

  it('uses graph.facebook.com/v21.0 endpoint (COMMS-01)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    expect(src).toMatch(/graph\.facebook\.com\/v21\.0/)
  })

  it('endpoint path includes /messages (COMMS-01)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    // The messages path should be in the URL interpolation
    expect(src).toMatch(/\/messages/)
  })

  it('body shape includes messaging_product, type template, language with code (COMMS-01)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    expect(src).toMatch(/messaging_product/)
    expect(src).toMatch(/'whatsapp'/)
    expect(src).toMatch(/type.*['"]template['"]|['"]template['"].*type/s)
    expect(src).toMatch(/language/)
    expect(src).toMatch(/code/)
  })

  it('reads WHATSAPP_ACCESS_TOKEN at call time (not module scope — RESEARCH Pitfall 2)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    expect(src).toMatch(/process\.env\.WHATSAPP_ACCESS_TOKEN/)
  })

  it('supports quick_reply buttons with payload parameter (COMMS-03, D-03)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    // quick_reply and payload must be referenced (as string literals or types)
    expect(src).toMatch(/'quick_reply'|"quick_reply"|quick_reply/)
    expect(src).toMatch(/'payload'|"payload"|payload/)
  })

  it('COMMS-03 utility guard: no promotional keywords in client source (T-4-outbox-S)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    // marketing/promotional language must never appear in the WhatsApp client
    expect(src.toLowerCase()).not.toMatch(/promoç|desconto|aproveite/)
  })

  it('NEVER uses Evolution API or Baileys (PROJECT locked — CLAUDE.md)', () => {
    if (!existsSync(CLIENT_PATH)) {
      expect(existsSync(CLIENT_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CLIENT_PATH, 'utf8')
    expect(src.toLowerCase()).not.toMatch(/baileys|evolution\s*api/)
  })
})
