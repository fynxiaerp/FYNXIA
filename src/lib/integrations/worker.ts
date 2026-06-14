// src/lib/integrations/worker.ts
// Integration events retry worker — drains pending integration_events rows (INT-03).
//
// PATTERN: mirrors drainOutbox (src/lib/messaging/worker.ts) — same atomic CAS claim.
//
// DESIGN:
//   - Selects ONLY status='pending' rows (failed rows re-queued by the manual reprocess
//     Server Action in Plan 05 — keeps this worker simple and the CAS guard exact).
//   - ATOMIC CLAIM (CAS): UPDATE with .eq('status','pending').eq('attempts', row.attempts)
//     so only one concurrent drain wins the row. 0 rows returned → already claimed → skip.
//   - For this phase (09-03), no outbound protocol senders exist yet (NFS-e/banco/TISS land
//     in Phases 15/16). A pending inbound row is marked 'processed' if claimable, establishing
//     the idempotent CAS pattern for future senders to extend.
//
// IMPORTANT (Pitfall 7): 'runtime = nodejs' belongs on the cron route, NOT here.
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegrationEventRow } from './types'

/**
 * Drains `pending` rows from `integration_events` and processes them atomically.
 *
 * Design guarantees (mirrors drainOutbox):
 *  - Selects ONLY `status = 'pending'` rows — received/processed/failed rows are never touched.
 *  - ATOMIC CLAIM (CAS): the attempts-bump UPDATE is conditional on the row still being
 *    `status='pending'` AND still carrying the `attempts` value we read. Only one concurrent
 *    drain can win; losers see 0 rows returned and skip (T-09-12).
 *  - Per-row try/catch: one row's failure never aborts the loop.
 *  - Logs only IDs/status (no PHI, no credentials — T-09-14).
 *
 * @param admin     Admin Supabase client (bypasses RLS). Defaults to createAdminClient().
 * @param batchSize Maximum rows to process per invocation. Default 100.
 */
export async function drainIntegrationEvents(
  admin: SupabaseClient = createAdminClient(),
  batchSize = 100
): Promise<{ processed: number; failed: number; skipped: number }> {
  let processed = 0
  let failed = 0
  let skipped = 0

  // Fetch ONLY pending rows (oldest first — fairness).
  // 'failed' rows are re-queued to 'pending' by the manual reprocess Server Action (Plan 05).
  const { data: rows, error: fetchError } = await admin
    .from('integration_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (fetchError) {
    console.error('[int-worker] fetch error:', fetchError.message)
    return { processed, failed, skipped }
  }

  const eligible = (rows ?? []).filter(
    (r: IntegrationEventRow) => r.attempts < r.max_attempts
  )

  // Rows fetched but filtered out (attempts at max but still pending — defensive)
  skipped = (rows?.length ?? 0) - eligible.length

  for (const row of eligible) {
    const now = new Date().toISOString()

    // ATOMIC CLAIM (CAS) — mirror drainOutbox: only the original reader wins.
    // Both .eq('status', 'pending') AND .eq('attempts', row.attempts) must match.
    // If another drain already bumped attempts, 0 rows are returned → skip (T-09-12).
    const { data: claimed, error: claimErr } = await admin
      .from('integration_events')
      .update({ attempts: row.attempts + 1, updated_at: now })
      .eq('id', row.id)
      .eq('status', 'pending')       // optimistic guard — loser sees 0 rows
      .eq('attempts', row.attempts)  // CAS on attempts — only the original reader wins
      .select('id')

    if (claimErr) {
      console.error('[int-worker] claim failed', row.id, claimErr.message)
      continue
    }
    if (!claimed || claimed.length === 0) {
      // Another overlapping drain already claimed this row — skip (T-09-12).
      skipped++
      continue
    }

    // Process: mark row as 'processed'.
    // Phase 09-03 note: no outbound protocol senders yet (NFS-e/banco/TISS land in Phases 15/16).
    // The pattern is established here; future phases extend the try block with sender logic.
    try {
      await admin
        .from('integration_events')
        .update({ status: 'processed', processed_at: now })
        .eq('id', row.id)
      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // attempts was already incremented by the CAS claim above.
      const newAttempts = row.attempts + 1
      const final = newAttempts >= row.max_attempts
      await admin
        .from('integration_events')
        .update({ status: final ? 'failed' : 'pending', last_error: msg })
        .eq('id', row.id)
      if (final) failed++
    }
  }

  return { processed, failed, skipped }
}
