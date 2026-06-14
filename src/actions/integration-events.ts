'use server'
/**
 * Integration Events Server Actions — INT-03 / Phase 9 Plan 05
 *
 * Provides health read + reprocess mutations for integration_events.
 * Mirrors integration-connectors.ts patterns exactly:
 *   1. assertNotReadOnly()   — blocks auditor/dpo/socio (mutations only)
 *   2. role gate             — admin/superadmin/ti only (mutations)
 *   3. createAdminClient()   — service role for all DB access (bypasses RLS)
 *   4. logBusinessEvent      — audit WITHOUT payloads or credentials (T-09-21)
 *
 * SECURITY:
 *   T-09-20: credential never in scope — listConnectorHealth reads events, not connectors/credentials.
 *   T-09-21: lastError is event.last_error (an error message string); payload_ref bodies never returned.
 *   T-09-22: assertNotReadOnly() + role gate on reprocessConnector; listConnectorHealth is read-only.
 *   T-09-23: reprocess only flips tenant-scoped failed→pending for rows with attempts < max_attempts.
 *   T-09-24: every query is .eq('clinic_id', actor.tenant_id) (cross-tenant isolation).
 *   T-09-25: RSC will pass only the plain health array — no functions/components/server objects.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { deriveHealth } from '@/lib/integrations/health'
import type { ConnectorHealth } from '@/lib/integrations/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-connector health view — the only connector-related data returned to the client.
 * Never includes credential_enc, payload bodies, or config secrets (T-09-21).
 */
export interface ConnectorHealthView {
  connectorId: string | null
  type: string
  status: 'enabled' | 'disabled'
  health: ConnectorHealth        // derived via deriveHealth(recentEvents)
  lastError: string | null       // most recent failed event's last_error (never a payload/secret)
  failedCount: number
}

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Helper: getActor ─────────────────────────────────────────────────────────

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── listConnectorHealth ──────────────────────────────────────────────────────

/**
 * Lists per-connector health derived from integration_events (last 24h, tenant-scoped).
 * Read-only — no assertNotReadOnly() needed; auditor/dpo/socio may call this.
 * Never returns credential_enc, payload bodies, or config secrets (T-09-21).
 */
export async function listConnectorHealth(): Promise<{
  success: boolean
  health?: ConnectorHealthView[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const adminClient = createAdminClient()

  // Load this tenant's active connectors (id, type, status — NO credential_enc).
  // WR-02: filter deleted_at IS NULL so soft-deleted connectors are excluded from health view.
  const { data: connectors, error: connErr } = await adminClient
    .from('integration_connectors')
    .select('id, type, status')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)

  if (connErr) {
    return { success: false, error: connErr.message }
  }

  // Load recent events (tenant-scoped, last 24h) for health derivation.
  // Selects only what deriveHealth needs: status, created_at, last_error, connector_id.
  // NEVER selects payload_ref bodies (T-09-21).
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentEvents, error: evtErr } = await adminClient
    .from('integration_events')
    .select('connector_id, status, created_at, last_error')
    .eq('clinic_id', actor.tenant_id)
    .gte('created_at', cutoff)

  if (evtErr) {
    return { success: false, error: evtErr.message }
  }

  // Group events by connector_id.
  const eventsByConnector = new Map<
    string,
    { status: string; created_at: string; last_error: string | null }[]
  >()

  for (const evt of recentEvents ?? []) {
    const key = evt.connector_id ?? '__null__'
    if (!eventsByConnector.has(key)) {
      eventsByConnector.set(key, [])
    }
    eventsByConnector.get(key)!.push(evt)
  }

  // Build a ConnectorHealthView per connector.
  const health: ConnectorHealthView[] = (connectors ?? []).map((connector) => {
    const events = eventsByConnector.get(connector.id) ?? []

    // deriveHealth expects Pick<IntegrationEventRow, 'status' | 'created_at'>.
    const healthStatus: ConnectorHealth = deriveHealth(
      events.map((e) => ({ status: e.status as never, created_at: e.created_at }))
    )

    const failedEvents = events.filter((e) => e.status === 'failed')
    const failedCount = failedEvents.length

    // lastError: most recent failed event's last_error — an error message string, never a payload body.
    const sortedFailed = [...failedEvents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const lastError = sortedFailed[0]?.last_error ?? null

    return {
      connectorId: connector.id,
      type: connector.type,
      status: connector.status as 'enabled' | 'disabled',
      health: healthStatus,
      lastError,
      failedCount,
    }
  })

  return { success: true, health }
}

// ─── reprocessConnector ───────────────────────────────────────────────────────

/**
 * Re-queues a connector's failed events back to pending for the cron worker to drain.
 *
 * Only re-queues rows with attempts < max_attempts (idempotent gate).
 * assertNotReadOnly() FIRST — blocks auditor/dpo/socio (T-09-22).
 * Role gate: admin/superadmin/ti only (T-09-22).
 * Tenant-scoped — cross-tenant isolation (T-09-24).
 *
 * The cron worker (Plan 03 drainIntegrationEvents) owns the atomic CAS claim
 * and drains exactly once even if two drains race (T-09-23).
 */
export async function reprocessConnector(
  connectorId: string
): Promise<{ success: boolean; requeued?: number; error?: string }> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer (T-09-22)
  await assertNotReadOnly()

  // 2. Auth + role gate — admin/superadmin/ti only (T-09-22)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Acesso restrito' }
  }

  const adminClient = createAdminClient()

  // 3. Fetch failed rows for this connector (tenant-scoped).
  //    Cannot compare two columns inline in Supabase JS, so fetch first then filter in JS.
  const { data: failedRows, error: fetchErr } = await adminClient
    .from('integration_events')
    .select('id, attempts, max_attempts')
    .eq('connector_id', connectorId)
    .eq('clinic_id', actor.tenant_id)
    .eq('status', 'failed')

  if (fetchErr) {
    return { success: false, error: fetchErr.message }
  }

  // 4. Filter to rows that have NOT exhausted max_attempts (idempotent guard — T-09-23).
  const eligible = (failedRows ?? []).filter((r) => r.attempts < r.max_attempts)

  if (eligible.length === 0) {
    return { success: true, requeued: 0 }
  }

  const ids = eligible.map((r) => r.id)

  // 5. Flip eligible failed rows back to pending (reset last_error).
  //    The cron worker's CAS guard ensures exactly-once drain even if re-queued twice.
  //    Defense-in-depth: redundant clinic_id guard on UPDATE so future refactors cannot
  //    accidentally promote rows from other tenants even if the SELECT scope changes (WR-01).
  const { error: updateErr } = await adminClient
    .from('integration_events')
    .update({ status: 'pending', last_error: null })
    .in('id', ids)
    .eq('clinic_id', actor.tenant_id)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  // 6. Audit log — NO payloads, NO credentials (T-09-21).
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'connector.reprocess',
    details: { connectorId, requeued: ids.length },
  })

  return { success: true, requeued: ids.length }
}
