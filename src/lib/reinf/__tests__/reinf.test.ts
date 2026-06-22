/**
 * Phase 16 — ReinfProvider stub RED specs (TRIB-03)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1 Plan 04 creates src/lib/reinf/stub.ts + src/lib/reinf/index.ts.
 * Source-inspection asserts src/lib/reinf/types.ts interface shape.
 *
 * Requirements encoded:
 *   TRIB-03 — ReinfProvider interface: transmitir/consultar/retificar methods
 *   TRIB-03 — StubReinfProvider.transmitir → status 'transmitido' + protocolo string
 *   TRIB-03 — getReinfProvider factory → StubReinfProvider when no credential_enc (D-22)
 */

import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module paths (absolute — D-144) ─────────────────────────────────────────

const REINF_TYPES_MOD = join(process.cwd(), 'src/lib/reinf/types.ts')
const REINF_STUB_MOD  = join(process.cwd(), 'src/lib/reinf/stub.ts')
const REINF_INDEX_MOD = join(process.cwd(), 'src/lib/reinf/index.ts')

// ─── Source-inspection: ReinfProvider interface shape ─────────────────────────

describe('reinf/types.ts — ReinfProvider interface (source-inspection)', () => {
  it('src/lib/reinf/types.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(REINF_TYPES_MOD)).toBe(true)
  })

  it('types.ts declares interface ReinfProvider', () => {
    const src = existsSync(REINF_TYPES_MOD) ? readFileSync(REINF_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/interface ReinfProvider/)
  })

  it('ReinfProvider has transmitir method signature', () => {
    const src = existsSync(REINF_TYPES_MOD) ? readFileSync(REINF_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/transmitir\(/)
  })

  it('ReinfProvider has consultar method signature', () => {
    const src = existsSync(REINF_TYPES_MOD) ? readFileSync(REINF_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/consultar\(/)
  })

  it('ReinfProvider has retificar method signature', () => {
    const src = existsSync(REINF_TYPES_MOD) ? readFileSync(REINF_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/retificar\(/)
  })
})

// ─── StubReinfProvider.transmitir → 'transmitido' + protocolo ────────────────

describe('reinf/stub.ts — StubReinfProvider.transmitir', () => {
  it('src/lib/reinf/stub.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(REINF_STUB_MOD)).toBe(true)
  })

  it('StubReinfProvider.transmitir returns status "transmitido"', async () => {
    const { StubReinfProvider } = await import(REINF_STUB_MOD) as {
      StubReinfProvider: new () => {
        transmitir: (input: {
          tipo: 'R2010' | 'R4020'
          competencia: string
          clinic_id: string
          idempotency_key: string
        }) => Promise<{ status: string; protocolo?: string; provider_ref: string }>
      }
    }
    const stub = new StubReinfProvider()
    const result = await stub.transmitir({
      tipo: 'R2010',
      competencia: '2026-06',
      clinic_id: 'clinic-test',
      idempotency_key: 'idem-key-001',
    })
    expect(result.status).toBe('transmitido')
  })

  it('StubReinfProvider.transmitir returns a protocolo string', async () => {
    const { StubReinfProvider } = await import(REINF_STUB_MOD) as {
      StubReinfProvider: new () => {
        transmitir: (input: {
          tipo: 'R2010' | 'R4020'
          competencia: string
          clinic_id: string
          idempotency_key: string
        }) => Promise<{ status: string; protocolo?: string; provider_ref: string }>
      }
    }
    const stub = new StubReinfProvider()
    const result = await stub.transmitir({
      tipo: 'R2010',
      competencia: '2026-06',
      clinic_id: 'clinic-test',
      idempotency_key: 'idem-key-001',
    })
    expect(typeof result.protocolo).toBe('string')
    expect(result.protocolo!.length).toBeGreaterThan(0)
  })
})

// ─── getReinfProvider factory → Stub when no credential (D-22) ───────────────

describe('reinf/index.ts — getReinfProvider factory (credential-gated)', () => {
  it('src/lib/reinf/index.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(REINF_INDEX_MOD)).toBe(true)
  })

  it('getReinfProvider returns StubReinfProvider when connector has no credential_enc', async () => {
    // Mock the admin client to return a connector row without credential_enc
    vi.mock('server-only', () => ({}))

    const { getReinfProvider } = await import(REINF_INDEX_MOD) as {
      getReinfProvider: (
        clinicId: string,
        adminClient?: unknown
      ) => Promise<{ transmitir: (...args: unknown[]) => unknown }>
    }
    const { StubReinfProvider } = await import(REINF_STUB_MOD) as {
      StubReinfProvider: new () => unknown
    }

    // Mock admin client: no connector row (empty data → no credential_enc)
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }

    const provider = await getReinfProvider('clinic-x', mockClient)
    expect(provider).toBeInstanceOf(StubReinfProvider)
  })
})
