/**
 * Phase 3 financial migrations — SQL assertion tests
 * Pattern: readFileSync + toMatch (same as clinical.test.ts)
 *
 * These tests are RED until Task 1 authors the 3 migration files.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 3 financial migrations — tables (20260606000100)', () => {
  it('all 7 financial tables exist (FIN-01..07)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.financial_categories/i)
    expect(sql).toMatch(/CREATE TABLE public\.charges/i)
    expect(sql).toMatch(/CREATE TABLE public\.receivables/i)
    expect(sql).toMatch(/CREATE TABLE public\.financial_transactions/i)
    expect(sql).toMatch(/CREATE TABLE public\.webhook_events/i)
    expect(sql).toMatch(/CREATE TABLE public\.collection_rules/i)
    expect(sql).toMatch(/CREATE TABLE public\.collection_log/i)
  })

  it('charges table has provider-agnostic columns (D-01)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/provider\s+TEXT\s+NOT NULL\s+DEFAULT\s+'asaas'/i)
    expect(sql).toMatch(/provider_charge_id\s+TEXT/i)
    expect(sql).toMatch(/provider_installment_id\s+TEXT/i)
  })

  it('patients table amended with asaas_customer_id (D-06)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/ALTER TABLE public\.patients/i)
    expect(sql).toMatch(/asaas_customer_id\s+TEXT/i)
  })

  it('webhook_events has UNIQUE asaas_event_id (FIN-09, D-07)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/asaas_event_id\s+TEXT\s+NOT NULL\s+UNIQUE/i)
  })

  it('collection_log has UNIQUE (receivable_id, milestone, channel) (FIN-07, D-10)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/UNIQUE\s*\(receivable_id,\s*milestone,\s*channel\)/i)
  })

  it('audit trigger wired to financial_transactions (SEC-03 reuse)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/EXECUTE FUNCTION public\.audit_table_changes/i)
    expect(sql).toMatch(/financial_transactions[\s\S]*?audit_table_changes/i)
  })

  it('tenant_id indexes exist for financial tables', () => {
    const sql = M('20260606000100_financial_tables.sql')
    expect(sql).toMatch(/idx_charges_tenant/i)
    expect(sql).toMatch(/idx_receivables_tenant/i)
    expect(sql).toMatch(/idx_financial_transactions_tenant/i)
  })

  it('receivables status CHECK does NOT store vencido (D-04)', () => {
    const sql = M('20260606000100_financial_tables.sql')
    // vencido must be derived at read-time, never stored
    const receivablesSection = sql.substring(
      sql.indexOf('CREATE TABLE public.receivables'),
      sql.indexOf('CREATE TABLE public.financial_transactions')
    )
    expect(receivablesSection).not.toMatch(/'vencido'/)
  })
})

describe('Phase 3 financial migrations — RLS (20260606000200)', () => {
  it('RLS enabled on all tenant-scoped financial tables', () => {
    const sql = M('20260606000200_financial_rls.sql')
    expect(sql).toMatch(/ALTER TABLE public\.financial_categories ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/ALTER TABLE public\.charges ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/ALTER TABLE public\.receivables ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/ALTER TABLE public\.financial_transactions ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/ALTER TABLE public\.collection_rules ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/ALTER TABLE public\.collection_log ENABLE ROW LEVEL SECURITY/i)
  })

  it('all RLS policies use get_my_tenant_id() in USING and WITH CHECK (T-3-01)', () => {
    const sql = M('20260606000200_financial_rls.sql')
    expect(sql).toMatch(/USING\s*\(tenant_id\s*=\s*get_my_tenant_id\(\)/i)
    expect(sql).toMatch(/WITH CHECK\s*\(tenant_id\s*=\s*get_my_tenant_id\(\)/i)
  })

  it('webhook_events does NOT have RLS enabled (T-3-04 — service-role only)', () => {
    const sql = M('20260606000200_financial_rls.sql')
    // webhook_events should have no ENABLE ROW LEVEL SECURITY
    expect(sql).not.toMatch(/ALTER TABLE public\.webhook_events ENABLE ROW LEVEL SECURITY/i)
  })
})

describe('Phase 3 financial migrations — seed (20260606000300)', () => {
  it('seed_financial_categories function and trigger exist (D-05)', () => {
    const sql = M('20260606000300_financial_categories_seed.sql')
    expect(sql).toMatch(/seed_financial_categories/i)
    expect(sql).toMatch(/CREATE TRIGGER seed_categories_on_clinic/i)
  })

  it('seed includes dental income and expense category literals (D-05)', () => {
    const sql = M('20260606000300_financial_categories_seed.sql')
    expect(sql).toMatch(/'Consulta'/)
    expect(sql).toMatch(/'Aluguel'/)
  })
})
