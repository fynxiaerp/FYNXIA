// src/lib/messaging/worker.ts
// Outbox worker drain loop — processes pending message_outbox rows and sends them.
//
// IMPORTANT (Pitfall 7): this is a lib, not a route. The `runtime = 'nodejs'`
// declaration belongs on the cron route (Plan 04-04), not here.
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { sendTemplateMessage, isPermanentError } from '@/lib/whatsapp/client'
import { getResend } from '@/lib/resend'
import type { OutboxRow } from './types'

/**
 * Drains `pending` rows from `message_outbox` and sends them via the appropriate channel.
 *
 * Design guarantees:
 *  - Selects ONLY `status = 'pending'` rows — already-`sent` rows are never reprocessed.
 *  - Increments `attempts` BEFORE sending (Pitfall 5 — at-least-once cron safety).
 *  - Per-row try/catch ensures one row's failure never aborts the loop.
 *  - Permanent WhatsApp errors (131026, 132000, 132001, 190) → mark `failed` immediately.
 *  - Transient errors → leave `pending` for the next cron invocation.
 *  - Logs only IDs/channel to logBusinessEvent (no PHI — T-4-worker-phi).
 *
 * @param admin - Admin Supabase client (bypasses RLS). Defaults to createAdminClient().
 * @param batchSize - Maximum rows to process per invocation. Default 100.
 */
export async function drainOutbox(
  admin = createAdminClient(),
  batchSize = 100
): Promise<{ processed: number; failed: number; skipped: number }> {
  let processed = 0
  let failed = 0
  let skipped = 0

  // Fetch pending rows whose scheduled_for is in the past
  const { data: rows, error: fetchError } = await admin
    .from('message_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(batchSize)

  if (fetchError) {
    console.error('[worker] Failed to fetch outbox rows:', fetchError.message)
    return { processed, failed, skipped }
  }

  const eligibleRows = (rows ?? []).filter(
    (row: OutboxRow) => row.attempts < row.max_attempts
  )

  // Rows fetched but filtered out (attempts already at max but still pending — defensive)
  skipped = (rows?.length ?? 0) - eligibleRows.length

  for (const row of eligibleRows) {
    const now = new Date().toISOString()

    // Step 1: Bump attempts BEFORE sending (Pitfall 5 — idempotency on cron retry)
    await admin
      .from('message_outbox')
      .update({ attempts: row.attempts + 1, last_attempted_at: now })
      .eq('id', row.id)

    let sendSuccess = false
    let errorMessage: string | undefined
    let errorCode: number | undefined

    try {
      if (row.channel === 'whatsapp') {
        // ── WhatsApp channel ──────────────────────────────────────────────────
        const result = await sendTemplateMessage(
          row.payload as Parameters<typeof sendTemplateMessage>[0]
        )
        sendSuccess = result.success
        if (!result.success) {
          errorMessage = result.error
          errorCode = result.errorCode
        }
      } else {
        // ── Email channel ─────────────────────────────────────────────────────
        // TODO(Plan 04): kind-switch email branch — import AppointmentReminderEmail
        // and build the React element based on payload.kind (e.g. 'appointment_reminder').
        // Plan 04 Task 1 adds worker.ts to files_modified and extends this branch.
        const emailPayload = row.payload as {
          to: string | string[]
          subject: string
          html: string
        }
        const { error: emailError } = await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'FYNXIA <onboarding@resend.dev>',
          to: emailPayload.to,
          subject: emailPayload.subject,
          html: emailPayload.html ?? '',
        })
        sendSuccess = !emailError
        if (emailError) {
          errorMessage = typeof emailError === 'string'
            ? emailError
            : (emailError as { message?: string }).message ?? 'Email send error'
        }
      }
    } catch (err) {
      sendSuccess = false
      errorMessage = err instanceof Error ? err.message : String(err)
    }

    if (sendSuccess) {
      // Step 3: Mark sent
      await admin
        .from('message_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)

      // Audit log — IDs only, no PHI (T-4-worker-phi)
      await logBusinessEvent({
        tenantId: row.tenant_id,
        actorId: null,
        action: 'message.sent',
        details: { outbox_id: row.id, channel: row.channel },
      })

      processed++
    } else {
      // Step 4: Determine if permanent failure
      const permanent =
        row.channel === 'whatsapp' && isPermanentError(errorCode)
      const newAttempts = row.attempts + 1
      const final = permanent || newAttempts >= row.max_attempts

      await admin
        .from('message_outbox')
        .update({
          status: final ? 'failed' : 'pending',
          error_message: errorMessage ?? 'Unknown error',
        })
        .eq('id', row.id)

      if (final) {
        failed++
      }
    }
  }

  return { processed, failed, skipped }
}
