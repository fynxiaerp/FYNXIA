// src/lib/integrations/hub-log.ts
// Fire-and-forget hub event logger (INT-02).
//
// SECURITY:
//   - server-only: must never run in client bundles (contains admin client usage)
//   - Null-safe connector resolution: never throws "connector not found"
//   - Logs ONLY IDs/type/status/last_error — never payload bodies or credentials (T-09-14)
//
// PATTERN: called from webhook handlers AFTER dedup, as:
//   logToHub({ ... }).catch((err) => console.error('[webhook] hub log error:', err))
// NEVER awaited in the 200-response path (T-09-09).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConnectorType, EventDirection, IntegrationEventStatus } from './types'

export async function logToHub(opts: {
  admin: SupabaseClient
  connectorType: ConnectorType
  direction: EventDirection
  clinicId?: string | null
  externalEventId?: string
  payloadRef?: string          // webhook_events.id as TEXT (opaque ref — not the payload itself)
  eventType?: string
  status?: IntegrationEventStatus
  lastError?: string
}): Promise<void> {
  const {
    admin,
    connectorType,
    direction,
    clinicId = null,
    externalEventId,
    payloadRef,
    eventType,
    status = 'received',
    lastError,
  } = opts

  // Null-safe connector resolution (T-09-14 / Pitfall 4):
  // Prefer the tenant's own connector row; fall back to the system sentinel (clinic_id IS NULL).
  // If none found, insert with connector_id = NULL — NEVER throw "connector not found".
  let connectorId: string | null = null
  try {
    const { data } = await admin
      .from('integration_connectors')
      .select('id, clinic_id')
      .eq('type', connectorType)
      .or(clinicId ? `clinic_id.eq.${clinicId},clinic_id.is.null` : 'clinic_id.is.null')
      .order('clinic_id', { ascending: false, nullsFirst: false }) // prefer non-null clinic row
      .limit(1)
      .maybeSingle()
    connectorId = data?.id ?? null
  } catch {
    // Connector resolution is best-effort; a lookup error must NEVER block the log insert
  }

  await admin.from('integration_events').insert({
    clinic_id: clinicId,
    connector_id: connectorId,
    direction,
    status,
    event_type: eventType ?? null,
    external_event_id: externalEventId ?? null,
    payload_ref: payloadRef ?? null,
    last_error: lastError ?? null,
  })
}
