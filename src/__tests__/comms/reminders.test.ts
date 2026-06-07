/**
 * Phase 4 — Appointment reminder scan + cron auth tests (COMMS-01, COMMS-02)
 * Test type:
 *   - Source-inspection of src/lib/messaging/reminder-scan.ts (Plan 03)
 *   - Source-inspection of src/app/api/cron/reminder-dispatch/route.ts (Plan 04)
 *
 * RED until Plan 03 creates reminder-scan.ts and Plan 04 creates reminder-dispatch/route.ts.
 *
 * COMMS-01/02: 24h batch reminder for both channels; dedup per (appointment, channel, type);
 *              cron protected by CRON_SECRET Bearer (pattern from Phase 3 collection-ruler).
 *
 * NOTE on test form: Plan 01 uses source-inspection (readFileSync) for reminder-scan.ts
 * because at scaffold time the exported function signature may shift during implementation.
 * If Plan 03 exports a pure `selectReminderTargets` function, these tests can be upgraded
 * to direct import tests by Plan 03's implementer. Source-inspection is the safe fallback.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCAN_PATH  = resolve(process.cwd(), 'src/lib/messaging/reminder-scan.ts')
const CRON_PATH  = resolve(process.cwd(), 'src/app/api/cron/reminder-dispatch/route.ts')

describe('Reminder scan logic — src/lib/messaging/reminder-scan.ts (COMMS-01, COMMS-02)', () => {
  it('file exists (fails RED until Plan 03)', () => {
    expect(existsSync(SCAN_PATH)).toBe(true)
  })

  it('exports selectReminderTargets (or equivalent scan function)', () => {
    if (!existsSync(SCAN_PATH)) {
      expect(existsSync(SCAN_PATH)).toBe(true)
      return
    }
    const src = readFileSync(SCAN_PATH, 'utf8')
    expect(src).toMatch(/selectReminderTargets|export.*function|export.*const/)
  })

  it("filters out cancelled appointments (status 'cancelado' — RESEARCH §Pattern 6)", () => {
    if (!existsSync(SCAN_PATH)) {
      expect(existsSync(SCAN_PATH)).toBe(true)
      return
    }
    const src = readFileSync(SCAN_PATH, 'utf8')
    // Must reference cancelled status (neq or filter)
    expect(src).toMatch(/cancelado/)
  })

  it('enqueues both whatsapp and email channels per appointment (COMMS-01 + COMMS-02)', () => {
    if (!existsSync(SCAN_PATH)) {
      expect(existsSync(SCAN_PATH)).toBe(true)
      return
    }
    const src = readFileSync(SCAN_PATH, 'utf8')
    expect(src).toMatch(/'whatsapp'|"whatsapp"/)
    expect(src).toMatch(/'email'|"email"/)
  })

  it('idempotency keys follow reminder:{id}:{channel}:24h format (D-04, RESEARCH §Pattern 5)', () => {
    if (!existsSync(SCAN_PATH)) {
      expect(existsSync(SCAN_PATH)).toBe(true)
      return
    }
    const src = readFileSync(SCAN_PATH, 'utf8')
    // Key pattern: reminder:${appointmentId}:${channel}:24h
    expect(src).toMatch(/reminder:.*:.*:24h|`reminder:\$\{/)
  })
})

describe('Reminder cron endpoint — src/app/api/cron/reminder-dispatch/route.ts (COMMS-04)', () => {
  it('file exists (fails RED until Plan 04)', () => {
    expect(existsSync(CRON_PATH)).toBe(true)
  })

  it("uses nodejs runtime (not Edge — RESEARCH Pitfall 7)", () => {
    if (!existsSync(CRON_PATH)) {
      expect(existsSync(CRON_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CRON_PATH, 'utf8')
    expect(src).toMatch(/export const runtime\s*=\s*['"]nodejs['"]/)
  })

  it('validates CRON_SECRET bearer token (401 on mismatch — RESEARCH §Security)', () => {
    if (!existsSync(CRON_PATH)) {
      expect(existsSync(CRON_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CRON_PATH, 'utf8')
    expect(src).toMatch(/CRON_SECRET/)
    expect(src).toMatch(/Bearer/)
    expect(src).toMatch(/401/)
  })
})
