/**
 * Phase 16 — Contas a Pagar, Conciliação & Tributos — Migration source-inspection
 * Test type: readFileSync source-inspection (mirrors Phase 15 migrations-phase15.test.ts pattern)
 *
 * All assertions are intentionally RED until Wave 1+ plans create the 7 migration files.
 * Empty-string fallback (existsSync guard) ensures tests FAIL (not skip) while files are absent.
 *
 * Requirements encoded:
 *   FOP-01  — suppliers, payables, payable_installments, recorrente_templates tables
 *   FOP-02  — bank_statements, statement_lines (FITID idempotency — D-11)
 *   FOP-03  — reconciliation_status ALTER on financial_transactions
 *   TRIB-01 — professional_payouts, payout_items tables
 *   TRIB-02 — rpa_records, unit_rpa_counters, competencia_fechamentos tables + tax tables seed
 *   TRIB-03 — reinf_events table + ALTERs (ConnectorType, professionals.supplier_id)
 *   D-17    — inss_tax_tables, irrf_tax_tables, iss_tax_tables versionadas por vigência
 *   D-23    — RLS write-by-role: get_my_role() IN ('admin', 'superadmin', ...)
 *   D-11    — FITID idempotency: UNIQUE (bank_account_id, fitid) + UNIQUE (bank_account_id, fitid_fallback)
 *   D-26    — next_rpa_number SECURITY DEFINER + UNIQUE(clinic_id, unit_id, competencia)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── File paths ──────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

// Wave 0: these files do NOT exist yet — existsSync guard yields empty string → RED
const PAYABLES_FILE        = join(MIGRATIONS_DIR, '20260621000100_payables_tables.sql')
const RECONCILIATION_FILE  = join(MIGRATIONS_DIR, '20260621000200_reconciliation_tables.sql')
const PAYOUT_RPA_FILE      = join(MIGRATIONS_DIR, '20260621000300_payout_rpa_tables.sql')
const TAX_FILE             = join(MIGRATIONS_DIR, '20260621000400_tax_tables.sql')
const ALTERS_FILE          = join(MIGRATIONS_DIR, '20260621000500_phase16_alters.sql')
const RLS_FILE             = join(MIGRATIONS_DIR, '20260621000600_phase16_rls.sql')
const SEED_FILE            = join(MIGRATIONS_DIR, '20260621000700_phase16_seed.sql')

const payablesSQL       = existsSync(PAYABLES_FILE)       ? readFileSync(PAYABLES_FILE,       'utf-8') : ''
const reconciliationSQL = existsSync(RECONCILIATION_FILE) ? readFileSync(RECONCILIATION_FILE, 'utf-8') : ''
const payoutRpaSQL      = existsSync(PAYOUT_RPA_FILE)     ? readFileSync(PAYOUT_RPA_FILE,     'utf-8') : ''
const taxSQL            = existsSync(TAX_FILE)            ? readFileSync(TAX_FILE,            'utf-8') : ''
const altersSQL         = existsSync(ALTERS_FILE)         ? readFileSync(ALTERS_FILE,         'utf-8') : ''
const rlsSQL            = existsSync(RLS_FILE)            ? readFileSync(RLS_FILE,            'utf-8') : ''
const seedSQL           = existsSync(SEED_FILE)           ? readFileSync(SEED_FILE,           'utf-8') : ''

// ─── Payables migration (20260621000100) ─────────────────────────────────────

describe('Phase 16 payables migration (20260621000100) — suppliers (FOP-01, D-01)', () => {
  it('creates the suppliers table', () => {
    expect(payablesSQL).toMatch(/CREATE TABLE public\.suppliers/)
  })

  it('has tipo CHECK (laboratorio/material/servico/autonomo/pj/outro)', () => {
    expect(payablesSQL).toMatch(
      /CHECK \(tipo IN \('laboratorio', 'material', 'servico', 'autonomo', 'pj', 'outro'\)\)/
    )
  })

  it('has idx_suppliers_clinic index', () => {
    expect(payablesSQL).toMatch(/CREATE INDEX[\s\S]*suppliers\(clinic_id\)/)
  })
})

describe('Phase 16 payables migration (20260621000100) — payables (FOP-01, D-02/D-04)', () => {
  it('creates the payables table', () => {
    expect(payablesSQL).toMatch(/CREATE TABLE public\.payables/)
  })

  it('has valor_total NUMERIC(12,2) (money convention)', () => {
    expect(payablesSQL).toMatch(/valor_total\s+NUMERIC\(12,\s*2\)/)
  })

  it('has origem CHECK (manual/recorrente/lab/repasse/tributo)', () => {
    expect(payablesSQL).toMatch(
      /CHECK \(origem IN \('manual', 'recorrente', 'lab', 'repasse', 'tributo'\)\)/
    )
  })

  it('has status CHECK (pendente/parcial/pago/cancelado)', () => {
    expect(payablesSQL).toMatch(
      /CHECK \(status IN \('pendente', 'parcial', 'pago', 'cancelado'\)\)/
    )
  })

  it('has idx_payables_clinic index', () => {
    expect(payablesSQL).toMatch(/CREATE INDEX[\s\S]*payables\(clinic_id\)/)
  })
})

describe('Phase 16 payables migration (20260621000100) — payable_installments (D-04)', () => {
  it('creates the payable_installments table', () => {
    expect(payablesSQL).toMatch(/CREATE TABLE public\.payable_installments/)
  })
})

describe('Phase 16 payables migration (20260621000100) — recorrente_templates (D-02b)', () => {
  it('creates the recorrente_templates table', () => {
    expect(payablesSQL).toMatch(/CREATE TABLE public\.recorrente_templates/)
  })
})

// ─── Reconciliation migration (20260621000200) ───────────────────────────────

describe('Phase 16 reconciliation migration (20260621000200) — bank_statements (FOP-02)', () => {
  it('creates the bank_statements table', () => {
    expect(reconciliationSQL).toMatch(/CREATE TABLE public\.bank_statements/)
  })
})

describe('Phase 16 reconciliation migration (20260621000200) — statement_lines (D-11)', () => {
  it('creates the statement_lines table', () => {
    expect(reconciliationSQL).toMatch(/CREATE TABLE public\.statement_lines/)
  })

  it('has reconciliation_status CHECK (pendente/conciliado/ignorado)', () => {
    expect(reconciliationSQL).toMatch(
      /CHECK \(reconciliation_status IN \('pendente', 'conciliado', 'ignorado'\)\)/
    )
  })

  it('D-11 FITID idempotency: UNIQUE (bank_account_id, fitid)', () => {
    expect(reconciliationSQL).toMatch(/UNIQUE \(bank_account_id, fitid\)/)
  })

  it('D-11 FITID fallback idempotency: UNIQUE (bank_account_id, fitid_fallback)', () => {
    expect(reconciliationSQL).toMatch(/UNIQUE \(bank_account_id, fitid_fallback\)/)
  })

  it('has idx_statement_lines_clinic index', () => {
    expect(reconciliationSQL).toMatch(/CREATE INDEX[\s\S]*statement_lines\(clinic_id\)/)
  })
})

// ─── Payout/RPA migration (20260621000300) ────────────────────────────────────

describe('Phase 16 payout/RPA migration (20260621000300) — professional_payouts (TRIB-01)', () => {
  it('creates the professional_payouts table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.professional_payouts/)
  })

  it('has idx_payouts_clinic index', () => {
    expect(payoutRpaSQL).toMatch(/CREATE INDEX[\s\S]*professional_payouts\(clinic_id\)/)
  })
})

describe('Phase 16 payout/RPA migration (20260621000300) — payout_items (TRIB-01)', () => {
  it('creates the payout_items table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.payout_items/)
  })
})

describe('Phase 16 payout/RPA migration (20260621000300) — rpa_records (TRIB-02, D-20)', () => {
  it('creates the rpa_records table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.rpa_records/)
  })
})

describe('Phase 16 payout/RPA migration (20260621000300) — reinf_events (TRIB-03)', () => {
  it('creates the reinf_events table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.reinf_events/)
  })

  it('has tipo CHECK (R2010/R4020)', () => {
    expect(payoutRpaSQL).toMatch(
      /CHECK \(tipo IN \('R2010', 'R4020'\)\)/
    )
  })
})

describe('Phase 16 payout/RPA migration (20260621000300) — unit_rpa_counters (D-26)', () => {
  it('creates the unit_rpa_counters table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.unit_rpa_counters/)
  })

  it('has last_rpa_number column (D-26 sequential numbering)', () => {
    expect(payoutRpaSQL).toMatch(/last_rpa_number/)
  })
})

describe('Phase 16 payout/RPA migration (20260621000300) — competencia_fechamentos (D-26)', () => {
  it('creates the competencia_fechamentos table', () => {
    expect(payoutRpaSQL).toMatch(/CREATE TABLE public\.competencia_fechamentos/)
  })

  it('D-26 uniqueness: UNIQUE(clinic_id, unit_id, competencia)', () => {
    expect(payoutRpaSQL).toMatch(/UNIQUE\s*\(clinic_id, unit_id, competencia\)/)
  })
})

// ─── Tax tables migration (20260621000400) ───────────────────────────────────

describe('Phase 16 tax tables migration (20260621000400) — INSS (D-17, TRIB-02)', () => {
  it('creates the inss_tax_tables table', () => {
    expect(taxSQL).toMatch(/CREATE TABLE public\.inss_tax_tables/)
  })

  it('D-17 vigência index on inss_tax_tables', () => {
    expect(taxSQL).toMatch(/idx_inss_tax_vigencia/)
  })

  it('has vigencia_inicio column for temporal versioning', () => {
    expect(taxSQL).toMatch(/vigencia_inicio/)
  })
})

describe('Phase 16 tax tables migration (20260621000400) — IRRF', () => {
  it('creates the irrf_tax_tables table', () => {
    expect(taxSQL).toMatch(/CREATE TABLE public\.irrf_tax_tables/)
  })
})

describe('Phase 16 tax tables migration (20260621000400) — ISS', () => {
  it('creates the iss_tax_tables table', () => {
    expect(taxSQL).toMatch(/CREATE TABLE public\.iss_tax_tables/)
  })
})

// ─── Alters migration (20260621000500) ───────────────────────────────────────

describe('Phase 16 alters migration (20260621000500) — financial_transactions (FOP-03)', () => {
  it('ALTERs financial_transactions to add reconciliation_status', () => {
    expect(altersSQL).toMatch(
      /ALTER TABLE public\.financial_transactions[\s\S]*reconciliation_status/
    )
  })
})

describe('Phase 16 alters migration (20260621000500) — bank_accounts (D-12)', () => {
  it('ALTERs bank_accounts to add saldo_atual', () => {
    expect(altersSQL).toMatch(
      /ALTER TABLE public\.bank_accounts[\s\S]*saldo_atual/
    )
  })

  it('ALTERs bank_accounts to add data_abertura', () => {
    expect(altersSQL).toMatch(
      /ALTER TABLE public\.bank_accounts[\s\S]*data_abertura/
    )
  })
})

describe('Phase 16 alters migration (20260621000500) — professionals (D-01)', () => {
  it('ALTERs professionals to add supplier_id FK', () => {
    expect(altersSQL).toMatch(
      /ALTER TABLE public\.professionals[\s\S]*supplier_id/
    )
  })
})

describe('Phase 16 alters migration (20260621000500) — integration_connectors (D-22)', () => {
  it('adds reinf or open_finance to ConnectorType CHECK', () => {
    expect(altersSQL).toMatch(/('reinf'|'open_finance')/)
  })
})

describe('Phase 16 alters migration (20260621000500) — next_rpa_number function (D-26)', () => {
  it('creates next_rpa_number function', () => {
    expect(altersSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.next_rpa_number/
    )
  })

  it('next_rpa_number is SECURITY DEFINER (race-condition-safe, D-26)', () => {
    expect(altersSQL).toMatch(/SECURITY DEFINER/)
  })
})

// ─── RLS migration (20260621000600) ──────────────────────────────────────────

describe('Phase 16 RLS migration (20260621000600) — payables (D-23)', () => {
  it('enables RLS on payables', () => {
    expect(rlsSQL).toMatch(
      /ALTER TABLE public\.payables ENABLE ROW LEVEL SECURITY/
    )
  })

  it('has tenant read policy using clinic_id = get_my_tenant_id()', () => {
    expect(rlsSQL).toMatch(/clinic_id = get_my_tenant_id\(\)/)
  })

  it('has WITH CHECK on write policies', () => {
    expect(rlsSQL).toMatch(/WITH CHECK/)
  })

  it('D-23: write policy restricts to admin/superadmin via get_my_role()', () => {
    expect(rlsSQL).toMatch(
      /get_my_role\(\) IN \([^)]*'admin'/
    )
  })
})

// ─── Seed migration (20260621000700) ─────────────────────────────────────────

describe('Phase 16 seed migration (20260621000700) — INSS 2026 seed (D-17)', () => {
  it('inserts into inss_tax_tables', () => {
    expect(seedSQL).toMatch(/INSERT INTO public\.inss_tax_tables/)
  })

  it('seeds 2026-01-01 vigência', () => {
    expect(seedSQL).toMatch(/2026-01-01/)
  })
})

describe('Phase 16 seed migration (20260621000700) — IRRF 2026 seed', () => {
  it('inserts into irrf_tax_tables', () => {
    expect(seedSQL).toMatch(/INSERT INTO public\.irrf_tax_tables/)
  })
})

describe('Phase 16 seed migration (20260621000700) — supplier types / ISS seed', () => {
  it('contains supplier types or default ISS seed', () => {
    // Must contain either an ISS seed row or a supplier type reference
    expect(seedSQL).toMatch(/INSERT INTO public\.(iss_tax_tables|suppliers)/)
  })
})

// ─── Cross-migration: clinic_id indexes on every new table (sample 4) ────────

describe('Phase 16 migrations — clinic_id indexes on new tables (CLAUDE.md rule)', () => {
  it('idx on payables (payables file)', () => {
    expect(payablesSQL).toMatch(/CREATE INDEX[\s\S]*payables\(clinic_id\)/)
  })

  it('idx on statement_lines (reconciliation file)', () => {
    expect(reconciliationSQL).toMatch(/CREATE INDEX[\s\S]*statement_lines\(clinic_id\)/)
  })

  it('idx on professional_payouts (payout file)', () => {
    expect(payoutRpaSQL).toMatch(/CREATE INDEX[\s\S]*professional_payouts\(clinic_id\)/)
  })

  it('idx on suppliers (payables file)', () => {
    expect(payablesSQL).toMatch(/CREATE INDEX[\s\S]*suppliers\(clinic_id\)/)
  })
})
