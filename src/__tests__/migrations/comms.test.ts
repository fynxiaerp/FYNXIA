/**
 * Phase 4 communications migrations — SQL assertion tests
 * Pattern: readFileSync + toMatch (mirrors clinical.test.ts + financial.test.ts)
 *
 * comms.test.ts is RED until Task 1+2 author the 2 migration files.
 * After Task 2 (db push), these assertions go GREEN.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 4 comms migrations — tables (20260607000100)', () => {
  it('message_channel and message_status enums exist (COMMS-04)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/CREATE TYPE public\.message_channel AS ENUM/i)
    expect(sql).toMatch(/'whatsapp'/)
    expect(sql).toMatch(/'email'/)
    expect(sql).toMatch(/CREATE TYPE public\.message_status\s+AS ENUM/i)
    expect(sql).toMatch(/'pending'/)
    expect(sql).toMatch(/'sent'/)
    expect(sql).toMatch(/'failed'/)
  })

  it('message_outbox table exists with required columns (COMMS-04)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/CREATE TABLE public\.message_outbox/i)
    expect(sql).toMatch(/attempts/)
    expect(sql).toMatch(/max_attempts/)
    expect(sql).toMatch(/payload\s+JSONB/i)
    expect(sql).toMatch(/idempotency_key/)
    expect(sql).toMatch(/scheduled_for/)
  })

  it('message_outbox has UNIQUE idempotency_key (COMMS-04 dedup)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/UNIQUE\s*\(idempotency_key\)/i)
  })

  it('message_log table exists (COMMS-04 reminder dedup)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/CREATE TABLE public\.message_log/i)
  })

  it('message_log has UNIQUE (appointment_id, channel, type) dedup key (D-04)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/UNIQUE\s*\(appointment_id,\s*channel,\s*type\)/i)
  })

  it('tenant_id indexes exist for both tables (RLS performance)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/idx_message_outbox_tenant/i)
    expect(sql).toMatch(/idx_message_log_tenant/i)
  })

  it('composite drain index exists on message_outbox (performance — Pattern 4)', () => {
    const sql = M('20260607000100_message_outbox.sql')
    expect(sql).toMatch(/idx_message_outbox_status/i)
  })
})

describe('Phase 4 comms migrations — RLS (20260607000200)', () => {
  it('RLS enabled on message_outbox (T-4-outbox-I)', () => {
    const rls = M('20260607000200_message_outbox_rls.sql')
    expect(rls).toMatch(/ALTER TABLE public\.message_outbox ENABLE ROW LEVEL SECURITY/i)
  })

  it('RLS enabled on message_log (T-4-log-I)', () => {
    const rls = M('20260607000200_message_outbox_rls.sql')
    expect(rls).toMatch(/ALTER TABLE public\.message_log ENABLE ROW LEVEL SECURITY/i)
  })

  it('RLS policies use tenant_id = get_my_tenant_id() USING + WITH CHECK on both tables', () => {
    const rls = M('20260607000200_message_outbox_rls.sql')
    // USING clause
    expect(rls).toMatch(/USING\s*\(\s*tenant_id\s*=\s*get_my_tenant_id\(\)/i)
    // WITH CHECK clause
    expect(rls).toMatch(/WITH CHECK\s*\(\s*tenant_id\s*=\s*get_my_tenant_id\(\)/i)
  })

  it('NO client UPDATE/DELETE policy on message_outbox (T-4-outbox-T — worker uses service role)', () => {
    const rls = M('20260607000200_message_outbox_rls.sql')
    // There must be no UPDATE or DELETE policy targeting message_outbox via client RLS
    expect(rls).not.toMatch(/message_outbox.*FOR\s+(UPDATE|DELETE)/i)
  })
})
