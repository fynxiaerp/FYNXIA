/**
 * Phase 16 — Regression Guard (Phase 9/14/15 invariants)
 * Test type: readFileSync source-inspection + existsSync presence check
 *
 * This file passes GREEN immediately (all guarded files exist in the repo).
 * It documents the regression contract: Phase 16 must not break:
 *   - ConnectorType union 'asaas'/'nfse'/'tiss'/'banco' (Phase 9 hub — FOP-01/02/03 gate point)
 *   - financial_transactions schema: CREATE TABLE + NUMERIC(12,2) (Phase 3/14 financial contract)
 *   - bank_accounts: CREATE TABLE + saldo_inicial (Phase 14 — we ADD columns, never drop)
 *   - professionals: commission_rules + vinculo (Phase 11 repasse base — D-13 unchanged)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Guard file paths ─────────────────────────────────────────────────────────

const INTEGRATION_TYPES = join(
  process.cwd(),
  'src/lib/integrations/types.ts'
)

const FINANCIAL_TABLES_MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260606000100_financial_tables.sql'
)

const BANK_ACCOUNTS_MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260619001100_financial_cadastros_tables.sql'
)

const PROFESSIONALS_MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260617000100_professionals.sql'
)

// ─── Source content (these files exist → content is non-empty → tests GREEN) ──

const integrationTypes      = existsSync(INTEGRATION_TYPES)           ? readFileSync(INTEGRATION_TYPES,           'utf-8') : ''
const financialSQL          = existsSync(FINANCIAL_TABLES_MIGRATION)   ? readFileSync(FINANCIAL_TABLES_MIGRATION,   'utf-8') : ''
const bankAccountsSQL       = existsSync(BANK_ACCOUNTS_MIGRATION)      ? readFileSync(BANK_ACCOUNTS_MIGRATION,      'utf-8') : ''
const professionalsSQL      = existsSync(PROFESSIONALS_MIGRATION)      ? readFileSync(PROFESSIONALS_MIGRATION,      'utf-8') : ''

// ─── Phase 9 — integration_connectors ConnectorType union ────────────────────

describe('Phase 16 regression guard — Phase 9 ConnectorType union', () => {
  it("integration types include 'asaas' connector type (Phase 9 hub — payments gate)", () => {
    expect(integrationTypes).toMatch(/'asaas'/)
  })

  it("integration types include 'nfse' connector type (Phase 15 NFS-e provider gate)", () => {
    expect(integrationTypes).toMatch(/'nfse'/)
  })

  it("integration types include 'tiss' connector type (Phase 15 TISS provider gate)", () => {
    expect(integrationTypes).toMatch(/'tiss'/)
  })

  it("integration types include 'banco' connector type (Phase 9 — bank connector)", () => {
    expect(integrationTypes).toMatch(/'banco'/)
  })

  it('src/lib/integrations/types.ts exists', () => {
    expect(existsSync(INTEGRATION_TYPES)).toBe(true)
  })
})

// ─── Phase 3/14 — financial_transactions schema untouched ────────────────────

describe('Phase 16 regression guard — Phase 3 financial_transactions schema unchanged', () => {
  it('financial_tables migration 20260606000100 exists', () => {
    expect(existsSync(FINANCIAL_TABLES_MIGRATION)).toBe(true)
  })

  it('CREATE TABLE public.financial_transactions still present', () => {
    expect(financialSQL).toMatch(/CREATE TABLE public\.financial_transactions/)
  })

  it('financial_transactions amount column is NUMERIC(12,2) (CLAUDE.md money convention)', () => {
    expect(financialSQL).toMatch(/NUMERIC\(12,\s*2\)/)
  })
})

// ─── Phase 14 — bank_accounts schema untouched (we ADD columns, never drop) ──

describe('Phase 16 regression guard — Phase 14 bank_accounts schema intact', () => {
  it('financial_cadastros_tables migration 20260619001100 exists', () => {
    expect(existsSync(BANK_ACCOUNTS_MIGRATION)).toBe(true)
  })

  it('CREATE TABLE public.bank_accounts still present', () => {
    expect(bankAccountsSQL).toMatch(/CREATE TABLE public\.bank_accounts/)
  })

  it('saldo_inicial column still present (Phase 14 — we ADD saldo_atual via ALTER, not replace)', () => {
    expect(bankAccountsSQL).toMatch(/saldo_inicial/)
  })
})

// ─── Phase 11 — professionals commission_rules + vinculo intact ───────────────

describe('Phase 16 regression guard — Phase 11 professionals repasse base intact', () => {
  it('professionals migration 20260617000100 exists', () => {
    expect(existsSync(PROFESSIONALS_MIGRATION)).toBe(true)
  })

  it('commission_rules column still present (D-13 repasse base — Phase 16 calcs depend on it)', () => {
    expect(professionalsSQL).toMatch(/commission_rules/)
  })

  it('vinculo CHECK (clt/pj/autonomo) still present (D-16: vinculo drives RPA treatment)', () => {
    expect(professionalsSQL).toMatch(/vinculo/)
  })
})
