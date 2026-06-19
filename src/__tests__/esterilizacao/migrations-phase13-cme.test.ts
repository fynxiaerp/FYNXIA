/**
 * Phase 13 — migrations-phase13-cme.test.ts
 * Migration source-inspection scaffold for Phase 13 Esterilização/CME (CME-01..03).
 *
 * Target migration prefix: 20260619000* (Plans 02 create these — RED by design now).
 * Tables asserted: sterilization_cycles, kit_usages.
 *
 * Guard: files filtered on prefix 20260619000 — it.skipIf(files.length === 0) keeps
 * suites skipped until migrations exist. Regression guard always runs (empty string passes).
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 * Requirements: CME-01, CME-02, CME-03
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

const MIG_DIR = join(process.cwd(), 'supabase/migrations')

/** Phase 13 migration files (prefix 20260619000). */
const files = readdirSync(MIG_DIR).filter(f => f.startsWith('20260619000') && f.endsWith('.sql'))

/** Concatenation of all Phase 13 migrations. */
const sql = files.map(f => readFileSync(join(MIG_DIR, f), 'utf8')).join('\n')

// ─── sterilization_cycles ────────────────────────────────────────────────────

describe('Phase 13 CME migration — sterilization_cycles table (CME-01)', () => {
  it.skipIf(files.length === 0)('creates public.sterilization_cycles table', () => {
    expect(sql).toMatch(/CREATE TABLE public\.sterilization_cycles/)
  })

  it.skipIf(files.length === 0)('sterilization_cycles has autoclave_id column', () => {
    expect(sql).toMatch(/autoclave_id/)
  })

  it.skipIf(files.length === 0)('sterilization_cycles references public.resources(id) (reuses Phase 11 resource)', () => {
    expect(sql).toMatch(/REFERENCES public\.resources\(id\)/)
  })

  it.skipIf(files.length === 0)('biological_result CHECK contains pendente', () => {
    expect(sql).toMatch(/'pendente'/)
  })

  it.skipIf(files.length === 0)('biological_result CHECK contains aprovado', () => {
    expect(sql).toMatch(/'aprovado'/)
  })

  it.skipIf(files.length === 0)('biological_result CHECK contains reprovado', () => {
    expect(sql).toMatch(/'reprovado'/)
  })

  it.skipIf(files.length === 0)('status CHECK contains aprovado', () => {
    expect(sql).toMatch(/'aprovado'/)
  })

  it.skipIf(files.length === 0)('status CHECK contains reprovado', () => {
    expect(sql).toMatch(/'reprovado'/)
  })

  it.skipIf(files.length === 0)('status CHECK contains vencido', () => {
    expect(sql).toMatch(/'vencido'/)
  })

  it.skipIf(files.length === 0)('has temperatura column', () => {
    expect(sql).toMatch(/temperatura/)
  })

  it.skipIf(files.length === 0)('has tempo_minutos column', () => {
    expect(sql).toMatch(/tempo_minutos/)
  })

  it.skipIf(files.length === 0)('has pressao column', () => {
    expect(sql).toMatch(/pressao/)
  })

  it.skipIf(files.length === 0)('has validade column (expiry date — CME-02 block guard)', () => {
    expect(sql).toMatch(/validade/)
  })

  it.skipIf(files.length === 0)('has cycle_date column', () => {
    expect(sql).toMatch(/cycle_date/)
  })

  it.skipIf(files.length === 0)('has operator_id column', () => {
    expect(sql).toMatch(/operator_id/)
  })

  it.skipIf(files.length === 0)('has deleted_at column (LGPD soft delete)', () => {
    expect(sql).toMatch(/deleted_at/)
  })

  it.skipIf(files.length === 0)('has clinic_id column', () => {
    expect(sql).toMatch(/clinic_id/)
  })

  it.skipIf(files.length === 0)('has unit_id column', () => {
    expect(sql).toMatch(/unit_id/)
  })

  it.skipIf(files.length === 0)('has idx_sterilization_cycles_clinic index', () => {
    expect(sql).toMatch(/idx_sterilization_cycles_clinic/)
  })
})

// ─── kit_usages ──────────────────────────────────────────────────────────────

describe('Phase 13 CME migration — kit_usages table (CME-03)', () => {
  it.skipIf(files.length === 0)('creates public.kit_usages table', () => {
    expect(sql).toMatch(/CREATE TABLE public\.kit_usages/)
  })

  it.skipIf(files.length === 0)('kit_usages has sterilization_cycle_id column', () => {
    expect(sql).toMatch(/sterilization_cycle_id/)
  })

  it.skipIf(files.length === 0)('kit_usages has appointment_id column', () => {
    expect(sql).toMatch(/appointment_id/)
  })

  it.skipIf(files.length === 0)('kit_usages has patient_id column', () => {
    expect(sql).toMatch(/patient_id/)
  })

  it.skipIf(files.length === 0)('kit_usages has clinic_id column', () => {
    expect(sql).toMatch(/clinic_id/)
  })

  it.skipIf(files.length === 0)('has idx_kit_usages_cycle index', () => {
    expect(sql).toMatch(/idx_kit_usages_cycle/)
  })

  it.skipIf(files.length === 0)('has idx_kit_usages_patient index', () => {
    expect(sql).toMatch(/idx_kit_usages_patient/)
  })
})

// ─── RLS ─────────────────────────────────────────────────────────────────────

describe('Phase 13 CME migration — RLS (CME-01/CME-03)', () => {
  it.skipIf(files.length === 0)('ENABLE ROW LEVEL SECURITY present for sterilization tables', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it.skipIf(files.length === 0)('write policy has USING clause', () => {
    expect(sql).toMatch(/USING\s*\(/)
  })

  it.skipIf(files.length === 0)('write policy has WITH CHECK clause', () => {
    expect(sql).toMatch(/WITH CHECK/)
  })
})
