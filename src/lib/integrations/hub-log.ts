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
  //
  // WR-03: validate clinicId is a well-formed UUID before interpolating into the PostgREST
  // .or() filter string. A non-UUID value would corrupt the filter syntax and cause a runtime
  // query error (swallowed by catch{}) — logging the event with connector_id = null instead
  // of the real connector row (silent degradation). Validation prevents this by falling back
  // to the system-sentinel branch when clinicId is not a valid UUID. No SQL injection risk
  // (PostgREST parses its own filter syntax), but this is a robustness guard for future callers.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const safeClinicId = clinicId && UUID_RE.test(clinicId) ? clinicId : null
  let connectorId: string | null = null
  try {
    const { data } = await admin
      .from('integration_connectors')
      .select('id, clinic_id')
      .eq('type', connectorType)
      .or(safeClinicId ? `clinic_id.eq.${safeClinicId},clinic_id.is.null` : 'clinic_id.is.null')
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
