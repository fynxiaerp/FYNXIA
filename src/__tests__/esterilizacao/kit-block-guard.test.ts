/**
 * Phase 13 — kit-block-guard.test.ts
 * RED scaffold for the patient-safety block guard (CME-02).
 *
 * Target module: src/lib/esterilizacao/cycle-status.ts (PURE, NO 'use server')
 * Contract: isCycleUsable rejects a cycle that is not aprovado OR is vencido.
 *
 * Guards: absolute-path + existsSync so tsc stays at exit 0 while the module
 * does not yet exist (D-144 — @-alias causes TS2307 before the target exists).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 * Requirements: CME-02
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MOD = path.resolve(process.cwd(), 'src/lib/esterilizacao/cycle-status.ts')
const has = existsSync(MOD)

describe('isCycleUsable (block guard — CME-02)', () => {
  it.skipIf(!has)('reprovado → usable=false, reason mentions reprovado', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'reprovado', validade: '2027-01-01' })
    expect(result.usable).toBe(false)
    expect(result.reason).toContain('reprovado')
  })

  it.skipIf(!has)('pendente → usable=false, reason mentions pendente', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'pendente', validade: '2027-01-01' })
    expect(result.usable).toBe(false)
    expect(result.reason).toContain('pendente')
  })

  it.skipIf(!has)('aprovado + past validade → usable=false, reason mentions vencido', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'aprovado', validade: '2020-01-01', referenceDate: '2026-06-19' })
    expect(result.usable).toBe(false)
    expect(result.reason).toContain('vencido')
  })

  it.skipIf(!has)('aprovado + validade === referenceDate → usable=true, reason=null (expiry is validade < hoje)', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'aprovado', validade: '2026-06-19', referenceDate: '2026-06-19' })
    expect(result.usable).toBe(true)
    expect(result.reason).toBeNull()
  })

  it.skipIf(!has)('aprovado + future validade → usable=true', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'aprovado', validade: '2027-01-01', referenceDate: '2026-06-19' })
    expect(result.usable).toBe(true)
  })

  it.skipIf(!has)('aprovado + validade=null → usable=true (no expiry recorded)', async () => {
    const { isCycleUsable } = await import(MOD)
    const result = isCycleUsable({ biologicalResult: 'aprovado', validade: null })
    expect(result.usable).toBe(true)
  })

  // Source-inspection: the guard logic must stay PURE (client-importable)
  it.skipIf(!has)('target module does NOT contain use server (must be pure/client-importable)', () => {
    const src = readFileSync(MOD, 'utf8')
    expect(src).not.toContain("'use server'")
    expect(src).not.toContain('"use server"')
  })

  it.skipIf(!has)('target module does NOT import server-only (must be pure/client-importable)', () => {
    const src = readFileSync(MOD, 'utf8')
    expect(src).not.toContain('server-only')
  })
})
