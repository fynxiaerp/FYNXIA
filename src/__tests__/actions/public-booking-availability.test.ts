/**
 * Public Booking Availability tests
 * Phase 02-05: CLINIC-09 gap closure
 *
 * Tests:
 * 1. getBookedSlots is exported from public-booking.ts (source-level check)
 * 2. Offset datetime strings pass Zod datetime({offset:true}) — fixes latent
 *    form bug where naive datetimes failed publicBookingSchema validation.
 *
 * These are UNIT tests: schema/logic only, no real DB calls.
 * Source-level checks follow the T-2-12 pattern (read file, grep for symbol).
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'

// ─── Helper: datetime offset schema (mirrors publicBookingSchema) ─────────────
const offsetDatetimeSchema = z.string().datetime({ offset: true })

// ─── getBookedSlots source-level checks (RED: fails until function is added) ──

describe('getBookedSlots source-level checks', () => {
  const filePath = path.resolve(
    process.cwd(),
    'src/actions/public-booking.ts'
  )

  it('exports getBookedSlots from public-booking.ts', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('export async function getBookedSlots')
  })

  it('getBookedSlots uses createAdminClient (service-role, no session)', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    // Verify the function uses the admin client, not the RLS-aware client
    expect(source).toContain('createAdminClient')
  })

  it('getBookedSlots filters out cancelled appointments (status != cancelado)', () => {
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('cancelado')
  })

  it('PublicBookingForm calls getBookedSlots', () => {
    const formPath = path.resolve(
      process.cwd(),
      'src/components/booking/PublicBookingForm.tsx'
    )
    const formSource = fs.readFileSync(formPath, 'utf-8')
    expect(formSource).toContain('getBookedSlots')
  })

  it('PublicBookingForm generates datetimes with -03:00 offset', () => {
    const formPath = path.resolve(
      process.cwd(),
      'src/components/booking/PublicBookingForm.tsx'
    )
    const formSource = fs.readFileSync(formPath, 'utf-8')
    expect(formSource).toContain('-03:00')
  })
})

// ─── datetime offset correctness ─────────────────────────────────────────────
// The form was sending naive datetimes (e.g. "2026-06-10T09:00:00") which fail
// z.string().datetime({offset:true}). After the fix, slots must include -03:00.

describe('Brazil datetime with offset (-03:00)', () => {
  it('offset datetime string passes Zod datetime({offset:true})', () => {
    const dt = '2026-06-10T09:00:00-03:00'
    expect(offsetDatetimeSchema.safeParse(dt).success).toBe(true)
  })

  it('naive datetime (no offset) fails Zod datetime({offset:true})', () => {
    const dt = '2026-06-10T09:00:00'
    expect(offsetDatetimeSchema.safeParse(dt).success).toBe(false)
  })

  it('UTC datetime (Z suffix) passes Zod datetime({offset:true})', () => {
    // Z is a valid offset — confirms offset:true accepts UTC too
    const dt = '2026-06-10T12:00:00Z'
    expect(offsetDatetimeSchema.safeParse(dt).success).toBe(true)
  })

  it('slot generated for 09:00 with -03:00 offset represents correct instant', () => {
    // 2026-06-10T09:00:00-03:00 == 2026-06-10T12:00:00Z
    const local = '2026-06-10T09:00:00-03:00'
    const utc = '2026-06-10T12:00:00Z'
    expect(new Date(local).getTime()).toBe(new Date(utc).getTime())
  })

  it('booked slot comparison by instant works across offset formats', () => {
    // Bank returns UTC: "2026-06-10T12:00:00+00:00" or "2026-06-10T12:00:00Z"
    // Form sends Brazil local: "2026-06-10T09:00:00-03:00"
    // Comparing by .getTime() must treat them as the same instant
    const bankUtc = '2026-06-10T12:00:00+00:00'
    const formBrazil = '2026-06-10T09:00:00-03:00'
    expect(new Date(bankUtc).getTime()).toBe(new Date(formBrazil).getTime())
  })
})
