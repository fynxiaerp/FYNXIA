// src/lib/messaging/worker.ts
// Outbox worker drain loop — processes pending message_outbox rows and sends them.
//
// IMPORTANT (Pitfall 7): this is a lib, not a route. The `runtime = 'nodejs'`
// declaration belongs on the cron route (Plan 04-04), not here.
import 'server-only'

import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { sendTemplateMessage, isPermanentError } from '@/lib/whatsapp/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { AppointmentReminderEmail } from '@/emails/AppointmentReminderEmail'
import type { AppointmentReminderEmailProps } from '@/emails/AppointmentReminderEmail'
import { CollectionReminderEmail } from '@/emails/CollectionReminderEmail'
import type { CollectionReminderEmailProps } from '@/emails/CollectionReminderEmail'
import type { OutboxRow } from './types'

/**
 * Drains `pending` rows from `message_outbox` and sends them via the appropriate channel.
 *
 * Design guarantees:
 *  - Selects ONLY `status = 'pending'` rows — already-`sent` rows are never reprocessed.
 *  - Increments `attempts` BEFORE sending (Pitfall 5 — at-least-once cron safety).
 *  - ATOMIC CLAIM (CR-02): the attempts-bump UPDATE is conditional on the row still
 *    being `status='pending'` AND still carrying the `attempts` value we read. The
 *    UPDATE returns the claimed row; 0 rows returned ⇒ a concurrent/overlapping drain
 *    already claimed it ⇒ skip. This prevents duplicate WhatsApp/email sends when
 *    Vercel Cron overlaps (at-least-once) or when both crons call drainOutbox().
 *  - WR-03/WR-04: claim and final-status UPDATE errors are checked. On a claim error
 *    we do NOT send (avoids widening the duplicate window); on a final-status error we
 *    emit a loud log so a sent-but-still-pending row is detectable.
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

    // Step 1: ATOMIC CLAIM (CR-02 + WR-03) — bump attempts BEFORE sending, but only
    // if the row is STILL pending AND STILL at the attempts value we read. This makes
    // the claim a single conditional UPDATE that only one concurrent drain can win:
    //   - matched row → we own it, proceed to send
    //   - 0 rows returned → another worker already claimed/sent it → skip (no send)
    //   - DB error → skip (do NOT send — avoids widening the duplicate window)
    const { data: claimed, error: claimErr } = await admin
      .from('message_outbox')
      .update({ attempts: row.attempts + 1, last_attempted_at: now })
      .eq('id', row.id)
      .eq('status', 'pending')        // optimistic guard — loser sees 0 rows
      .eq('attempts', row.attempts)   // CAS on attempts — only the original reader wins
      .select('id')

    if (claimErr) {
      console.error('[worker] claim update failed, skipping row', row.id, claimErr.message)
      continue
    }
    if (!claimed || claimed.length === 0) {
      // Another overlapping drain already claimed this row — skip to avoid double-send.
      skipped++
      continue
    }

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
        // Kind-switch: reconstruct React element from JSON-safe payload.kind + payload.props.
        // outbox.payload is JSONB — no React elements possible. The worker reconstructs
        // them here at drain time so each email type gets the correct template.
        const emailPayload = row.payload as {
          kind?: string
          to: string | string[]
          subject: string
          props?: Record<string, unknown>
          html?: string
        }

        let emailResult: { error?: unknown }
        if (emailPayload.kind === 'appointment_reminder') {
          // Build AppointmentReminderEmail from JSON props (COMMS-02 cross-plan contract)
          const element = createElement(
            AppointmentReminderEmail,
            emailPayload.props as unknown as AppointmentReminderEmailProps
          )
          emailResult = await getResend().emails.send({
            from: FROM_EMAIL,
            to: emailPayload.to,
            subject: emailPayload.subject,
            react: element,
          })
        } else if (emailPayload.kind === 'collection_reminder') {
          // WR-02: collection emails are now routed through the outbox so a transient
          // Resend failure retries (attempts/max_attempts) instead of being permanently
          // swallowed. Reconstruct CollectionReminderEmail from JSON-safe props.
          const element = createElement(
            CollectionReminderEmail,
            emailPayload.props as unknown as CollectionReminderEmailProps
          )
          emailResult = await getResend().emails.send({
            from: FROM_EMAIL,
            to: emailPayload.to,
            subject: emailPayload.subject,
            react: element,
          })
        } else {
          // Generic fallback: collection reminders + legacy payloads use html field
          emailResult = await getResend().emails.send({
            from: FROM_EMAIL,
            to: emailPayload.to,
            subject: emailPayload.subject,
            html: emailPayload.html ?? '',
          })
        }

        const { error: emailError } = emailResult
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
      // Step 3: Mark sent. WR-04: check the error — if this write fails the row stays
      // 'pending' and the next drain would re-send it (duplicate). Emit a loud log so
      // a sent-but-still-pending row is detectable; the atomic claim (CR-02) still
      // prevents a concurrent re-send within the same window.
      const { error: sentErr } = await admin
        .from('message_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)

      if (sentErr) {
        console.error(
          '[worker] SENT-BUT-PENDING: message was sent but status update failed — manual reconciliation needed',
          row.id,
          sentErr.message
        )
      }

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
      // attempts was already incremented by the atomic claim above (CR-02), so the
      // persisted attempts value is row.attempts + 1.
      const newAttempts = row.attempts + 1
      const final = permanent || newAttempts >= row.max_attempts

      // WR-04: check the error. A failed write here leaves the row at the claimed
      // attempts but with stale status — log loudly so it is detectable.
      const { error: failErr } = await admin
        .from('message_outbox')
        .update({
          status: final ? 'failed' : 'pending',
          error_message: errorMessage ?? 'Unknown error',
        })
        .eq('id', row.id)

      if (failErr) {
        console.error(
          '[worker] failed to write final status for row',
          row.id,
          failErr.message
        )
      }

      if (final) {
        failed++
      }
    }
  }

  return { processed, failed, skipped }
}
