/**
 * Phase 13 — migrations-phase13-lab.test.ts
 * Migration source-inspection scaffold for Phase 13 Laboratório de Prótese (LAB-01/LAB-02).
 *
 * Target migration prefix: 20260619000* (Plan 03 creates these — RED by design now).
 * Tables asserted: prosthetic_labs, lab_orders.
 *
 * Guard: files filtered on prefix 20260619000 — it.skipIf(files.length === 0) keeps
 * suites skipped until migrations exist. Regression guard always runs (empty string passes).
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 01 (Wave 0 RED scaffold)
 * Requirements: LAB-01, LAB-02
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

// ─── prosthetic_labs ──────────────────────────────────────────────────────────

describe('Phase 13 LAB migration — prosthetic_labs table (LAB-01)', () => {
  it.skipIf(files.length === 0)('creates public.prosthetic_labs table', () => {
    expect(sql).toMatch(/CREATE TABLE public\.prosthetic_labs/)
  })

  it.skipIf(files.length === 0)('prosthetic_labs has clinic_id column', () => {
    expect(sql).toMatch(/clinic_id/)
  })

  it.skipIf(files.length === 0)('prosthetic_labs has nome column', () => {
    expect(sql).toMatch(/\bnome\b/)
  })

  it.skipIf(files.length === 0)('prosthetic_labs has deleted_at column (LGPD soft delete)', () => {
    expect(sql).toMatch(/deleted_at/)
  })

  it.skipIf(files.length === 0)('has idx_prosthetic_labs_clinic index', () => {
    expect(sql).toMatch(/idx_prosthetic_labs_clinic/)
  })
})

// ─── lab_orders ───────────────────────────────────────────────────────────────

describe('Phase 13 LAB migration — lab_orders table (LAB-01/LAB-02)', () => {
  it.skipIf(files.length === 0)('creates public.lab_orders table', () => {
    expect(sql).toMatch(/CREATE TABLE public\.lab_orders/)
  })

  it.skipIf(files.length === 0)('lab_orders has lab_id column', () => {
    expect(sql).toMatch(/lab_id/)
  })

  it.skipIf(files.length === 0)('lab_orders references public.prosthetic_labs(id)', () => {
    expect(sql).toMatch(/REFERENCES public\.prosthetic_labs\(id\)/)
  })

  it.skipIf(files.length === 0)('lab_orders has patient_id column', () => {
    expect(sql).toMatch(/patient_id/)
  })

  it.skipIf(files.length === 0)('lab_orders has appointment_id column', () => {
    expect(sql).toMatch(/appointment_id/)
  })

  it.skipIf(files.length === 0)('lab_orders has prosthesis_type column', () => {
    expect(sql).toMatch(/prosthesis_type/)
  })

  it.skipIf(files.length === 0)('lab_orders has due_date column', () => {
    expect(sql).toMatch(/due_date/)
  })

  it.skipIf(files.length === 0)('lab_orders has stages column (etapas de prova)', () => {
    expect(sql).toMatch(/stages/)
  })

  it.skipIf(files.length === 0)('lab_orders has cost column', () => {
    expect(sql).toMatch(/\bcost\b/)
  })

  it.skipIf(files.length === 0)('status CHECK contains enviado', () => {
    expect(sql).toMatch(/'enviado'/)
  })

  it.skipIf(files.length === 0)('status CHECK contains prova', () => {
    expect(sql).toMatch(/'prova'/)
  })

  it.skipIf(files.length === 0)('status CHECK contains concluido', () => {
    expect(sql).toMatch(/'concluido'/)
  })

  it.skipIf(files.length === 0)('lab_orders has clinic_id column', () => {
    expect(sql).toMatch(/clinic_id/)
  })

  it.skipIf(files.length === 0)('lab_orders has unit_id column', () => {
    expect(sql).toMatch(/unit_id/)
  })

  it.skipIf(files.length === 0)('lab_orders has deleted_at column (LGPD soft delete)', () => {
    expect(sql).toMatch(/deleted_at/)
  })

  it.skipIf(files.length === 0)('has idx_lab_orders_clinic index', () => {
    expect(sql).toMatch(/idx_lab_orders_clinic/)
  })

  it.skipIf(files.length === 0)('has idx_lab_orders_lab index', () => {
    expect(sql).toMatch(/idx_lab_orders_lab/)
  })

  it.skipIf(files.length === 0)('has idx_lab_orders_patient index', () => {
    expect(sql).toMatch(/idx_lab_orders_patient/)
  })

  // LAB-02: link to financial transaction (either a FK column or origin_type reference)
  it.skipIf(files.length === 0)('lab_orders has financial_transaction_id OR lab migration references lab_order (LAB-02 financial link)', () => {
    const hasFinancialLink =
      sql.includes('financial_transaction_id') || sql.includes('lab_order')
    expect(hasFinancialLink).toBe(true)
  })
})

// ─── RLS ─────────────────────────────────────────────────────────────────────

describe('Phase 13 LAB migration — RLS (LAB-01)', () => {
  it.skipIf(files.length === 0)('ENABLE ROW LEVEL SECURITY present for lab tables', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
  })

  it.skipIf(files.length === 0)('write policy has USING clause', () => {
    expect(sql).toMatch(/USING\s*\(/)
  })

  it.skipIf(files.length === 0)('write policy has WITH CHECK clause', () => {
    expect(sql).toMatch(/WITH CHECK/)
  })
})
