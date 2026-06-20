/**
 * src/lib/fiscal/stub.ts — StubFiscalProvider (OS-02)
 *
 * Development/test stub: returns 'emitida' synchronously with no external calls.
 * Used when no integration_connectors row with type='nfse' + credential_enc exists.
 *
 * No 'server-only' — importable by tests directly.
 * No NEXT_PUBLIC_ credentials.
 */

import type { FiscalProvider, NfseInput, NfseResult } from './types'

export class StubFiscalProvider implements FiscalProvider {
  async emit(input: NfseInput): Promise<NfseResult> {
    return {
      provider_ref: `stub:${input.idempotency_key}`,
      numero: `STUB-${Date.now()}`,
      serie: 'STUB',
      status: 'emitida',
      xml_url: undefined,
      pdf_url: undefined,
    }
  }

  async query(provider_ref: string): Promise<NfseResult> {
    return { provider_ref, status: 'emitida' }
  }

  async cancel(_provider_ref: string, _motivo: string): Promise<{ success: boolean }> {
    return { success: true }
  }
}
