/**
 * Phase 11 — isSlotWithinAvailability pure-unit + booking source-inspection (PRO-02)
 *
 * Pure-unit cases on isSlotWithinAvailability(grade, exceptions, slot):
 *   - recurring window covers slot → true
 *   - slot outside all windows → false
 *   - folga exception on slot's date → false (even if recurring would cover)
 *   - extra exception covering slot on day with no recurring window → true
 *   - empty grade + no exceptions → false
 *
 * Source-inspection (PRO-02):
 *   - src/actions/appointments.ts references isSlotWithinAvailability (or scheduling/availability)
 *   - src/actions/public-booking.ts references availability check
 *
 * Blocker-fix assertion (RES-02 — Plan 04 adds resource_id):
 *   - src/lib/validators/appointment.ts will gain optional resource_id (uuid().optional())
 *
 * All new-artifact assertions are RED until Plan 03/04 creates the target files.
 * The suite RUNS without crash — guarded dynamic imports skip inner asserts cleanly.
 *
 * ES2017 gotcha: never use /s (dotAll) flag.
 * D-144 gotcha: use resolve(process.cwd(), …) NOT @-alias for dynamic imports.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'

// Mock server-only so any transitively imported server file loads in Vitest
vi.mock('server-only', () => ({}))

/**
 * SRC(rel): read source file, returns '' when missing.
 * Assertion fails on content mismatch — RED by design for absent targets.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── PRO-02: isSlotWithinAvailability PURE UNIT ───────────────────────────────

describe('Phase 11 — isSlotWithinAvailability pure-unit (PRO-02)', () => {
  const availabilityPath = resolve(process.cwd(), 'src/lib/scheduling/availability.ts')

  it('recurring window covering slot returns true', async () => {
    if (!existsSync(availabilityPath)) {
      expect.fail('src/lib/scheduling/availability.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ availabilityPath) as any
    const fn = mod.isSlotWithinAvailability
    if (!fn) {
      expect.fail('isSlotWithinAvailability not exported from availability.ts')
    }
    // Monday (weekday 1) window 08:00–18:00; slot 09:00–10:00 on a Monday
    const monday = new Date('2026-06-15T09:00:00Z') // known Monday
    const slotEnd = new Date('2026-06-15T10:00:00Z')
    const grade = [{ weekday: 1, start_time: '08:00', end_time: '18:00' }]
    const exceptions: unknown[] = []
    expect(fn(grade, exceptions, { start: monday, end: slotEnd })).toBe(true)
  })

  it('slot outside all windows returns false', async () => {
    if (!existsSync(availabilityPath)) {
      expect.fail('src/lib/scheduling/availability.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ availabilityPath) as any
    const fn = mod.isSlotWithinAvailability
    if (!fn) {
      expect.fail('isSlotWithinAvailability not exported from availability.ts')
    }
    // Window only on Monday; slot on Tuesday
    const tuesday = new Date('2026-06-16T09:00:00Z')
    const slotEnd = new Date('2026-06-16T10:00:00Z')
    const grade = [{ weekday: 1, start_time: '08:00', end_time: '18:00' }]
    const exceptions: unknown[] = []
    expect(fn(grade, exceptions, { start: tuesday, end: slotEnd })).toBe(false)
  })

  it('folga exception on slot date returns false even if recurring window covers it', async () => {
    if (!existsSync(availabilityPath)) {
      expect.fail('src/lib/scheduling/availability.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ availabilityPath) as any
    const fn = mod.isSlotWithinAvailability
    if (!fn) {
      expect.fail('isSlotWithinAvailability not exported from availability.ts')
    }
    // Monday window 08:00–18:00 BUT folga exception on that Monday
    const monday = new Date('2026-06-15T09:00:00Z')
    const slotEnd = new Date('2026-06-15T10:00:00Z')
    const grade = [{ weekday: 1, start_time: '08:00', end_time: '18:00' }]
    const exceptions = [
      { exception_date: '2026-06-15', exception_type: 'folga' },
    ]
    expect(fn(grade, exceptions, { start: monday, end: slotEnd })).toBe(false)
  })

  it('extra exception covering slot on day with no recurring window returns true', async () => {
    if (!existsSync(availabilityPath)) {
      expect.fail('src/lib/scheduling/availability.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ availabilityPath) as any
    const fn = mod.isSlotWithinAvailability
    if (!fn) {
      expect.fail('isSlotWithinAvailability not exported from availability.ts')
    }
    // Saturday (weekday 6) has no recurring window, but extra exception covers slot
    const saturday = new Date('2026-06-20T09:00:00Z')
    const slotEnd = new Date('2026-06-20T10:00:00Z')
    const grade: unknown[] = [] // no recurring windows
    const exceptions = [
      { exception_date: '2026-06-20', exception_type: 'extra', start_time: '08:00', end_time: '12:00' },
    ]
    expect(fn(grade, exceptions, { start: saturday, end: slotEnd })).toBe(true)
  })

  it('empty grade + no exceptions returns false', async () => {
    if (!existsSync(availabilityPath)) {
      expect.fail('src/lib/scheduling/availability.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ availabilityPath) as any
    const fn = mod.isSlotWithinAvailability
    if (!fn) {
      expect.fail('isSlotWithinAvailability not exported from availability.ts')
    }
    const slot = new Date('2026-06-15T09:00:00Z')
    const slotEnd = new Date('2026-06-15T10:00:00Z')
    expect(fn([], [], { start: slot, end: slotEnd })).toBe(false)
  })
})

// ─── PRO-02: createAppointment references availability check ──────────────────

describe('Phase 11 — appointments.ts availability source-inspection (PRO-02)', () => {
  const actionSrc = SRC('src/actions/appointments.ts')

  it('createAppointment references isSlotWithinAvailability or scheduling/availability import', () => {
    // RED until Plan 04 injects the availability check into createAppointment
    const hasAvailabilityFn = /isSlotWithinAvailability/.test(actionSrc)
    const hasAvailabilityImport = /scheduling\/availability/.test(actionSrc)
    expect(hasAvailabilityFn || hasAvailabilityImport).toBe(true)
  })

  it('createAppointment returns a disponibilidade rejection message', () => {
    // RED until Plan 04 — must show a Portuguese rejection when slot is outside availability
    expect(actionSrc).toMatch(/disponibilidade/)
  })
})

// ─── PRO-02: public-booking.ts availability source-inspection ────────────────

describe('Phase 11 — public-booking.ts availability source-inspection (PRO-02)', () => {
  const bookingSrc = SRC('src/actions/public-booking.ts')

  it('references availability check (isSlotWithinAvailability or getAvailableSlots)', () => {
    // RED until Plan 04 updates public-booking.ts with availability filtering
    const hasAvailability = /isSlotWithinAvailability|getAvailableSlots|scheduling\/availability/.test(bookingSrc)
    expect(hasAvailability).toBe(true)
  })

  it('createPublicAppointment references isSlotWithinAvailability', () => {
    // RED until Plan 04
    expect(bookingSrc).toMatch(/isSlotWithinAvailability/)
  })
})

// ─── RES-02 Blocker-fix: appointment.ts gains optional resource_id ────────────
// RED until Plan 04 edits src/lib/validators/appointment.ts to add resource_id.
// This assertion contract-tests the shape accepted by createAppointment for resources.

describe('Phase 11 — appointment validator gains resource_id (RES-02 blocker-fix)', () => {
  const validatorSrc = SRC('src/lib/validators/appointment.ts')

  it('appointment Zod schema has optional resource_id uuid field (Plan 04 target)', () => {
    // RED until Plan 04 — appointments schema must accept resource_id for resource reservation
    expect(validatorSrc).toMatch(/resource_id/)
    expect(validatorSrc).toMatch(/\.optional\(\)/)
  })

  it('resource_id is validated as a uuid (not freeform string)', () => {
    // RED until Plan 04 — uuid() ensures only valid UUIDs are accepted
    const hasResourceUuid =
      /resource_id.*uuid\(\)|uuid\(\).*resource_id/.test(validatorSrc)
    expect(hasResourceUuid).toBe(true)
  })
})
