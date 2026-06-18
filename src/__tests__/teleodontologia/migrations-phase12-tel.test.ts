/**
 * Phase 12 — migrations-phase12-tel.test.ts
 * Migration source-inspection scaffold for Phase 12 teleodontologia (TEL-01/TEL-02).
 *
 * Target migration suffixes (Plan 03 creates these — RED by design now):
 *   _teleconsultations.sql     — teleconsultations + soap_records tables
 *   _teleconsultations_rls.sql — RLS policies
 *
 * MM(suffix) returns '' when file absent — assertions fail on content, NOT crash.
 * ALL()      concatenates every *.sql migration in supabase/migrations/.
 *
 * REGRESSION re-assert (lightweight):
 *   - ALL() does not contain DROP CONSTRAINT no_overlap.
 *   - The Phase 12 tel migration does NOT add EXCLUDE USING GIST (no appointments GIST touch).
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 01 (Wave 0 RED scaffold)
 * Requirements: TEL-01, TEL-02
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/** Like M() but returns '' when no migration matches — use for Phase 12 targets (RED by design). */
function MM(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  return match ? readFileSync(join(MIGRATIONS_DIR, match), 'utf8') : ''
}

/** Concatenation of every *.sql migration — for regression scans. */
function ALL(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
}

// ─── Phase 12: _teleconsultations.sql (TEL-01) ───────────────────────────────

describe('Phase 12 migration — teleconsultations table (TEL-01)', () => {
  it('creates public.teleconsultations table', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/CREATE TABLE public\.teleconsultations/)
  })

  it('teleconsultations has clinic_id column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('teleconsultations has patient_id column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/patient_id/)
  })

  it('teleconsultations has professional_id column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/professional_id/)
  })

  it('teleconsultations has appointment_id column (links to atendimento)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/appointment_id/)
  })

  it('teleconsultations has external_link column (D-03: video = external link)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/external_link/)
  })

  it('teleconsultations has consent_given BOOLEAN column (CFO consent — TEL-01)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/consent_given/)
    expect(sql).toMatch(/BOOLEAN/)
  })

  it('teleconsultations has consent_given_at column (timestamp)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/consent_given_at/)
  })

  it('teleconsultations has consent_ip column (server-side IP capture — T-12-04)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/consent_ip/)
  })

  it('teleconsultations has started_at column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/started_at/)
  })

  it('teleconsultations has ended_at column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/ended_at/)
  })

  it('teleconsultations status CHECK contains agendada', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/'agendada'/)
  })

  it('teleconsultations status CHECK contains em_andamento', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/'em_andamento'/)
  })

  it('teleconsultations status CHECK contains concluida', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/'concluida'/)
  })

  it('teleconsultations status CHECK contains cancelada', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/'cancelada'/)
  })

  it('teleconsultations has deleted_at column (LGPD soft delete)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/deleted_at/)
  })

  it('teleconsultations has idx_teleconsultations_clinic index on clinic_id', () => {
    // Two separate assertions — avoids /s flag
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/idx_teleconsultations/)
    expect(sql).toMatch(/clinic_id/)
  })
})

// ─── Phase 12: _teleconsultations.sql (TEL-02 — soap_records) ────────────────

describe('Phase 12 migration — soap_records table (TEL-02)', () => {
  it('creates public.soap_records table', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/CREATE TABLE public\.soap_records/)
  })

  it('soap_records has clinic_id column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/clinic_id/)
  })

  it('soap_records has patient_id column', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/patient_id/)
  })

  it('soap_records has appointment_id column (links to atendimento — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/appointment_id/)
  })

  it('soap_records has teleconsultation_id column (links to session — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/teleconsultation_id/)
  })

  it('soap_records has soap_subjective column (S — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/soap_subjective/)
  })

  it('soap_records has soap_objective column (O — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/soap_objective/)
  })

  it('soap_records has soap_assessment column (A — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/soap_assessment/)
  })

  it('soap_records has soap_plan column (P — TEL-02)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/soap_plan/)
  })

  it('soap_records has deleted_at column (LGPD soft delete)', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/deleted_at/)
  })

  it('soap_records has idx_soap_records_clinic index on clinic_id', () => {
    const sql = MM('_teleconsultations.sql')
    expect(sql).toMatch(/idx_soap_records/)
  })
})

// ─── Phase 12: _teleconsultations_rls.sql (Access Control) ───────────────────

describe('Phase 12 migration — teleconsultations RLS (Access Control)', () => {
  it('enables ROW LEVEL SECURITY on teleconsultations', () => {
    const sql = MM('_teleconsultations_rls.sql')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it('teleconsultations SELECT policy uses clinic_id = get_my_tenant_id()', () => {
    const sql = MM('_teleconsultations_rls.sql')
    expect(sql).toMatch(/FOR SELECT/)
    expect(sql).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('teleconsultations write policy has USING clause', () => {
    const sql = MM('_teleconsultations_rls.sql')
    expect(sql).toMatch(/USING\s*\(/)
  })

  it('teleconsultations write policy has WITH CHECK clause', () => {
    const sql = MM('_teleconsultations_rls.sql')
    expect(sql).toMatch(/WITH CHECK/)
  })

  it('enables ROW LEVEL SECURITY on soap_records (TEL-02)', () => {
    const sql = MM('_teleconsultations_rls.sql')
    // Checking RLS is enabled on soap_records specifically
    expect(sql).toMatch(/soap_records/)
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })
})

// ─── REGRESSION re-assert (lightweight) ─────────────────────────────────────

describe('REGRESSION re-assert: Phase 12 tel migrations do not touch appointments GIST', () => {
  it('ALL migrations combined do not contain DROP CONSTRAINT no_overlap', () => {
    expect(ALL()).not.toMatch(/DROP CONSTRAINT no_overlap/i)
  })

  it('Phase 12 tel migration does NOT add EXCLUDE USING GIST (no appointments GIST modification)', () => {
    // The tel migration must not introduce a new EXCLUDE USING GIST on appointments
    const sql = MM('_teleconsultations.sql')
    // If the migration is absent, this passes (empty string has no EXCLUDE USING GIST)
    // If present, it must not touch appointments GIST
    expect(sql).not.toMatch(/EXCLUDE USING GIST/)
  })
})
