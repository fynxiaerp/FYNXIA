// src/lib/integrations/health.ts
// Pure derivation function — no 'server-only', no DB calls.
// Health is computed at read time from recent integration_events — not stored in DB.
// Phase 9 INT-03: connector health derivation (T-09-05 panel).

import type { ConnectorHealth, IntegrationEventRow } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Derives a connector's health status from its recent integration events.
 *
 * Rules (from 09-RESEARCH.md Pattern 4):
 *   - No events at all              → 'unknown'
 *   - No events in last 24h         → 'unknown'
 *   - 0 failures in last 24h        → 'ok'
 *   - failed/total >= 0.5 (≥50%)   → 'failed'
 *   - any failures below threshold  → 'degraded'
 *
 * @param recentEvents Array of integration_events rows (any recency; function applies the 24h window).
 *   Caller should pass the last N events ordered by created_at DESC (e.g. last 100).
 */
export function deriveHealth(
  recentEvents: Pick<IntegrationEventRow, 'status' | 'created_at'>[]
): ConnectorHealth {
  if (recentEvents.length === 0) return 'unknown'

  const cutoff = Date.now() - DAY_MS
  const last24h = recentEvents.filter(
    (e) => new Date(e.created_at).getTime() > cutoff
  )

  if (last24h.length === 0) return 'unknown'

  const failed = last24h.filter((e) => e.status === 'failed').length

  if (failed === 0) return 'ok'
  if (failed / last24h.length >= 0.5) return 'failed'
  return 'degraded'
}
