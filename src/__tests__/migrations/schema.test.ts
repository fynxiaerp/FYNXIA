import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) => readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 1 migrations', () => {
  it('renames tenants to clinics', () => {
    const sql = M('20260604000200_rename_tenants_to_clinics.sql')
    expect(sql).toMatch(/ALTER TABLE public\.tenants RENAME TO clinics/i)
    expect(sql).toMatch(/ADD COLUMN cnpj/i)
    expect(sql).toMatch(/idx_clinics_cnpj/i)
  })
  it('creates invitations with 24h expiry', () => {
    const sql = M('20260604000300_clinics_users_phase1.sql')
    expect(sql).toMatch(/CREATE TABLE public\.invitations/i)
    expect(sql).toMatch(/interval '24 hours'/i)
    expect(sql).toMatch(/CREATE TABLE public\.patient_consents/i)
    expect(sql).toMatch(/audit_logs_2026_07/i)
    expect(sql).toMatch(/audit_logs_2026_08/i)
    expect(sql).toMatch(/SECURITY DEFINER/i)
  })
  it('creates masked view', () => {
    const sql = M('20260604000400_rls_phase1.sql')
    expect(sql).toMatch(/CREATE OR REPLACE VIEW public\.users_masked/i)
  })
})
