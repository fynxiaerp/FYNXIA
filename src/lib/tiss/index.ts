/**
 * src/lib/tiss/index.ts — Credential-gated TissProvider factory (CONV-02, D-01/D-03/D-13)
 *
 * getTissProvider: queries integration_connectors for a 'tiss' connector.
 * No credential_enc → StubTissProvider (dev/test/unregistered clinic).
 * Credentials present → real adapter slot (TODO — gated per D-13, deferred).
 *
 * SECURITY:
 *   server-only: credential_enc decrypted server-side only — never exposed to client.
 *   T-15-25: insurer_id ownership enforced in tiss.ts callers via RLS + server check.
 *   No NEXT_PUBLIC_ references.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 */
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { StubTissProvider } from './stub'
import type { TissProvider } from './types'

export type { TissProvider, GuiaInput, LoteInput, LoteResult, GuiaResult } from './types'
export { computeGuiaGlosaTotals, deriveGuideStatus } from './glosa-math'

export async function getTissProvider(
  clinicId: string,
  _insurerId?: string,
): Promise<TissProvider> {
  const admin = createAdminClient()

  const { data: connector } = await admin
    .from('integration_connectors')
    .select('id, credential_enc, config, status')
    .eq('clinic_id', clinicId)
    .eq('type', 'tiss')
    .eq('status', 'enabled')
    .is('deleted_at', null)
    .maybeSingle()

  // Gate on credentials — no connector or no credential_enc = Stub (D-01/D-03)
  if (!connector?.credential_enc) {
    return new StubTissProvider()
  }

  // TODO (D-13): real TISS XML adapter — deferred until operadora credencials confirmed.
  // When a real adapter is needed, instantiate it here and return it.
  // For now, return Stub even when a connector row exists but has no real XML impl.
  return new StubTissProvider()
}
