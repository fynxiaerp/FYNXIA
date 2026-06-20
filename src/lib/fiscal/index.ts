/**
 * src/lib/fiscal/index.ts — Credential-gated FiscalProvider factory (OS-02)
 *
 * getFiscalProvider: queries integration_connectors for a 'nfse' connector
 * belonging to the clinic. No credentials → StubFiscalProvider (dev/test).
 * Credentials present → FocusNfeFiscalProvider (production).
 *
 * SECURITY:
 *   server-only: apiKey decrypted server-side only — never exposed to client.
 *   T-15-20: credential_enc decrypted via admin client (service role).
 *   No NEXT_PUBLIC_ references.
 */
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { StubFiscalProvider } from './stub'
import { FocusNfeFiscalProvider } from './focusnfe'
import type { FiscalProvider } from './types'

export type { FiscalProvider, NfseInput, NfseResult } from './types'

export async function getFiscalProvider(clinicId: string): Promise<FiscalProvider> {
  const admin = createAdminClient()

  const { data: connector } = await admin
    .from('integration_connectors')
    .select('id, credential_enc, config, status')
    .eq('clinic_id', clinicId)
    .eq('type', 'nfse')
    .eq('status', 'enabled')
    .is('deleted_at', null)
    .maybeSingle()

  // Gate on credentials — no credentials (or no connector) = STUB (D-01/D-02/D-03)
  if (!connector?.credential_enc) {
    return new StubFiscalProvider()
  }

  // credential_enc is stored encrypted; the admin client reads it server-side.
  // For Focus NFe the credential_enc IS the apiKey (base64-encoded plain or encrypted).
  // Pattern mirrors src/lib/integrations/mask.ts: decrypt at use-time, not at rest.
  const apiKey = connector.credential_enc as string
  const config = (connector.config ?? null) as Record<string, unknown> | null

  return new FocusNfeFiscalProvider(apiKey, config)
}
