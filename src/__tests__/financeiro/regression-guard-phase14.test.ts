/**
 * Phase 14 — Regression Guard (FCAD-01, FCAD-02, Phase 3 contracts)
 * Test type: existsSync presence check
 *
 * This file passes GREEN immediately (Phase 3 guard files exist).
 * It documents the regression contract: Phase 14 implementations must not
 * break Phase 3 financial tests. The actual re-run of these suites happens
 * via `npx vitest run` at wave merge (per 14-RESEARCH.md Validation Architecture).
 *
 * Guarded tests (must remain present and passing):
 *   - src/__tests__/migrations/financial.test.ts    (FCAD-01: no DDL breaks Phase 3 schema)
 *   - src/__tests__/webhooks/asaas.test.ts           (FCAD-02: webhook still functions)
 *   - src/__tests__/actions/transactions.test.ts     (FCAD-02: createTransaction still valid)
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Guard file paths ─────────────────────────────────────────────────────────

const FINANCIAL_MIGRATION_TEST = join(
  process.cwd(),
  'src/__tests__/migrations/financial.test.ts'
)

const ASAAS_WEBHOOK_TEST = join(
  process.cwd(),
  'src/__tests__/webhooks/asaas.test.ts'
)

const TRANSACTIONS_ACTION_TEST = join(
  process.cwd(),
  'src/__tests__/actions/transactions.test.ts'
)

// ─── Regression contract ──────────────────────────────────────────────────────

describe('Phase 14 regression guard — Phase 3 test files present', () => {
  it('src/__tests__/migrations/financial.test.ts exists (Phase 3 financial migration guard)', () => {
    expect(existsSync(FINANCIAL_MIGRATION_TEST)).toBe(true)
  })

  it('src/__tests__/webhooks/asaas.test.ts exists (Phase 3 Asaas webhook guard)', () => {
    expect(existsSync(ASAAS_WEBHOOK_TEST)).toBe(true)
  })

  it('src/__tests__/actions/transactions.test.ts exists (Phase 3 createTransaction guard)', () => {
    expect(existsSync(TRANSACTIONS_ACTION_TEST)).toBe(true)
  })
})
