/**
 * Phase 9 — INT-02 RED scaffold: integration_events migration + additive logToHub
 *
 * Asserts artifacts that Plan 02-03 will create. Tests are RED now:
 *  - _integration_events.sql migration does not exist
 *  - logToHub call not yet added to asaas/whatsapp handlers
 *  - src/lib/integrations/hub-log.ts does not exist
 *
 * REGRESSION-SAFE: also asserts that critical existing lines in the webhook
 * handlers still exist — a future additive edit that accidentally removes them
 * will turn these tests RED.
 *
 * Source-inspection convention: M(suffix) for migrations, SRC(relPath) for source files.
 * Both helpers are identical to connectors.test.ts and phase8.test.ts.
 *
 * Phase: 09-hub-de-integra-es-externas / Plan 01 (Wave 0 RED scaffold)
 * INT-02: integration_events table + additive hub log in Asaas/WhatsApp handlers
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolve } from 'node:path'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Read a migration file by suffix match (ignores timestamp prefix). Mirrors phase8.test.ts. */
function M(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  if (!match) {
    throw new Error(`Migration file ending with '${suffix}' not found in supabase/migrations/`)
  }
  return readFileSync(join(MIGRATIONS_DIR, match), 'utf8')
}

/**
 * Read a source file by relative path from process.cwd().
 * Returns '' (empty string) if missing — assertion fails on content, not on ENOENT.
 */
function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── INT-02: integration_events migration ─────────────────────────────────────

describe('Phase 9 migration — integration_events (INT-02)', () => {
  it('creates public.integration_events table', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/CREATE TABLE public\.integration_events/i)
  })

  it('has connector_id column (nullable FK to integration_connectors)', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/connector_id/i)
    expect(sql).toMatch(/REFERENCES public\.integration_connectors\(id\) ON DELETE SET NULL/i)
  })

  it('has direction TEXT with CHECK for inbound/outbound', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/direction\s+TEXT/i)
    expect(sql).toMatch(/CHECK/i)
    expect(sql).toMatch(/'inbound'/i)
    expect(sql).toMatch(/'outbound'/i)
  })

  it('has status TEXT with CHECK for received/pending/processed/failed', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/status\s+TEXT/i)
    expect(sql).toMatch(/'received'/i)
    expect(sql).toMatch(/'pending'/i)
    expect(sql).toMatch(/'processed'/i)
    expect(sql).toMatch(/'failed'/i)
  })

  it('has attempts INT column', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/attempts\s+INT/i)
  })

  it('has max_attempts INT column', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/max_attempts\s+INT/i)
  })

  it('has last_error column', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/last_error/i)
  })

  it('has external_event_id column', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/external_event_id/i)
  })

  it('has payload_ref column (opaque reference to webhook_events.id)', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/payload_ref/i)
  })

  it('has clinic_id column (NULLABLE — supports unresolved-tenant WhatsApp events)', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/clinic_id/i)
    // clinic_id must be NULLABLE (not NOT NULL) to support unresolved-tenant hub logging
    expect(sql).not.toMatch(/clinic_id\s+UUID\s+NOT NULL/i)
  })

  it('has index idx_integration_events_clinic', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/idx_integration_events_clinic/i)
  })

  it('has index idx_integration_events_connector', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/idx_integration_events_connector/i)
  })

  it('has index idx_integration_events_status', () => {
    const sql = M('_integration_events.sql')
    expect(sql).toMatch(/idx_integration_events_status/i)
  })

  it('does NOT reuse message_status ENUM (naming collision risk)', () => {
    const sql = M('_integration_events.sql')
    // integration_events must NOT reference message_status (belongs to message_outbox)
    expect(sql).not.toMatch(/message_status/)
  })

  it('does NOT reuse message_channel ENUM (naming collision risk)', () => {
    const sql = M('_integration_events.sql')
    // integration_events must NOT reference message_channel (belongs to message_outbox)
    expect(sql).not.toMatch(/message_channel/)
  })
})

// ─── INT-02: Asaas webhook handler — additive logToHub call ──────────────────

describe('Asaas webhook handler — additive logToHub (INT-02)', () => {
  const asaasSrc = SRC('src/app/api/webhooks/asaas/route.ts')

  // These two assertions are RED until Plan 03 adds the additive hub log call
  it('calls logToHub() for hub event logging', () => {
    expect(asaasSrc).toMatch(/logToHub\(/)
  })

  it('logToHub call uses fire-and-forget .catch() pattern', () => {
    expect(asaasSrc).toMatch(/\.catch\(/)
  })

  // REGRESSION-SAFE: assert that the critical existing lines still exist
  // If a future plan accidentally removes them, these tests turn RED
  it('[REGRESSION] asaas-access-token header validation still present', () => {
    expect(asaasSrc).toMatch(/asaas-access-token/)
  })

  it('[REGRESSION] ignoreDuplicates: true dedup mechanism still present', () => {
    expect(asaasSrc).toMatch(/ignoreDuplicates: true/)
  })

  it('[REGRESSION] returns new Response with status 200', () => {
    expect(asaasSrc).toMatch(/new Response\('', \{ status: 200 \}\)/)
  })

  it('[REGRESSION] processWebhookEvent fire-and-forget still called', () => {
    expect(asaasSrc).toMatch(/processWebhookEvent\(/)
  })
})

// ─── INT-02: WhatsApp webhook handler — additive logToHub call ───────────────

describe('WhatsApp webhook handler — additive logToHub (INT-02)', () => {
  const whatsappSrc = SRC('src/app/api/webhooks/whatsapp/route.ts')

  // These two assertions are RED until Plan 03 adds the additive hub log call
  it('calls logToHub() for hub event logging', () => {
    expect(whatsappSrc).toMatch(/logToHub\(/)
  })

  it('logToHub call uses fire-and-forget .catch() pattern', () => {
    expect(whatsappSrc).toMatch(/\.catch\(/)
  })

  // REGRESSION-SAFE: assert that the critical existing lines still exist
  it('[REGRESSION] verifyWhatsAppSignature validation still present', () => {
    expect(whatsappSrc).toMatch(/verifyWhatsAppSignature/)
  })

  it('[REGRESSION] 23505 unique violation dedup still present', () => {
    expect(whatsappSrc).toMatch(/'23505'/)
  })

  it('[REGRESSION] processInbound fire-and-forget still called', () => {
    expect(whatsappSrc).toMatch(/processInbound\(/)
  })

  it('[REGRESSION] export const runtime = "nodejs" still present', () => {
    expect(whatsappSrc).toMatch(/export const runtime = 'nodejs'/)
  })
})

// ─── INT-02: hub-log.ts source-inspection ─────────────────────────────────────

describe('Phase 9 — hub-log.ts (INT-02 fire-and-forget hub logging)', () => {
  const hubLogSrc = SRC('src/lib/integrations/hub-log.ts')

  it('exports async function logToHub', () => {
    expect(hubLogSrc).toMatch(/export async function logToHub/)
  })

  it('imports server-only (server-side only — cannot run on client)', () => {
    expect(hubLogSrc).toMatch(/import 'server-only'/)
  })

  it('inserts into integration_events table', () => {
    expect(hubLogSrc).toMatch(/integration_events/)
  })

  it('tolerates null connector_id (no connector row required for hub logging)', () => {
    // hub-log must handle missing connector row gracefully (null-safe)
    // It must NOT throw an error when no connector row is found
    expect(hubLogSrc).toMatch(/connector_id/)
    expect(hubLogSrc).not.toMatch(/throw new Error\('connector not found/)
  })
})
