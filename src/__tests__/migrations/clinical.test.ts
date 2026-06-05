import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

describe('Phase 2 clinical migrations', () => {
  it('appointments uses btree_gist + EXCLUDE USING GIST (CLINIC-02)', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS btree_gist/i)
    expect(sql).toMatch(/EXCLUDE USING GIST/i)
    expect(sql).toMatch(/tstzrange\(start_time, end_time, '\[\)'\)/i)
    expect(sql).toMatch(/WHERE \(status NOT IN \('cancelado'\)\)/i)
  })
  it('patients has CPF plaintext unique-per-tenant + AES columns + LGPD fields (CLINIC-03, SEC-04)', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.patients/i)
    expect(sql).toMatch(/idx_patients_cpf_tenant/i)
    expect(sql).toMatch(/medical_history TEXT/i)
    expect(sql).toMatch(/is_anonymized\s+BOOLEAN/i)
    expect(sql).toMatch(/deleted_at\s+TIMESTAMPTZ/i)
  })
  it('dental_records enforces FDI tooth_number + 9 statuses (CLINIC-06)', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/tooth_number BETWEEN 11 AND 18/i)
    expect(sql).toMatch(/tooth_number BETWEEN 41 AND 48/i)
    for (const s of ['higido','cariado','extraido','em_tratamento','implante','coroa','selante','fraturado','restaurado']) {
      expect(sql).toContain(`'${s}'`)
    }
  })
  it('medical_records + anamneses tables exist with required fields (CLINIC-05, CLINIC-08)', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/CREATE TABLE public\.medical_records/i)
    expect(sql).toMatch(/diagnosis\s+TEXT/i)
    expect(sql).toMatch(/treatment_plan\s+TEXT/i)
    expect(sql).toMatch(/prescription\s+TEXT/i)
    expect(sql).toMatch(/CREATE TABLE public\.anamneses/i)
    expect(sql).toMatch(/signature_hash\s+TEXT\s+NOT NULL/i)
    expect(sql).toMatch(/token_expires_at/i)
    expect(sql).toMatch(/token_used_at/i)
  })
  it('audit triggers attach to clinical tables (SEC-03)', () => {
    const sql = M('20260605000100_clinical_tables.sql')
    expect(sql).toMatch(/CREATE TRIGGER audit_patients[\s\S]*audit_table_changes/i)
    expect(sql).toMatch(/CREATE TRIGGER audit_appointments[\s\S]*audit_table_changes/i)
    expect(sql).toMatch(/CREATE TRIGGER audit_medical_records[\s\S]*audit_table_changes/i)
  })
  it('dental_records write policy is role-gated to admin/dentist (D-15)', () => {
    const sql = M('20260605000200_clinical_rls.sql')
    expect(sql).toMatch(/dental_records/i)
    expect(sql).toMatch(/get_my_role\(\) IN \('admin','dentist'\)/i)
  })
  it('2026_09 audit partition created proactively', () => {
    const sql = M('20260605000300_clinical_audit_partitions.sql')
    expect(sql).toMatch(/audit_logs_2026_09/i)
  })
})
