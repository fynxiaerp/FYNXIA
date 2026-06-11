/**
 * GET /api/cron/collection-agent
 *
 * Vercel Cron endpoint — runs daily at 13:00 UTC (10:00 BRT).
 * AI-03: Scans all overdue receivables, personalizes a pt-BR collection message
 * via the LLM, attaches the REAL Asaas payment link, enqueues via the Phase 4 outbox,
 * then drains the outbox — all in one invocation.
 *
 * SECURITY (T-5-collect-cron):
 * - Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch before any DB query.
 *   Vercel injects CRON_SECRET automatically on scheduled invocation.
 *   isCronAuthorized is fail-closed (rejects when CRON_SECRET is unset).
 *
 * IDEMPOTENCY (T-5-collect-dup):
 * - message_outbox idempotency_key = 'collection-agent:{receivableId}:{date}' (UNIQUE).
 *   Re-runs on the same day enqueue the same send only once (23505 = idempotent skip).
 *
 * COEXISTENCE:
 * - Does NOT replace the collection-ruler cron (template reminders + email).
 * - Both crons are safe to run — drainOutbox selects status='pending' rows only
 *   (status-idempotent); already-sent rows from the ruler are never re-selected.
 *
 * RUNTIME: Node.js — Edge has no 'net' module for Supabase TCP connections.
 *
 * Live send is UAT-deferred (Meta Business verification not yet complete).
 */
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { drainOutbox } from '@/lib/messaging/worker'
import { runCollectionAgent } from '@/lib/agents/collection-agent'

export async function GET(request: Request): Promise<Response> {
  // ── CRON_SECRET validation (T-5-collect-cron) ─────────────────────────────
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // ── Run AI-03 collection agent (scan overdue, LLM personalize, enqueue) ───
  const result = await runCollectionAgent(admin)

  // ── Drain outbox (send queued WhatsApp messages) ──────────────────────────
  const drain = await drainOutbox(admin)

  return Response.json({
    ...result,
    whatsapp_drained: drain.processed,
    whatsapp_failed: drain.failed,
  })
}
