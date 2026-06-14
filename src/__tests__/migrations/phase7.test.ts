/**
 * Phase 7 migrations — source-inspection test scaffold (RED by design)
 *
 * These tests assert SQL content that will be written in Plans 02 & 03.
 * They are intentionally RED now and turn GREEN when the migration files exist.
 * Convention: M(filename) reads from supabase/migrations/ — no DB connection.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const M = (f: string) => readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8')

// ─── Plan 02: units table ────────────────────────────────────────────────────

describe('Phase 7 migrations — units table (20260614000100)', () => {
  it('creates public.units table', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/CREATE TABLE public\.units/i)
  })

  it('has clinic_id FK referencing public.clinics', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/clinic_id.*REFERENCES public\.clinics/i)
  })

  it('has is_default column', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/is_default/i)
  })

  it('has soft-delete (deleted_at) column', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/deleted_at/i)
  })

  it('has index on clinic_id', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/CREATE INDEX.*ON public\.units.*clinic_id/i)
  })

  it('backfills one default unit per existing clinic', () => {
    const sql = M('20260614000100_units_table.sql')
    expect(sql).toMatch(/INSERT INTO public\.units/i)
    expect(sql).toMatch(/is_default.*true/i)
  })
})

// ─── Plan 02: clinics.regime_tributario column ───────────────────────────────

describe('Phase 7 migrations — clinics regime_tributario (20260614000150)', () => {
  it('adds regime_tributario column to clinics', () => {
    const sql = M('20260614000150_clinics_regime.sql')
    expect(sql).toMatch(/ADD COLUMN regime_tributario/i)
  })

  it('CHECK constraint includes simples_nacional', () => {
    const sql = M('20260614000150_clinics_regime.sql')
    expect(sql).toMatch(/simples_nacional/i)
  })

  it('CHECK constraint includes lucro_presumido', () => {
    const sql = M('20260614000150_clinics_regime.sql')
    expect(sql).toMatch(/lucro_presumido/i)
  })

  it('CHECK constraint includes lucro_real', () => {
    const sql = M('20260614000150_clinics_regime.sql')
    expect(sql).toMatch(/lucro_real/i)
  })

  it('CHECK constraint includes mei', () => {
    const sql = M('20260614000150_clinics_regime.sql')
    expect(sql).toMatch(/mei/i)
  })
})

// ─── Plan 02: user_units N:N + get_my_unit_ids() ────────────────────────────

describe('Phase 7 migrations — user_units + get_my_unit_ids (20260614000300)', () => {
  it('creates public.user_units table', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/CREATE TABLE public\.user_units/i)
  })

  it('has UNIQUE (user_id, unit_id) constraint', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/UNIQUE.*user_id.*unit_id|UNIQUE.*unit_id.*user_id/i)
  })

  it('has index on user_id', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/CREATE INDEX.*ON public\.user_units.*user_id/i)
  })

  it('has index on unit_id', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/CREATE INDEX.*ON public\.user_units.*unit_id/i)
  })

  it('has index on clinic_id', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/CREATE INDEX.*ON public\.user_units.*clinic_id/i)
  })

  it('defines get_my_unit_ids() returning UUID array', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/get_my_unit_ids/i)
    expect(sql).toMatch(/RETURNS UUID\[\]/i)
  })

  it('get_my_unit_ids() is SECURITY DEFINER', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/SECURITY DEFINER/i)
  })

  it('get_my_unit_ids() has SET search_path = public', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/SET search_path = public/i)
  })

  it('get_my_unit_ids() has REVOKE EXECUTE from PUBLIC', () => {
    const sql = M('20260614000300_user_units.sql')
    expect(sql).toMatch(/REVOKE EXECUTE/i)
  })
})

// ─── Plan 02: role expansion (users + invitations) ──────────────────────────

describe('Phase 7 migrations — role expansion (20260614000400)', () => {
  it('includes dpo in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/dpo/i)
  })

  it('includes auditor in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/auditor/i)
  })

  it('includes socio in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/socio/i)
  })

  it('includes ti in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/\bti\b/i)
  })

  it('includes implantacao in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/implantacao/i)
  })

  it('includes aluno in users role CHECK', () => {
    const sql = M('20260614000400_role_expansion.sql')
    expect(sql).toMatch(/aluno/i)
  })

  it('updates invitations table role CHECK as well', () => {
    const sql = M('20260614000400_role_expansion.sql')
    // Must update both users AND invitations (Pitfall 7)
    expect(sql).toMatch(/public\.invitations/i)
    expect(sql).toMatch(/dpo/i)
  })
})

// ─── Plan 03: certificates table + icp-certificates bucket ──────────────────

describe('Phase 7 migrations — certificates table (20260614000500)', () => {
  it('creates public.certificates table', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/CREATE TABLE public\.certificates/i)
  })

  it('has subject_cn column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/subject_cn/i)
  })

  it('has cnpj column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/cnpj/i)
  })

  it('has not_before column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/not_before/i)
  })

  it('has not_after column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/not_after/i)
  })

  it('has thumbprint_sha1 column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/thumbprint_sha1/i)
  })

  it('has storage_path column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/storage_path/i)
  })

  it('has cert_password_enc column', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/cert_password_enc/i)
  })

  it('creates private icp-certificates storage bucket', () => {
    const sql = M('20260614000500_certificates.sql')
    expect(sql).toMatch(/INSERT INTO storage\.buckets/i)
    expect(sql).toMatch(/icp-certificates/i)
    expect(sql).toMatch(/public.*false|false.*public/i)
  })
})

// ─── Plan 03: ai_agent_config table ─────────────────────────────────────────

describe('Phase 7 migrations — ai_agent_config table (20260614000600)', () => {
  it('creates public.ai_agent_config table', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/CREATE TABLE public\.ai_agent_config/i)
  })

  it('has agent_key column', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/agent_key/i)
  })

  it('has autonomy_level CHECK with L0-L4 values', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/autonomy_level/i)
    expect(sql).toMatch(/L0.*L1.*L2.*L3.*L4|L0|L1|L2|L3|L4/i)
  })

  it('has enabled column', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/\benabled\b/i)
  })

  it('has limits jsonb column', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/limits.*jsonb|jsonb.*limits/i)
  })

  it('has updated_by column', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/updated_by/i)
  })

  it('has partial unique index WHERE unit_id IS NULL', () => {
    const sql = M('20260614000600_ai_agent_config.sql')
    expect(sql).toMatch(/WHERE unit_id IS NULL/i)
  })
})

// ─── Fix WR-02: certificates column-level REVOKE (20260614000900) ───────────

describe('Phase 7 fix — certificates REVOKE secret columns (20260614000900)', () => {
  it('migration file exists', () => {
    expect(() => M('20260614000900_certificates_revoke_secrets.sql')).not.toThrow()
  })

  it('REVOKEs SELECT on cert_password_enc from authenticated and anon', () => {
    const sql = M('20260614000900_certificates_revoke_secrets.sql')
    expect(sql).toMatch(/REVOKE SELECT/i)
    expect(sql).toMatch(/cert_password_enc/i)
    expect(sql).toMatch(/authenticated/i)
  })

  it('REVOKEs SELECT on storage_path from authenticated and anon', () => {
    const sql = M('20260614000900_certificates_revoke_secrets.sql')
    expect(sql).toMatch(/storage_path/i)
    expect(sql).toMatch(/anon/i)
  })

  it('targets public.certificates table', () => {
    const sql = M('20260614000900_certificates_revoke_secrets.sql')
    expect(sql).toMatch(/ON public\.certificates/i)
  })
})

// ─── Plan 03: operational unit_id backfill ───────────────────────────────────

describe('Phase 7 migrations — operational unit_id backfill (20260614000700)', () => {
  it('adds unit_id to appointments', () => {
    const sql = M('20260614000700_operational_unit_id.sql')
    expect(sql).toMatch(/ADD COLUMN unit_id/i)
    expect(sql).toMatch(/appointments/i)
  })

  it('backfills unit_id via UPDATE', () => {
    const sql = M('20260614000700_operational_unit_id.sql')
    expect(sql).toMatch(/UPDATE.*appointments|UPDATE.*charges|UPDATE.*receivables/i)
  })

  it('sets NOT NULL on unit_id after backfill', () => {
    const sql = M('20260614000700_operational_unit_id.sql')
    expect(sql).toMatch(/SET NOT NULL/i)
  })

  it('adds unit_id to charges', () => {
    const sql = M('20260614000700_operational_unit_id.sql')
    expect(sql).toMatch(/charges/i)
  })

  it('adds unit_id to receivables', () => {
    const sql = M('20260614000700_operational_unit_id.sql')
    expect(sql).toMatch(/receivables/i)
  })
})
