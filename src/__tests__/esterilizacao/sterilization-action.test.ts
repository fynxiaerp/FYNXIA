/**
 * sterilization-action.test.ts — Source-inspection tests for CME Server Actions (CME-01/CME-02/CME-03)
 *
 * Phase 13 Plan 04 (TDD RED→GREEN):
 * Tests that src/actions/sterilization.ts contains the required safety controls
 * without executing Supabase or any server-side code. All assertions are against
 * the SOURCE TEXT of the action file (readFileSync).
 *
 * Critical invariants verified:
 *   1. File is a 'use server' module (Turbopack constraint)
 *   2. Imports isCycleUsable + deriveCycleStatus from cycle-status lib
 *   3. Kit-usage BLOCK GUARD: isCycleUsable is called BEFORE the kit_usages insert
 *      (patient-safety: the check must precede the write — CME-02)
 *   4. assertNotReadOnly + logBusinessEvent are present (role gate + audit trail)
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 04
 * Requirements: CME-01, CME-02, CME-03
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ACTION_FILE = path.resolve(process.cwd(), 'src/actions/sterilization.ts')
const has = existsSync(ACTION_FILE)

describe('sterilization.ts — source-inspection (CME-01/CME-02/CME-03)', () => {
  it('action file exists', () => {
    expect(has).toBe(true)
  })

  it("starts with 'use server' directive", () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src.trimStart().startsWith("'use server'")).toBe(true)
  })

  it('imports isCycleUsable from cycle-status lib', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('isCycleUsable')
    expect(src).toContain('cycle-status')
  })

  it('imports deriveCycleStatus from cycle-status lib', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('deriveCycleStatus')
    expect(src).toContain('cycle-status')
  })

  it('BLOCK GUARD: isCycleUsable is called BEFORE the kit_usages insert (CME-02 patient safety)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')

    // Both must be present
    expect(src).toContain('isCycleUsable')
    expect(src).toContain('kit_usages')

    // The isCycleUsable call must appear before the kit_usages insert
    const guardIndex = src.indexOf('isCycleUsable(')
    const insertIndex = src.indexOf("'kit_usages'")
    expect(guardIndex).toBeGreaterThan(-1)
    expect(insertIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(insertIndex)
  })

  it('BLOCK GUARD: early-return when cycle is not usable (no insert on failure)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // The guard must have a conditional that returns early when cycle is NOT usable
    // Accept either !check.usable or check.usable === false pattern
    const hasNegationGuard =
      src.includes('!check.usable') ||
      src.includes('check.usable === false') ||
      src.includes('!cycleCheck.usable') ||
      src.includes('cycleCheck.usable === false') ||
      src.includes('!usable')
    expect(hasNegationGuard).toBe(true)
  })

  it('calls assertNotReadOnly (read-only role gate)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('assertNotReadOnly')
  })

  it('calls logBusinessEvent (audit trail — LGPD IDs only)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('logBusinessEvent')
  })

  it('all top-level exports are async functions (Turbopack use server constraint)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // Find all top-level `export function` or `export const` declarations
    // and assert none are non-async export function declarations
    const nonAsyncExports = src.match(/^export function /m)
    // Should not have any non-async exported functions
    expect(nonAsyncExports).toBeNull()
  })

  it('uses clinic_id for sterilization_cycles + kit_usages (tenant scope)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('clinic_id')
  })

  it('contains sterilization_cycles table reference (CME-01)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('sterilization_cycles')
  })

  it('contains kit.usage.registered event (CME-03 audit)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('kit.usage.registered')
  })

  it('contains sterilization.cycle.registered event (CME-01 audit)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('sterilization.cycle.registered')
  })
})
