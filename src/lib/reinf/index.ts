/**
 * src/lib/reinf/index.ts — Credential-gated ReinfProvider factory (TRIB-03)
 *
 * getReinfProvider: queries integration_connectors for a 'reinf' connector
 * belonging to the clinic. No credentials → StubReinfProvider (dev/test).
 * Credentials present → StubReinfProvider (TecnospeedReinfProvider gated — future).
 *
 * SECURITY:
 *   server-only: credential_enc read server-side only — never exposed to client.
 *   T-16-11: credential_enc gates stub-vs-real; never returned, only consumed.
 *   Mirrors src/lib/fiscal/index.ts (getFiscalProvider) pattern exactly.
 *
 * NOTE: accepts optional adminClient for dependency injection in tests (avoids
 * needing real Supabase env vars). Production callers omit the second argument.
 */
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { StubReinfProvider } from './stub'
import type { ReinfProvider } from './types'

export type { ReinfProvider, ReinfEventInput, ReinfEventResult } from './types'

export async function getReinfProvider(
  clinicId: string,
  // Optional dep-injection for tests (mock admin client)
  adminClient?: unknown
): Promise<ReinfProvider> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = adminClient ?? createAdminClient()

  const { data: connector } = await admin
    .from('integration_connectors')
    .select('id, credential_enc, config, status')
    .eq('clinic_id', clinicId)
    .eq('type', 'reinf')
    .eq('status', 'enabled')
    .single()

  // Gate on credentials — no credentials (or no connector) = STUB (D-18/D-22)
  if (!connector?.credential_enc) {
    return new StubReinfProvider()
  }

  // TecnospeedReinfProvider(connector.credential_enc) — gated until real adapter activated
  return new StubReinfProvider()
}
