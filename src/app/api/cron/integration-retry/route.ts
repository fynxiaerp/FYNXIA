/**
 * GET /api/cron/integration-retry
 *
 * Vercel Cron endpoint — runs every 15 minutes.
 * Drains pending integration_events rows via drainIntegrationEvents (atomic CAS).
 *
 * SECURITY (T-09-11):
 * - Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch before any DB query.
 *   isCronAuthorized fails CLOSED when CRON_SECRET is unset (misconfiguration).
 *   Vercel injects CRON_SECRET automatically on scheduled invocation.
 *
 * IDEMPOTENCY (T-09-12):
 * - drainIntegrationEvents uses atomic CAS on (status, attempts) — overlapping cron
 *   runs never double-process the same row.
 *
 * RUNTIME (T-09-15): Node.js — Edge has no 'net' module for Supabase TCP connections.
 */

// CRITICAL: Node.js runtime required (T-09-15 — Edge has no 'net' module)
export const runtime = 'nodejs'

import { isCronAuthorized } from '@/lib/cron-auth'
import { drainIntegrationEvents } from '@/lib/integrations/worker'

export async function GET(request: Request) {
  // ── CRON_SECRET validation (T-09-11, fail-closed) ───────────────────────────
  // Vercel injects Authorization: Bearer {CRON_SECRET} on scheduled invocation.
  // isCronAuthorized rejects when CRON_SECRET is unset and uses constant-time compare.
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await drainIntegrationEvents()
  return Response.json(result)
}
