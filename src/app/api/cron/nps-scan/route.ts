/**
 * GET /api/cron/nps-scan
 *
 * Vercel Cron endpoint — runs nightly at 23:00 UTC (20:00 BRT — D-12 "à noite").
 * CRC-04: Self-healing scan of concluded ('concluido') appointments, creates a
 * single-use NPS invite token per appointment (D-13) and enqueues it via
 * WhatsApp/email through the Phase 4 outbox, then drains the outbox — all in one
 * invocation (structurally mirrors /api/cron/collection-agent).
 *
 * SECURITY (T-18-22):
 * - Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch before any
 *   DB query. isCronAuthorized is fail-closed (rejects when CRON_SECRET is unset).
 *
 * IDEMPOTENCY / SELF-HEALING (T-18-23, Pitfall 5):
 * - nps_responses.appointment_id is UNIQUE — re-runs (including a missed night
 *   caught by the next run) never double-invite the same appointment.
 * - message_outbox idempotency_key = 'nps-invite:{appointmentId}:{channel}'.
 *
 * RUNTIME: Node.js — Edge has no 'net' module for Supabase TCP connections.
 */
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { drainOutbox } from '@/lib/messaging/worker'
import { runNpsInviteScan } from '@/lib/crc/nps-scan'

export async function GET(request: Request): Promise<Response> {
  // ── CRON_SECRET validation (fail-closed) ──────────────────────────────────
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // ── Run CRC-04 NPS invite scan (scan concluded, create token, enqueue) ────
  const result = await runNpsInviteScan(admin)

  // ── Drain outbox (send queued WhatsApp/email invites) ─────────────────────
  const drain = await drainOutbox(admin)

  return Response.json({
    ...result,
    drained: drain.processed,
    failed: drain.failed,
  })
}
