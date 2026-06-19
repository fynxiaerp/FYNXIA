/**
 * Phase 13 — cycle-status.test.ts
 * RED scaffold for the pure cycle-status helper (Plan 02 will turn GREEN).
 *
 * Target module: src/lib/esterilizacao/cycle-status.ts (PURE, NO 'use server')
 *
 * Guards: absolute-path + existsSync so tsc stays at exit 0 while the module
 * does not yet exist (D-144 — @-alias causes TS2307 before the target exists).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 * Requirements: CME-01, CME-02
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MOD = path.resolve(process.cwd(), 'src/lib/esterilizacao/cycle-status.ts')
const has = existsSync(MOD)

describe('deriveCycleStatus', () => {
  it.skipIf(!has)('aprovado + past validade → vencido', async () => {
    const { deriveCycleStatus } = await import(MOD)
    expect(
      deriveCycleStatus({ biologicalResult: 'aprovado', validade: '2020-01-01', referenceDate: '2026-06-19' })
    ).toBe('vencido')
  })

  it.skipIf(!has)('aprovado + future validade → aprovado', async () => {
    const { deriveCycleStatus } = await import(MOD)
    expect(
      deriveCycleStatus({ biologicalResult: 'aprovado', validade: '2027-01-01', referenceDate: '2026-06-19' })
    ).toBe('aprovado')
  })

  it.skipIf(!has)('reprovado → reprovado (regardless of validade)', async () => {
    const { deriveCycleStatus } = await import(MOD)
    expect(
      deriveCycleStatus({ biologicalResult: 'reprovado', validade: '2027-01-01' })
    ).toBe('reprovado')
  })

  it.skipIf(!has)('pendente → pendente', async () => {
    const { deriveCycleStatus } = await import(MOD)
    expect(
      deriveCycleStatus({ biologicalResult: 'pendente', validade: null })
    ).toBe('pendente')
  })
})
