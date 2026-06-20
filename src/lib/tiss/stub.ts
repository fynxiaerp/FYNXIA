/**
 * src/lib/tiss/stub.ts — StubTissProvider (CONV-02, D-01/D-03/D-13)
 *
 * Used when no integration_connectors 'tiss' credential is present.
 * Returns deterministic-enough protocolo/provider_ref for dev/test.
 * Real XML adapter slots in via index.ts factory when credentials exist.
 *
 * No 'use server' — imported by index.ts which carries that boundary.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 */
import type { TissProvider, GuiaInput, GuiaResult, LoteInput, LoteResult } from './types'

export class StubTissProvider implements TissProvider {
  createGuia(input: GuiaInput): Promise<GuiaResult> {
    const ts = Date.now()
    return Promise.resolve({
      provider_ref: `stub:guia:${ts}`,
      numero_guia: `G${ts}`,
    })
  }

  sendLote(_input: LoteInput | Record<string, unknown>): Promise<LoteResult> {
    const ts = Date.now()
    return Promise.resolve({
      protocolo: `PROTO-${ts}`,
      status: 'em_analise' as const,
    })
  }

  queryLote(_ref: string): Promise<{ status: string; protocolo?: string }> {
    return Promise.resolve({ status: 'em_analise' })
  }
}
