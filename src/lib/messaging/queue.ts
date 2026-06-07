// src/lib/messaging/queue.ts
// MessageQueue interface (D-01 abstraction seam) + OutboxQueue implementation.
//
// The interface decouples enqueue callers from the concrete queue implementation.
// Future swap to pgmq/pg_cron (Supabase Pro) = new adapter behind this interface,
// no changes to callers (mirrors PaymentGateway/AsaasAdapter pattern from Phase 3).
import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { EnqueueOptions } from './types'

// ─── MessageQueue interface (D-01) ───────────────────────────────────────────

export interface MessageQueue {
  enqueue(opts: EnqueueOptions): Promise<{ success: boolean; error?: string }>
}

// ─── OutboxQueue implementation ───────────────────────────────────────────────

/**
 * OutboxQueue implements MessageQueue using the `message_outbox` PostgreSQL table.
 *
 * Idempotency: A duplicate idempotency_key causes a UNIQUE violation (Postgres code
 * 23505) which is treated as idempotent success — the message is already enqueued.
 */
export class OutboxQueue implements MessageQueue {
  constructor(
    private admin: ReturnType<typeof createAdminClient>
  ) {}

  async enqueue(opts: EnqueueOptions): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.admin.from('message_outbox').insert({
      tenant_id: opts.tenantId,
      channel: opts.channel,
      payload: opts.payload,
      idempotency_key: opts.idempotencyKey,
      scheduled_for: (opts.scheduledFor ?? new Date()).toISOString(),
      max_attempts: opts.maxAttempts ?? 3,
    })

    if (error) {
      // 23505 = PostgreSQL unique_violation — already enqueued (idempotent skip)
      if (error.code === '23505') return { success: true }
      return { success: false, error: error.message }
    }

    return { success: true }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Returns an OutboxQueue backed by the admin (service-role) Supabase client. */
export function getOutboxQueue(admin = createAdminClient()): OutboxQueue {
  return new OutboxQueue(admin)
}
