/**
 * src/lib/reinf/stub.ts — StubReinfProvider (TRIB-03)
 *
 * Development/test stub: returns 'transmitido' synchronously with no external calls.
 * Used when no integration_connectors row with type='reinf' + credential_enc exists.
 *
 * No 'server-only' — importable by tests directly.
 * Mirrors src/lib/fiscal/stub.ts (StubFiscalProvider) pattern.
 */

import type { ReinfProvider, ReinfEventInput, ReinfEventResult } from './types'

export class StubReinfProvider implements ReinfProvider {
  async transmitir(input: ReinfEventInput): Promise<ReinfEventResult> {
    return {
      provider_ref: `stub-reinf:${input.idempotency_key}`,
      status: 'transmitido',
      protocolo: `STUB-${Date.now()}`,
    }
  }

  async consultar(provider_ref: string): Promise<ReinfEventResult> {
    return { provider_ref, status: 'transmitido' }
  }

  async retificar(provider_ref: string, input: ReinfEventInput): Promise<ReinfEventResult> {
    return {
      provider_ref: `stub-reinf:retif:${input.idempotency_key}`,
      status: 'transmitido',
    }
  }
}
