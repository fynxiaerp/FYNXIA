/**
 * Phase 5 AI agents migrations — SQL assertion tests
 * Pattern: readFileSync + toMatch (mirrors comms.test.ts + financial.test.ts)
 *
 * ai.test.ts is RED until Task 1 authors the 3 migration files.
 * After Task 1 (migrations authored), these assertions go GREEN.
 * After Task 2 (db push), tables go live in Supabase sa-east-1.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 5 AI migrations — agent_outreach_log (20260610000100)', () => {
  it('agent_outreach_log table exists (AI-02, AI-03 audit trail)', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/CREATE TABLE public\.agent_outreach_log/i)
  })

  it('tenant_id FK references public.clinics (NOT tenants)', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/tenant_id\s+UUID NOT NULL REFERENCES public\.clinics\(id\)/i)
    // Must NOT reference old tenants table
    expect(sql).not.toMatch(/REFERENCES public\.tenants/i)
  })

  it('agent_type column with CHECK constraint (AI-02 confirmation + AI-03 collection)', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/agent_type\s+TEXT NOT NULL/i)
    expect(sql).toMatch(/CHECK \(agent_type IN \('confirmation', 'collection'\)\)/i)
  })

  it('whatsapp_message_id column exists (wamid tracking)', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/whatsapp_message_id\s+TEXT/i)
  })

  it('intent_result column exists (AI-02: confirm|cancel|ambiguous)', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/intent_result\s+TEXT/i)
  })

  it('tenant_id + created_at index exists for UI query performance', () => {
    const sql = M('20260610000100_agent_outreach_log.sql')
    expect(sql).toMatch(/idx_agent_outreach_log_tenant_created/i)
  })
})

describe('Phase 5 AI migrations — agent_outreach_log RLS (20260610000200)', () => {
  it('RLS enabled on agent_outreach_log (T-5-01)', () => {
    const rls = M('20260610000200_agent_outreach_log_rls.sql')
    expect(rls).toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })

  it('SELECT policy uses tenant_id = get_my_tenant_id() (T-5-01 tenant isolation)', () => {
    const rls = M('20260610000200_agent_outreach_log_rls.sql')
    expect(rls).toMatch(/FOR SELECT\s+USING \(tenant_id = get_my_tenant_id\(\)\)/i)
  })

  it('NO client INSERT/UPDATE/DELETE policy (T-5-02 — service-role writes only)', () => {
    const rls = M('20260610000200_agent_outreach_log_rls.sql')
    // Deliberately no client write paths — cron/webhook uses createAdminClient
    expect(rls).not.toMatch(/FOR (INSERT|UPDATE|DELETE)/i)
  })
})

describe('Phase 5 AI migrations — whatsapp_inbound_events (20260610000300)', () => {
  it('whatsapp_inbound_events table exists (AI-02 dedup, T-5-03)', () => {
    const sql = M('20260610000300_whatsapp_inbound_events.sql')
    expect(sql).toMatch(/CREATE TABLE public\.whatsapp_inbound_events/i)
  })

  it('wamid is TEXT UNIQUE NOT NULL (idempotency constraint, T-5-03)', () => {
    const sql = M('20260610000300_whatsapp_inbound_events.sql')
    expect(sql).toMatch(/wamid\s+TEXT UNIQUE NOT NULL/i)
  })

  it('processed BOOLEAN NOT NULL DEFAULT FALSE column exists', () => {
    const sql = M('20260610000300_whatsapp_inbound_events.sql')
    expect(sql).toMatch(/processed\s+BOOLEAN NOT NULL DEFAULT FALSE/i)
  })

  it('NO RLS on whatsapp_inbound_events (T-5-04 accepted — mirrors webhook_events)', () => {
    const sql = M('20260610000300_whatsapp_inbound_events.sql')
    // Service-role only — no RLS, mirrors Phase 3 webhook_events decision
    expect(sql).not.toMatch(/ENABLE ROW LEVEL SECURITY/i)
  })
})
