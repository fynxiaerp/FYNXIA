// src/lib/integrations/types.ts
// Shared types for the integration hub (Phase 9 — INT-01/02/03).
// Pure type file — no 'server-only' needed (type-only exports, no runtime secrets).

// ─── Connector type enum ──────────────────────────────────────────────────────

export type ConnectorType = 'asaas' | 'whatsapp' | 'email' | 'nfse' | 'banco' | 'tiss'

// ─── Connector status ─────────────────────────────────────────────────────────

export type IntegrationStatus = 'enabled' | 'disabled'

// ─── Event direction ──────────────────────────────────────────────────────────

export type EventDirection = 'inbound' | 'outbound'

// ─── Integration event status ─────────────────────────────────────────────────

export type IntegrationEventStatus = 'received' | 'pending' | 'processed' | 'failed'

// ─── ConnectorHealth ──────────────────────────────────────────────────────────
// Derived at read time from recent integration_events; not stored in DB.

export type ConnectorHealth = 'ok' | 'degraded' | 'failed' | 'unknown'

// ─── ConnectorRow — mirrors integration_connectors table ─────────────────────

export interface ConnectorRow {
  id: string
  clinic_id: string | null        // NULLABLE: system sentinel rows have clinic_id = NULL
  type: ConnectorType
  config: Record<string, unknown> // NON-sensitive metadata only (endpoint URLs, template ids, phone)
  credential_enc: string | null   // AES-256-GCM ciphertext; NULL for placeholder rows
  status: IntegrationStatus
  created_at: string
  updated_at: string
}

// ─── IntegrationEventRow — mirrors integration_events table ──────────────────

export interface IntegrationEventRow {
  id: string
  clinic_id: string | null        // NULLABLE: WhatsApp unresolved-tenant path; system events
  connector_id: string | null     // NULLABLE: event logged before connector row exists
  direction: EventDirection
  status: IntegrationEventStatus
  event_type: string | null       // e.g. 'PAYMENT_RECEIVED', 'message', 'nfse_emitted'
  external_event_id: string | null // provider dedup key (nullable for outbound)
  payload_ref: string | null      // opaque ref: webhook_events.id as TEXT
  attempts: number
  max_attempts: number
  last_error: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}
