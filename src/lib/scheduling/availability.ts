/**
 * Availability lib — PURE function, no server-only imports.
 *
 * Safe to import in both client and server contexts.
 * No 'use server' directive — must remain importable by the public booking form
 * and unit tests without a Next.js server environment.
 *
 * Phase 11 (PRO-02): isSlotWithinAvailability checks whether a slot falls
 * within a professional's configured working hours, applying exceptions
 * (folga = day off, extra = additional hours on a specific date).
 *
 * Algorithm (mirror of 11-RESEARCH Pattern 2):
 *   1. If any folga exception exists for the slot's date → false (day blocked).
 *   2. If any recurring window on the slot's weekday covers [slot.start, slot.end] → true.
 *   3. If any extra exception on the slot's date covers [slot.start, slot.end] → true.
 *   4. Otherwise → false.
 *
 * TIMEZONE CONVENTION (WR-03): availability windows are entered/stored as Brazil
 * local wall-clock (America/Sao_Paulo). Slot instants arrive as absolute time
 * (ISO strings or Dates). This function converts the slot instant to the
 * America/Sao_Paulo zone before extracting the weekday + HH:MM used for the
 * window comparison. This matches the rest of the booking code, which anchors
 * day ranges in the -03:00 offset (e.g. getBookedSlots in public-booking.ts).
 * The previous implementation read getUTC* directly, producing a ~3h skew that
 * offered/accepted the wrong slots whenever a professional row existed.
 */
import { formatInTimeZone } from 'date-fns-tz'

/** Clinic timezone — Brazil has no DST since 2019, fixed -03:00. */
const CLINIC_TZ = 'America/Sao_Paulo'

// ─── Types ───────────────────────────────────────────────────────────────────

/** One row from professional_availability (recurring weekly window). */
export interface AvailabilityWindow {
  weekday: number    // 0=Sunday … 6=Saturday (JS Date.getDay() convention)
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string   // 'HH:MM' or 'HH:MM:SS'
}

/** One row from professional_availability_exceptions. */
export interface AvailabilityException {
  exception_date: string             // 'YYYY-MM-DD'
  exception_type: 'folga' | 'extra'
  start_time?: string | null         // required for 'extra'; null/absent for 'folga'
  end_time?: string | null           // required for 'extra'; null/absent for 'folga'
}

/** A requested appointment slot. */
export interface Slot {
  start: string | Date   // ISO string or Date
  end: string | Date     // ISO string or Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize any value to a Date object. */
function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v)
}

/** Extract YYYY-MM-DD of the instant as seen in the clinic timezone (-03:00). */
function toDateStr(d: Date): string {
  return formatInTimeZone(d, CLINIC_TZ, 'yyyy-MM-dd')
}

/** Extract HH:MM of the instant as seen in the clinic timezone (-03:00). */
function toTimeStr(d: Date): string {
  return formatInTimeZone(d, CLINIC_TZ, 'HH:mm')
}

/** Day of week (0=Sun … 6=Sat) of the instant as seen in the clinic timezone. */
function toWeekday(d: Date): number {
  // 'i' = ISO day (1=Mon … 7=Sun); convert to JS getDay() convention (0=Sun … 6=Sat).
  const iso = Number(formatInTimeZone(d, CLINIC_TZ, 'i'))
  return iso % 7
}

/**
 * Normalize a TIME string (from DB 'HH:MM:SS' or form 'HH:MM') to 'HH:MM'.
 * Enables safe string comparison without worrying about seconds component.
 */
function normalizeTime(t: string): string {
  // Take only the first 5 characters: 'HH:MM'
  return t.slice(0, 5)
}

/**
 * Return true if the window [wStart, wEnd] ⊇ [slotStart, slotEnd].
 * All values as 'HH:MM'.
 */
function windowCoversSlot(
  wStart: string,
  wEnd: string,
  slotStart: string,
  slotEnd: string,
): boolean {
  return wStart <= slotStart && wEnd >= slotEnd
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Determine whether a requested slot falls within a professional's configured
 * availability windows, accounting for exceptions.
 *
 * @param grade      Recurring weekly windows (rows from professional_availability).
 * @param exceptions Date-specific overrides (rows from professional_availability_exceptions).
 * @param slot       The requested appointment time range.
 * @returns          true if the slot is within availability; false otherwise.
 */
export function isSlotWithinAvailability(
  grade: AvailabilityWindow[],
  exceptions: AvailabilityException[],
  slot: Slot,
): boolean {
  const startDate = toDate(slot.start)
  const endDate = toDate(slot.end)

  // WR-03: derive date / weekday / HH:MM from the clinic-local wall-clock (-03:00),
  // matching how windows are entered and how getBookedSlots anchors the day range.
  const dateStr = toDateStr(startDate)
  const weekday = toWeekday(startDate) // 0=Sun … 6=Sat in clinic tz
  const slotStartStr = toTimeStr(startDate)
  const slotEndStr = toTimeStr(endDate)

  // ── Step 1: folga exception on this date → always false ──────────────────
  const hasFolga = exceptions.some(
    (e) => e.exception_type === 'folga' && e.exception_date === dateStr,
  )
  if (hasFolga) return false

  // ── Step 2: recurring window on matching weekday covers slot ─────────────
  const coveredByRecurring = grade.some((w) => {
    if (w.weekday !== weekday) return false
    const wStart = normalizeTime(w.start_time)
    const wEnd = normalizeTime(w.end_time)
    return windowCoversSlot(wStart, wEnd, slotStartStr, slotEndStr)
  })
  if (coveredByRecurring) return true

  // ── Step 3: extra exception on this date covers slot ────────────────────
  const coveredByExtra = exceptions.some((e) => {
    if (e.exception_type !== 'extra') return false
    if (e.exception_date !== dateStr) return false
    if (!e.start_time || !e.end_time) return false
    const eStart = normalizeTime(e.start_time)
    const eEnd = normalizeTime(e.end_time)
    return windowCoversSlot(eStart, eEnd, slotStartStr, slotEndStr)
  })
  if (coveredByExtra) return true

  // ── Step 4: no coverage ──────────────────────────────────────────────────
  return false
}
