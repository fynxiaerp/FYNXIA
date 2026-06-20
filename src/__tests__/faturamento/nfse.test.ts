/**
 * Phase 15 — NFS-e behavior tests (OS-02, D-20, D-25 ISS)
 * Test type: source-inspection (types.ts) + absolute-path dynamic-import guard (D-144)
 *
 * All tests are RED until Wave 4 plans create src/lib/fiscal/*.ts.
 *
 * Requirements encoded:
 *   OS-02  — FiscalProvider interface present; StubFiscalProvider.emit returns 'emitida'
 *   OS-02  — nfse_records inserted with status='processando' BEFORE provider.emit() (Pitfall 2)
 *   OS-02  — NFS-e NOT emitted when pagador='convenio'
 *   D-20   — regime='competencia' → emitirNfse called on faturar
 *   D-20   — regime='caixa' → emitirNfse NOT called on faturar (deferred to webhook)
 *   D-25   — computeIss(valorServicos, aliquota): integer-cent, no float drift
 *   D-25   — resolveAliquota uses service.aliquota_iss_override ?? unitConfig.aliquota_iss_padrao
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module paths (absolute — D-144) ─────────────────────────────────────────

const FISCAL_TYPES_MOD  = join(process.cwd(), 'src/lib/fiscal/types.ts')
const FISCAL_STUB_MOD   = join(process.cwd(), 'src/lib/fiscal/stub.ts')
const ISS_MATH_MOD      = join(process.cwd(), 'src/lib/fiscal/iss.ts')
const NFSE_ACTION_MOD   = join(process.cwd(), 'src/actions/nfse.ts')

// ─── FiscalProvider interface — source-inspection (OS-02) ────────────────────

describe('src/lib/fiscal/types.ts — FiscalProvider interface', () => {
  it('src/lib/fiscal/types.ts exists (RED until Wave 4 creates it)', () => {
    expect(existsSync(FISCAL_TYPES_MOD)).toBe(true)
  })

  it('exports FiscalProvider interface with emit( method', () => {
    const src = existsSync(FISCAL_TYPES_MOD) ? readFileSync(FISCAL_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/emit\(/)
  })

  it('exports FiscalProvider interface with query( method', () => {
    const src = existsSync(FISCAL_TYPES_MOD) ? readFileSync(FISCAL_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/query\(/)
  })

  it('exports FiscalProvider interface with cancel( method', () => {
    const src = existsSync(FISCAL_TYPES_MOD) ? readFileSync(FISCAL_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/cancel\(/)
  })
})

// ─── StubFiscalProvider — emit returns 'emitida' (OS-02) ─────────────────────

describe('src/lib/fiscal/stub.ts — StubFiscalProvider', () => {
  it('src/lib/fiscal/stub.ts exists (RED until Wave 4 creates it)', () => {
    expect(existsSync(FISCAL_STUB_MOD)).toBe(true)
  })

  it('StubFiscalProvider.emit returns status=emitida with a numero', async () => {
    const { StubFiscalProvider } = await import(FISCAL_STUB_MOD) as {
      StubFiscalProvider: new () => { emit: (input: { idempotency_key: string }) => Promise<{ status: string; numero?: string }> }
    }
    const stub = new StubFiscalProvider()
    const result = await stub.emit({ idempotency_key: 'nfse:os:test-uuid' })
    expect(result.status).toBe('emitida')
    expect(result.numero).toBeDefined()
  })

  it('StubFiscalProvider.query returns status=emitida', async () => {
    const { StubFiscalProvider } = await import(FISCAL_STUB_MOD) as {
      StubFiscalProvider: new () => { query: (ref: string) => Promise<{ status: string }> }
    }
    const stub = new StubFiscalProvider()
    const result = await stub.query('stub:ref-123')
    expect(result.status).toBe('emitida')
  })

  it('StubFiscalProvider.cancel returns { success: true }', async () => {
    const { StubFiscalProvider } = await import(FISCAL_STUB_MOD) as {
      StubFiscalProvider: new () => { cancel: (ref: string, motivo: string) => Promise<{ success: boolean }> }
    }
    const stub = new StubFiscalProvider()
    const result = await stub.cancel('stub:ref-123', 'Cancelamento teste')
    expect(result.success).toBe(true)
  })
})

// ─── computeIss — D-25 ISS math (integer-cent, no float drift) ───────────────

describe('src/lib/fiscal/iss.ts — computeIss (D-25)', () => {
  it('src/lib/fiscal/iss.ts exists (RED until Wave 4 creates it)', () => {
    expect(existsSync(ISS_MATH_MOD)).toBe(true)
  })

  it('computeIss(1200, 0.05) === 60 (integer-cent, no float drift like 59.999)', async () => {
    const { computeIss } = await import(ISS_MATH_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    expect(computeIss(1200, 0.05)).toBe(60)
  })

  it('computeIss(333.33, 0.05) result is rounded to 2 decimal places (no drift)', async () => {
    const { computeIss } = await import(ISS_MATH_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    const result = computeIss(333.33, 0.05)
    // Must not produce more than 2 decimal places (integer-cent)
    expect(Math.round(result * 100)).toBe(result * 100)
  })

  it('computeIss(1000, 0.02) === 20', async () => {
    const { computeIss } = await import(ISS_MATH_MOD) as {
      computeIss: (valorServicos: number, aliquota: number) => number
    }
    expect(computeIss(1000, 0.02)).toBe(20)
  })
})

// ─── resolveAliquota — service.aliquota_iss_override ?? unitConfig (Pitfall 7) ─

describe('src/lib/fiscal/iss.ts — resolveAliquota (Pitfall 7 service override)', () => {
  it('resolveAliquota uses service.aliquota_iss_override when present', async () => {
    const { resolveAliquota } = await import(ISS_MATH_MOD) as {
      resolveAliquota: (
        service: { aliquota_iss_override?: number | null },
        unitConfig: { aliquota_iss_padrao: number }
      ) => number
    }
    const result = resolveAliquota(
      { aliquota_iss_override: 0.03 },
      { aliquota_iss_padrao: 0.05 }
    )
    expect(result).toBe(0.03)
  })

  it('resolveAliquota falls back to unitConfig.aliquota_iss_padrao when override is null', async () => {
    const { resolveAliquota } = await import(ISS_MATH_MOD) as {
      resolveAliquota: (
        service: { aliquota_iss_override?: number | null },
        unitConfig: { aliquota_iss_padrao: number }
      ) => number
    }
    const result = resolveAliquota(
      { aliquota_iss_override: null },
      { aliquota_iss_padrao: 0.05 }
    )
    expect(result).toBe(0.05)
  })

  it('resolveAliquota falls back to unitConfig.aliquota_iss_padrao when override is undefined', async () => {
    const { resolveAliquota } = await import(ISS_MATH_MOD) as {
      resolveAliquota: (
        service: { aliquota_iss_override?: number | null },
        unitConfig: { aliquota_iss_padrao: number }
      ) => number
    }
    const result = resolveAliquota(
      {},
      { aliquota_iss_padrao: 0.05 }
    )
    expect(result).toBe(0.05)
  })
})

// ─── emitirNfse — regime competencia/caixa + convenio guard (OS-02, D-20) ────

describe('src/actions/nfse.ts — emitirNfse regime competencia (D-20)', () => {
  beforeEach(() => { vi.resetModules() })

  it('src/actions/nfse.ts exists (RED until Wave 4 creates it)', () => {
    expect(existsSync(NFSE_ACTION_MOD)).toBe(true)
  })

  it('D-20 competencia: emitirNfse calls provider.emit when regime=competencia', async () => {
    const mod = await import(NFSE_ACTION_MOD) as {
      emitirNfse: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ pagador: string; status: string }>
          getUnitFiscalConfig?: () => Promise<{ regime_emissao: string; aliquota_iss_padrao: number }>
          insertNfseRecord?: (data: { status: string }) => Promise<{ id: string }>
          getProvider?: () => { emit: (input: Record<string, unknown>) => Promise<{ status: string; numero?: string }> }
        }
      ) => Promise<{ success: boolean; nfseId?: string }>
    }

    const emitMock = vi.fn().mockResolvedValue({ status: 'emitida', numero: 'STUB-001' })
    const insertMock = vi.fn().mockResolvedValue({ id: 'nfse-uuid' })

    await mod.emitirNfse('os-uuid', {}, {
      getOs: vi.fn().mockResolvedValue({ pagador: 'particular', status: 'faturada' }),
      getUnitFiscalConfig: vi.fn().mockResolvedValue({ regime_emissao: 'competencia', aliquota_iss_padrao: 0.05 }),
      insertNfseRecord: insertMock,
      getProvider: () => ({ emit: emitMock }),
    })

    expect(emitMock).toHaveBeenCalledTimes(1)
  })

  it('D-20 caixa: emitirNfse does NOT call provider.emit when regime=caixa (deferred to webhook)', async () => {
    const mod = await import(NFSE_ACTION_MOD) as {
      emitirNfse: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ pagador: string; status: string }>
          getUnitFiscalConfig?: () => Promise<{ regime_emissao: string; aliquota_iss_padrao: number }>
          insertNfseRecord?: (data: { status: string }) => Promise<{ id: string }>
          getProvider?: () => { emit: (input: Record<string, unknown>) => Promise<{ status: string }> }
        }
      ) => Promise<{ success: boolean }>
    }

    const emitMock = vi.fn().mockResolvedValue({ status: 'processando' })

    await mod.emitirNfse('os-uuid', {}, {
      getOs: vi.fn().mockResolvedValue({ pagador: 'particular', status: 'faturada' }),
      getUnitFiscalConfig: vi.fn().mockResolvedValue({ regime_emissao: 'caixa', aliquota_iss_padrao: 0.05 }),
      insertNfseRecord: vi.fn().mockResolvedValue({ id: 'nfse-uuid' }),
      getProvider: () => ({ emit: emitMock }),
    })

    expect(emitMock).not.toHaveBeenCalled()
  })

  it('OS-02 convenio guard: emitirNfse NOT called when pagador=convenio', async () => {
    const mod = await import(NFSE_ACTION_MOD) as {
      emitirNfse: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ pagador: string; status: string }>
          getUnitFiscalConfig?: () => Promise<{ regime_emissao: string; aliquota_iss_padrao: number }>
          insertNfseRecord?: (data: { status: string }) => Promise<{ id: string }>
          getProvider?: () => { emit: (input: Record<string, unknown>) => Promise<{ status: string }> }
        }
      ) => Promise<{ success: boolean; skipped?: boolean }>
    }

    const emitMock = vi.fn()

    const result = await mod.emitirNfse('os-uuid', {}, {
      getOs: vi.fn().mockResolvedValue({ pagador: 'convenio', status: 'faturada' }),
      getUnitFiscalConfig: vi.fn().mockResolvedValue({ regime_emissao: 'competencia', aliquota_iss_padrao: 0.05 }),
      insertNfseRecord: vi.fn().mockResolvedValue({ id: 'nfse-uuid' }),
      getProvider: () => ({ emit: emitMock }),
    })

    expect(emitMock).not.toHaveBeenCalled()
    // Action should return success (no error) but skip emission
    expect(result.success).toBe(true)
  })
})

describe('src/actions/nfse.ts — emitirNfse Pitfall 2: nfse_records inserted BEFORE emit()', () => {
  beforeEach(() => { vi.resetModules() })

  it('Pitfall 2: insertNfseRecord with status=processando called BEFORE provider.emit()', async () => {
    const mod = await import(NFSE_ACTION_MOD) as {
      emitirNfse: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ pagador: string; status: string }>
          getUnitFiscalConfig?: () => Promise<{ regime_emissao: string; aliquota_iss_padrao: number }>
          insertNfseRecord?: (data: { status: string }) => Promise<{ id: string }>
          getProvider?: () => { emit: (input: Record<string, unknown>) => Promise<{ status: string; numero?: string }> }
        }
      ) => Promise<{ success: boolean }>
    }

    const callOrder: string[] = []
    const insertMock = vi.fn().mockImplementation(async (data: { status: string }) => {
      callOrder.push(`insert:${data.status}`)
      return { id: 'nfse-uuid' }
    })
    const emitMock = vi.fn().mockImplementation(async () => {
      callOrder.push('emit')
      return { status: 'emitida', numero: 'STUB-001' }
    })

    await mod.emitirNfse('os-uuid', {}, {
      getOs: vi.fn().mockResolvedValue({ pagador: 'particular', status: 'faturada' }),
      getUnitFiscalConfig: vi.fn().mockResolvedValue({ regime_emissao: 'competencia', aliquota_iss_padrao: 0.05 }),
      insertNfseRecord: insertMock,
      getProvider: () => ({ emit: emitMock }),
    })

    // insert:processando must come BEFORE emit (Pitfall 2)
    const insertIdx = callOrder.indexOf('insert:processando')
    const emitIdx   = callOrder.indexOf('emit')
    expect(insertIdx).toBeGreaterThanOrEqual(0)
    expect(emitIdx).toBeGreaterThanOrEqual(0)
    expect(insertIdx).toBeLessThan(emitIdx)
  })
})
