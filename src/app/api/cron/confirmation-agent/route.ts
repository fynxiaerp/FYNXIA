/**
 * GET /api/cron/confirmation-agent
 *
 * Vercel Cron endpoint — runs daily at 12:00 UTC (09:00 BRT).
 * Scans tomorrow's 'agendado' appointments, enqueues WhatsApp confirmation templates
 * via the Phase 4 outbox, then drains the outbox — all in one invocation.
 *
 * SECURITY (T-5-cron-E):
 * - Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch before any DB query.
 *   Vercel injects CRON_SECRET automatically on scheduled invocation.
 *
 * IDEMPOTENCY:
 * - message_outbox idempotency_key = 'confirmation:<appointmentId>' (UNIQUE) — re-runs
 *   on the same day enqueue the same message only once (23505 = idempotent skip).
 *
 * RUNTIME: Node.js — Edge has no 'net' module for Supabase TCP connections.
 *
 * Live send is UAT-deferred (Meta Business verification not yet complete).
 */
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { drainOutbox } from '@/lib/messaging/worker'
import { runConfirmationAgent } from '@/lib/agents/confirmation-agent'

export async function GET(request: Request): Promise<Response> {
  // ── CRON_SECRET validation ─────────────────────────────────────────────────
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // ── Run confirmation agent (scan + enqueue) ────────────────────────────────
  const { enqueued, skipped } = await runConfirmationAgent(admin)

  // ── Drain outbox (send queued messages) ───────────────────────────────────
  const drain = await drainOutbox(admin)

  return Response.json({
    enqueued,
    skipped,
    drained: drain.processed,
    failed: drain.failed,
  })
}
