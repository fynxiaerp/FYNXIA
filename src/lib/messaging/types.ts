// src/lib/messaging/types.ts
// Shared types for the messaging outbox infrastructure (Plan 04-02).
import 'server-only'

// ─── Channel + status enums ───────────────────────────────────────────────────

export type Channel = 'whatsapp' | 'email'

export type OutboxStatus = 'pending' | 'sent' | 'failed'

// ─── OutboxRow — mirrors message_outbox table columns ────────────────────────

export interface OutboxRow {
  id: string
  tenant_id: string
  channel: Channel
  status: OutboxStatus
  attempts: number
  max_attempts: number
  payload: Record<string, unknown>
  idempotency_key: string
  scheduled_for: string           // TIMESTAMPTZ as ISO string
  last_attempted_at: string | null
  sent_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// ─── EnqueueOptions — caller API ─────────────────────────────────────────────

export interface EnqueueOptions {
  tenantId: string
  channel: Channel
  /** Caller-controlled dedup key. UNIQUE constraint on message_outbox prevents double-enqueue. */
  idempotencyKey: string
  payload: Record<string, unknown>
  scheduledFor?: Date
  maxAttempts?: number
}
