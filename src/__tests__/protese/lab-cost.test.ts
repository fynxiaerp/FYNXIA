/**
 * Phase 13 — lab-cost.test.ts
 * RED scaffold for the pure lab-cost helper (Plan 03 will turn GREEN).
 *
 * Target module: src/lib/protese/lab-cost.ts (PURE)
 *
 * Guards: absolute-path + existsSync so tsc stays at exit 0 while the module
 * does not yet exist (D-144 — @-alias causes TS2307 before the target exists).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 * Requirements: LAB-01, LAB-02
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MOD = path.resolve(process.cwd(), 'src/lib/protese/lab-cost.ts')
const has = existsSync(MOD)

describe('isCostPostable', () => {
  it.skipIf(!has)('0 → false (zero is not postable)', async () => {
    const { isCostPostable } = await import(MOD)
    expect(isCostPostable(0)).toBe(false)
  })

  it.skipIf(!has)('null → false', async () => {
    const { isCostPostable } = await import(MOD)
    expect(isCostPostable(null)).toBe(false)
  })

  it.skipIf(!has)('negative value → false', async () => {
    const { isCostPostable } = await import(MOD)
    expect(isCostPostable(-5)).toBe(false)
  })

  it.skipIf(!has)('positive value → true', async () => {
    const { isCostPostable } = await import(MOD)
    expect(isCostPostable(120.5)).toBe(true)
  })
})

describe('buildLabExpenseDescription', () => {
  it.skipIf(!has)('includes orderNumber in the returned string', async () => {
    const { buildLabExpenseDescription } = await import(MOD)
    const result = buildLabExpenseDescription({
      labName: 'Lab Dental X',
      prosthesisType: 'Coroa metalocerâmica',
      orderNumber: 'OS-2026-0007',
    })
    expect(result).toContain('OS-2026-0007')
  })

  it.skipIf(!has)('includes prosthesisType in the returned string', async () => {
    const { buildLabExpenseDescription } = await import(MOD)
    const result = buildLabExpenseDescription({
      labName: 'Lab Dental X',
      prosthesisType: 'Coroa metalocerâmica',
      orderNumber: 'OS-2026-0007',
    })
    expect(result).toContain('Coroa metalocerâmica')
  })

  it.skipIf(!has)('includes labName in the returned string', async () => {
    const { buildLabExpenseDescription } = await import(MOD)
    const result = buildLabExpenseDescription({
      labName: 'Lab Dental X',
      prosthesisType: 'Coroa metalocerâmica',
      orderNumber: 'OS-2026-0007',
    })
    expect(result).toContain('Lab Dental X')
  })
})
