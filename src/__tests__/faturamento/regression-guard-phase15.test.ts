/**
 * Phase 15 — Regression Guard (Phase 2/3/9 invariants)
 * Test type: readFileSync source-inspection + existsSync presence check
 *
 * This file passes GREEN immediately (all guarded files exist in prod).
 * It documents the regression contract: Phase 15 must not break:
 *   - appointments status enum 'concluido' (Phase 2 clinical contract)
 *   - integration_connectors ConnectorType union 'nfse'/'tiss' (Phase 9 hub)
 *   - financial_transactions schema untouched (Phase 3 financial contract)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Guard file paths ─────────────────────────────────────────────────────────

const APPOINTMENT_VALIDATOR = join(
  process.cwd(),
  'src/lib/validators/appointment.ts'
)

const INTEGRATION_TYPES = join(
  process.cwd(),
  'src/lib/integrations/types.ts'
)

const FINANCIAL_TABLES_MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260606000100_financial_tables.sql'
)

// ─── Source content (these files exist → content is non-empty → tests GREEN) ──

const appointmentSrc   = existsSync(APPOINTMENT_VALIDATOR)        ? readFileSync(APPOINTMENT_VALIDATOR,        'utf-8') : ''
const integrationTypes = existsSync(INTEGRATION_TYPES)            ? readFileSync(INTEGRATION_TYPES,            'utf-8') : ''
const financialSQL     = existsSync(FINANCIAL_TABLES_MIGRATION)   ? readFileSync(FINANCIAL_TABLES_MIGRATION,   'utf-8') : ''

// ─── Phase 2 — appointments enum (must keep 'concluido') ─────────────────────

describe('Phase 15 regression guard — Phase 2 appointments enum', () => {
  it("appointment validator includes 'concluido' status (Phase 2 OS-01 trigger)", () => {
    expect(appointmentSrc).toMatch(/'concluido'/)
  })

  it('appointment validator file exists', () => {
    expect(existsSync(APPOINTMENT_VALIDATOR)).toBe(true)
  })
})

// ─── Phase 9 — integration_connectors ConnectorType union ────────────────────

describe('Phase 15 regression guard — Phase 9 ConnectorType union', () => {
  it("integration types include 'nfse' connector type (Phase 9 hub — FiscalProvider gating)", () => {
    expect(integrationTypes).toMatch(/'nfse'/)
  })

  it("integration types include 'tiss' connector type (Phase 9 hub — TissProvider gating)", () => {
    expect(integrationTypes).toMatch(/'tiss'/)
  })

  it('src/lib/integrations/types.ts exists', () => {
    expect(existsSync(INTEGRATION_TYPES)).toBe(true)
  })
})

// ─── Phase 3 — financial_transactions schema untouched ───────────────────────

describe('Phase 15 regression guard — Phase 3 financial schema unchanged', () => {
  it('financial_tables migration exists (20260606000100)', () => {
    expect(existsSync(FINANCIAL_TABLES_MIGRATION)).toBe(true)
  })

  it('CREATE TABLE public.financial_transactions still present', () => {
    expect(financialSQL).toMatch(/CREATE TABLE public\.financial_transactions/)
  })

  it('financial_transactions amount column is NUMERIC(12,2) (CLAUDE.md money convention)', () => {
    expect(financialSQL).toMatch(/NUMERIC\(12,\s*2\)/)
  })
})
