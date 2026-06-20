/**
 * Phase 15 — Service Orders behavior tests (OS-01, OS-03, D-25, D-30)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1+ plans create the target modules.
 * existsSync guard: first assertion in each suite is `expect(existsSync(MOD)).toBe(true)`
 * which RED-fails immediately, preventing confusing import errors.
 *
 * Requirements encoded:
 *   OS-01 — OS state machine: rascunho→faturada allowed; invalid transitions rejected
 *   OS-03 — createCharge called (particular), insurer receivable (convenio, no Asaas)
 *   D-25  — computeOsTotal: sum(items) − desconto_total + acrescimo_total
 *   D-30  — faturarOs idempotency: second call returns success without re-calling createCharge
 *   D-30  — CAS race guard: 0-row UPDATE → error mentioning corrida/race
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module paths (absolute — D-144: @-alias causes TS2307 when target missing) ─

const OS_MATH_MOD   = join(process.cwd(), 'src/lib/faturamento/os-math.ts')
const OS_ACTION_MOD = join(process.cwd(), 'src/actions/service-orders.ts')

// ─── computeOsTotal — D-25 math ──────────────────────────────────────────────

describe('os-math.ts — computeOsTotal (D-25)', () => {
  it('src/lib/faturamento/os-math.ts exists (RED until Plan 03 creates it)', () => {
    expect(existsSync(OS_MATH_MOD)).toBe(true)
  })

  it('sum items - desconto_total + acrescimo_total: [100, 50] - 20 + 0 = 130', async () => {
    const { computeOsTotal } = await import(OS_MATH_MOD) as {
      computeOsTotal: (items: { valorTotal: number }[], descontoTotal: number, acrescimoTotal: number) => number
    }
    const result = computeOsTotal(
      [{ valorTotal: 100 }, { valorTotal: 50 }],
      20,
      0
    )
    expect(result).toBe(130)
  })

  it('single item no discount: computeOsTotal([{valorTotal:1200}], 0, 0) = 1200', async () => {
    const { computeOsTotal } = await import(OS_MATH_MOD) as {
      computeOsTotal: (items: { valorTotal: number }[], descontoTotal: number, acrescimoTotal: number) => number
    }
    expect(computeOsTotal([{ valorTotal: 1200 }], 0, 0)).toBe(1200)
  })

  it('integer-cent: computeOsTotal([{valorTotal:1200}], 0, 0) result is integer-representable (no float drift)', async () => {
    const { computeOsTotal } = await import(OS_MATH_MOD) as {
      computeOsTotal: (items: { valorTotal: number }[], descontoTotal: number, acrescimoTotal: number) => number
    }
    const result = computeOsTotal([{ valorTotal: 1200 }], 0, 0)
    // ISS base equals total after discounts (D-25: ISS base = OS total)
    expect(Math.round(result * 100)).toBe(result * 100)
  })

  it('acrescimo_total adds to total: [500] + 0 acrescimo 50 = 550', async () => {
    const { computeOsTotal } = await import(OS_MATH_MOD) as {
      computeOsTotal: (items: { valorTotal: number }[], descontoTotal: number, acrescimoTotal: number) => number
    }
    expect(computeOsTotal([{ valorTotal: 500 }], 0, 50)).toBe(550)
  })
})

// ─── isValidOsTransition — OS state machine (OS-01) ──────────────────────────

describe('service-orders.ts — isValidOsTransition (OS-01 state machine)', () => {
  it('src/actions/service-orders.ts exists (RED until Plan 03 creates it)', () => {
    expect(existsSync(OS_ACTION_MOD)).toBe(true)
  })

  it('rascunho → faturada is allowed', async () => {
    const { isValidOsTransition } = await import(OS_MATH_MOD) as {
      isValidOsTransition: (from: string, to: string) => boolean
    }
    expect(isValidOsTransition('rascunho', 'faturada')).toBe(true)
  })

  it('rascunho → cancelada is allowed', async () => {
    const { isValidOsTransition } = await import(OS_MATH_MOD) as {
      isValidOsTransition: (from: string, to: string) => boolean
    }
    expect(isValidOsTransition('rascunho', 'cancelada')).toBe(true)
  })

  it('faturada → rascunho is REJECTED', async () => {
    const { isValidOsTransition } = await import(OS_MATH_MOD) as {
      isValidOsTransition: (from: string, to: string) => boolean
    }
    expect(isValidOsTransition('faturada', 'rascunho')).toBe(false)
  })

  it('cancelada → anything is REJECTED', async () => {
    const { isValidOsTransition } = await import(OS_MATH_MOD) as {
      isValidOsTransition: (from: string, to: string) => boolean
    }
    expect(isValidOsTransition('cancelada', 'rascunho')).toBe(false)
    expect(isValidOsTransition('cancelada', 'faturada')).toBe(false)
  })
})

// ─── faturarOs — idempotency + CAS + particular/convenio branches (D-30, OS-03) ─

describe('service-orders.ts — faturarOs idempotency (D-30)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('D-30 idempotency: second faturarOs on already-faturada OS returns { success: true } without re-calling createCharge', async () => {
    const mod = await import(OS_ACTION_MOD) as {
      faturarOs: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ status: string; pagador: string; idempotency_key: string | null }>
          casUpdate?: () => Promise<{ data: { id: string }[] | null }>
          createCharge?: () => Promise<{ success: boolean }>
        }
      ) => Promise<{ success: boolean; error?: string }>
    }

    const createChargeMock = vi.fn().mockResolvedValue({ success: true })

    // Simulate OS already faturada — status is not 'rascunho'
    const getOsMock = vi.fn().mockResolvedValue({
      status: 'faturada',
      pagador: 'particular',
      idempotency_key: 'os:test-id:faturar',
    })

    const result = await mod.faturarOs('test-id', {}, {
      getOs: getOsMock,
      createCharge: createChargeMock,
    })

    expect(result.success).toBe(true)
    expect(createChargeMock).not.toHaveBeenCalled()
  })

  it('D-30 CAS: when CAS UPDATE returns 0 rows, faturarOs returns error mentioning corrida/race', async () => {
    const mod = await import(OS_ACTION_MOD) as {
      faturarOs: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ status: string; pagador: string; idempotency_key: string | null }>
          casUpdate?: () => Promise<{ data: { id: string }[] | null }>
          createCharge?: () => Promise<{ success: boolean }>
        }
      ) => Promise<{ success: boolean; error?: string }>
    }

    // OS is rascunho so transition is valid, but CAS returns 0 rows (concurrent write)
    const getOsMock = vi.fn().mockResolvedValue({
      status: 'rascunho',
      pagador: 'particular',
      idempotency_key: null,
    })
    const casUpdateMock = vi.fn().mockResolvedValue({ data: [] }) // 0 rows — race detected

    const result = await mod.faturarOs('test-id', {}, {
      getOs: getOsMock,
      casUpdate: casUpdateMock,
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/corrida|race/i)
  })
})

describe('service-orders.ts — faturarOs particular/convenio branches (OS-03)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('OS-03 particular: faturarOs calls createCharge exactly once', async () => {
    const mod = await import(OS_ACTION_MOD) as {
      faturarOs: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ status: string; pagador: string; idempotency_key: string | null; patient_id?: string; insurer_id?: string | null }>
          casUpdate?: () => Promise<{ data: { id: string }[] | null }>
          createCharge?: () => Promise<{ success: boolean }>
          insertInsurerReceivable?: () => Promise<{ success: boolean }>
        }
      ) => Promise<{ success: boolean; error?: string }>
    }

    const createChargeMock = vi.fn().mockResolvedValue({ success: true })
    const insurerReceivableMock = vi.fn().mockResolvedValue({ success: true })

    const getOsMock = vi.fn().mockResolvedValue({
      status: 'rascunho',
      pagador: 'particular',
      idempotency_key: null,
      patient_id: 'patient-uuid',
      insurer_id: null,
    })
    const casUpdateMock = vi.fn().mockResolvedValue({ data: [{ id: 'test-id' }] })

    await mod.faturarOs('test-id', {}, {
      getOs: getOsMock,
      casUpdate: casUpdateMock,
      createCharge: createChargeMock,
      insertInsurerReceivable: insurerReceivableMock,
    })

    expect(createChargeMock).toHaveBeenCalledTimes(1)
    expect(insurerReceivableMock).not.toHaveBeenCalled()
  })

  it('OS-03 convenio: faturarOs does NOT call createCharge but inserts insurer receivable', async () => {
    const mod = await import(OS_ACTION_MOD) as {
      faturarOs: (
        osId: string,
        input: Record<string, unknown>,
        deps?: {
          getOs?: () => Promise<{ status: string; pagador: string; idempotency_key: string | null; patient_id?: string; insurer_id?: string | null }>
          casUpdate?: () => Promise<{ data: { id: string }[] | null }>
          createCharge?: () => Promise<{ success: boolean }>
          insertInsurerReceivable?: () => Promise<{ success: boolean }>
        }
      ) => Promise<{ success: boolean; error?: string }>
    }

    const createChargeMock = vi.fn().mockResolvedValue({ success: true })
    const insurerReceivableMock = vi.fn().mockResolvedValue({ success: true })

    const getOsMock = vi.fn().mockResolvedValue({
      status: 'rascunho',
      pagador: 'convenio',
      idempotency_key: null,
      patient_id: 'patient-uuid',
      insurer_id: 'insurer-uuid',
    })
    const casUpdateMock = vi.fn().mockResolvedValue({ data: [{ id: 'test-id' }] })

    await mod.faturarOs('test-id', {}, {
      getOs: getOsMock,
      casUpdate: casUpdateMock,
      createCharge: createChargeMock,
      insertInsurerReceivable: insurerReceivableMock,
    })

    expect(createChargeMock).not.toHaveBeenCalled()
    expect(insurerReceivableMock).toHaveBeenCalledTimes(1)
  })
})
