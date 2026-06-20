/**
 * Phase 15 — TISS behavior tests (CONV-02, CONV-03, D-28)
 * Test type: source-inspection (types.ts) + absolute-path dynamic-import guard (D-144)
 *
 * All tests are RED until Wave 5 plans create src/lib/tiss/*.ts and src/actions/tiss.ts.
 *
 * Requirements encoded:
 *   CONV-02 — TissProvider interface present (sendLote/createGuia)
 *   CONV-02 — StubTissProvider.sendLote returns a protocolo
 *   CONV-02 — criarGuia inserts tiss_guides row with status='em_analise'
 *   CONV-02 — fecharLote groups guides by insurer, calls provider.sendLote, stores protocolo
 *   CONV-03 — registrarGlosa sets motivo_glosa_id, valor_glosado, glosa_status='glosada'
 *   CONV-03 — registrarRecurso sets glosa_status='em_recurso'
 *   D-28    — computeGuiaGlosaTotals: sum(valor_glosado) integer-cent = guide valor_glosado
 *             valorAutorizado = valorTotal − valorGlosado
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module paths (absolute — D-144) ─────────────────────────────────────────

const TISS_TYPES_MOD  = join(process.cwd(), 'src/lib/tiss/types.ts')
const TISS_STUB_MOD   = join(process.cwd(), 'src/lib/tiss/stub.ts')
const GLOSA_MATH_MOD  = join(process.cwd(), 'src/lib/tiss/glosa-math.ts')
const TISS_ACTION_MOD = join(process.cwd(), 'src/actions/tiss.ts')

// ─── TissProvider interface — source-inspection (CONV-02) ────────────────────

describe('src/lib/tiss/types.ts — TissProvider interface', () => {
  it('src/lib/tiss/types.ts exists (RED until Wave 5 creates it)', () => {
    expect(existsSync(TISS_TYPES_MOD)).toBe(true)
  })

  it('exports TissProvider interface with sendLote( or createGuia( method', () => {
    const src = existsSync(TISS_TYPES_MOD) ? readFileSync(TISS_TYPES_MOD, 'utf-8') : ''
    expect(src).toMatch(/sendLote\(|createGuia\(/)
  })
})

// ─── StubTissProvider — sendLote returns protocolo (CONV-02) ─────────────────

describe('src/lib/tiss/stub.ts — StubTissProvider', () => {
  it('src/lib/tiss/stub.ts exists (RED until Wave 5 creates it)', () => {
    expect(existsSync(TISS_STUB_MOD)).toBe(true)
  })

  it('StubTissProvider.sendLote returns a protocolo', async () => {
    const { StubTissProvider } = await import(TISS_STUB_MOD) as {
      StubTissProvider: new () => {
        sendLote: (input: Record<string, unknown>) => Promise<{ protocolo: string }>
      }
    }
    const stub = new StubTissProvider()
    const result = await stub.sendLote({ loteId: 'lote-uuid', guides: [] })
    expect(result.protocolo).toBeDefined()
    expect(typeof result.protocolo).toBe('string')
    expect(result.protocolo.length).toBeGreaterThan(0)
  })
})

// ─── computeGuiaGlosaTotals — D-28 glosa math ────────────────────────────────

describe('src/lib/tiss/glosa-math.ts — computeGuiaGlosaTotals (D-28)', () => {
  it('src/lib/tiss/glosa-math.ts exists (RED until Wave 5 creates it)', () => {
    expect(existsSync(GLOSA_MATH_MOD)).toBe(true)
  })

  it('sum(valor_glosado) across items equals total guide valor_glosado (integer-cent)', async () => {
    const { computeGuiaGlosaTotals } = await import(GLOSA_MATH_MOD) as {
      computeGuiaGlosaTotals: (
        items: { valorTotal: number; valorGlosado: number }[]
      ) => { valorGlosado: number; valorAutorizado: number }
    }
    const items = [
      { valorTotal: 500, valorGlosado: 50 },
      { valorTotal: 300, valorGlosado: 30 },
    ]
    const totals = computeGuiaGlosaTotals(items)
    expect(totals.valorGlosado).toBe(80)
  })

  it('valorAutorizado = valorTotal − valorGlosado (D-28)', async () => {
    const { computeGuiaGlosaTotals } = await import(GLOSA_MATH_MOD) as {
      computeGuiaGlosaTotals: (
        items: { valorTotal: number; valorGlosado: number }[]
      ) => { valorGlosado: number; valorAutorizado: number }
    }
    const items = [
      { valorTotal: 500, valorGlosado: 50 },
      { valorTotal: 300, valorGlosado: 30 },
    ]
    const totals = computeGuiaGlosaTotals(items)
    // valorAutorizado = (500+300) - (50+30) = 720
    expect(totals.valorAutorizado).toBe(720)
  })

  it('integer-cent: valorGlosado result has at most 2 decimal places', async () => {
    const { computeGuiaGlosaTotals } = await import(GLOSA_MATH_MOD) as {
      computeGuiaGlosaTotals: (
        items: { valorTotal: number; valorGlosado: number }[]
      ) => { valorGlosado: number; valorAutorizado: number }
    }
    const items = [
      { valorTotal: 333.33, valorGlosado: 33.33 },
      { valorTotal: 100.00, valorGlosado: 0 },
    ]
    const totals = computeGuiaGlosaTotals(items)
    expect(Math.round(totals.valorGlosado * 100)).toBe(totals.valorGlosado * 100)
    expect(Math.round(totals.valorAutorizado * 100)).toBe(totals.valorAutorizado * 100)
  })
})

// ─── criarGuia — CONV-02: inserts tiss_guides with status='em_analise' ────────

describe('src/actions/tiss.ts — criarGuia (CONV-02)', () => {
  beforeEach(() => { vi.resetModules() })

  it('src/actions/tiss.ts exists (RED until Wave 5 creates it)', () => {
    expect(existsSync(TISS_ACTION_MOD)).toBe(true)
  })

  it('CONV-02: criarGuia inserts a tiss_guides row with status=em_analise', async () => {
    const mod = await import(TISS_ACTION_MOD) as {
      criarGuia: (
        input: { serviceOrderId: string; insurerId: string; patientId: string },
        deps?: {
          insertGuia?: (data: { status: string }) => Promise<{ id: string; status: string }>
        }
      ) => Promise<{ success: boolean; guiaId?: string }>
    }

    const insertGuiaMock = vi.fn().mockImplementation(async (data: { status: string }) => ({
      id: 'guia-uuid',
      status: data.status,
    }))

    await mod.criarGuia(
      { serviceOrderId: 'os-uuid', insurerId: 'insurer-uuid', patientId: 'patient-uuid' },
      { insertGuia: insertGuiaMock }
    )

    expect(insertGuiaMock).toHaveBeenCalledTimes(1)
    const callArg = insertGuiaMock.mock.calls[0][0] as { status: string }
    expect(callArg.status).toBe('em_analise')
  })
})

// ─── fecharLote — CONV-02: groups guides, calls sendLote, stores protocolo ────

describe('src/actions/tiss.ts — fecharLote (CONV-02)', () => {
  beforeEach(() => { vi.resetModules() })

  it('CONV-02: fecharLote calls provider.sendLote with grouped guides', async () => {
    const mod = await import(TISS_ACTION_MOD) as {
      fecharLote: (
        loteId: string,
        deps?: {
          getLoteGuides?: () => Promise<{ id: string; insurer_id: string; service_order_id: string }[]>
          getProvider?: () => { sendLote: (input: Record<string, unknown>) => Promise<{ protocolo: string }> }
          updateLote?: (data: { protocolo: string; status: string }) => Promise<void>
        }
      ) => Promise<{ success: boolean; protocolo?: string }>
    }

    const sendLoteMock = vi.fn().mockResolvedValue({ protocolo: 'PROT-001' })
    const updateLoteMock = vi.fn().mockResolvedValue(undefined)

    await mod.fecharLote('lote-uuid', {
      getLoteGuides: vi.fn().mockResolvedValue([
        { id: 'guia-1', insurer_id: 'insurer-uuid', service_order_id: 'os-1' },
        { id: 'guia-2', insurer_id: 'insurer-uuid', service_order_id: 'os-2' },
      ]),
      getProvider: () => ({ sendLote: sendLoteMock }),
      updateLote: updateLoteMock,
    })

    expect(sendLoteMock).toHaveBeenCalledTimes(1)
  })

  it('CONV-02: fecharLote stores returned protocolo on tiss_lotes', async () => {
    const mod = await import(TISS_ACTION_MOD) as {
      fecharLote: (
        loteId: string,
        deps?: {
          getLoteGuides?: () => Promise<{ id: string; insurer_id: string; service_order_id: string }[]>
          getProvider?: () => { sendLote: (input: Record<string, unknown>) => Promise<{ protocolo: string }> }
          updateLote?: (data: { protocolo: string; status?: string }) => Promise<void>
        }
      ) => Promise<{ success: boolean; protocolo?: string }>
    }

    const updateLoteMock = vi.fn().mockResolvedValue(undefined)

    const result = await mod.fecharLote('lote-uuid', {
      getLoteGuides: vi.fn().mockResolvedValue([
        { id: 'guia-1', insurer_id: 'insurer-uuid', service_order_id: 'os-1' },
      ]),
      getProvider: () => ({ sendLote: vi.fn().mockResolvedValue({ protocolo: 'PROT-002' }) }),
      updateLote: updateLoteMock,
    })

    // protocolo should be stored on the lote
    const updateCallArg = updateLoteMock.mock.calls[0][0] as { protocolo: string }
    expect(updateCallArg.protocolo).toBe('PROT-002')
    // result should also expose protocolo
    expect(result.protocolo).toBe('PROT-002')
  })
})

// ─── registrarGlosa — CONV-03: sets glosada status per item ──────────────────

describe('src/actions/tiss.ts — registrarGlosa (CONV-03)', () => {
  beforeEach(() => { vi.resetModules() })

  it('CONV-03: registrarGlosa sets glosa_status=glosada, motivo_glosa_id, valor_glosado on item', async () => {
    const mod = await import(TISS_ACTION_MOD) as {
      registrarGlosa: (
        itemId: string,
        motivoId: string,
        valorGlosado: number,
        deps?: {
          updateItem?: (data: { glosa_status: string; motivo_glosa_id: string; valor_glosado: number }) => Promise<void>
        }
      ) => Promise<{ success: boolean }>
    }

    const updateItemMock = vi.fn().mockResolvedValue(undefined)

    await mod.registrarGlosa('item-uuid', 'motivo-uuid', 50, {
      updateItem: updateItemMock,
    })

    expect(updateItemMock).toHaveBeenCalledTimes(1)
    const callArg = updateItemMock.mock.calls[0][0] as {
      glosa_status: string
      motivo_glosa_id: string
      valor_glosado: number
    }
    expect(callArg.glosa_status).toBe('glosada')
    expect(callArg.motivo_glosa_id).toBe('motivo-uuid')
    expect(callArg.valor_glosado).toBe(50)
  })
})

// ─── registrarRecurso — CONV-03: sets glosa_status='em_recurso' ──────────────

describe('src/actions/tiss.ts — registrarRecurso (CONV-03)', () => {
  beforeEach(() => { vi.resetModules() })

  it('CONV-03: registrarRecurso sets glosa_status=em_recurso with recurso_texto', async () => {
    const mod = await import(TISS_ACTION_MOD) as {
      registrarRecurso: (
        itemId: string,
        texto: string,
        deps?: {
          updateItem?: (data: { glosa_status: string; recurso_texto: string; recurso_at: string }) => Promise<void>
        }
      ) => Promise<{ success: boolean }>
    }

    const updateItemMock = vi.fn().mockResolvedValue(undefined)

    await mod.registrarRecurso('item-uuid', 'Procedimento realizado conforme protocolo', {
      updateItem: updateItemMock,
    })

    expect(updateItemMock).toHaveBeenCalledTimes(1)
    const callArg = updateItemMock.mock.calls[0][0] as { glosa_status: string; recurso_texto: string }
    expect(callArg.glosa_status).toBe('em_recurso')
    expect(callArg.recurso_texto).toBe('Procedimento realizado conforme protocolo')
  })
})
