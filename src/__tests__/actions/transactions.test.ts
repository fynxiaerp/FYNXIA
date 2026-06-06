/**
 * Phase 3 — createTransaction action tests (FIN-02)
 * Test type: source-inspection via existsSync + readFileSync
 *
 * RED until Plan 03 authors src/actions/transactions.ts.
 * The existsSync guard ensures tests FAIL (not skip) while the file is absent.
 *
 * Requirement: FIN-02 — manual transaction entry (receita/despesa, categoria, valor, data)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TRANSACTIONS_PATH = resolve(process.cwd(), 'src/actions/transactions.ts')

describe('createTransaction Server Action — src/actions/transactions.ts (FIN-02)', () => {
  it('file exists (fails RED until Plan 03)', () => {
    // Intentionally RED until Plan 03 Task 1 authors this file
    expect(existsSync(TRANSACTIONS_PATH)).toBe(true)
  })

  it('exports createTransaction as an async function', () => {
    if (!existsSync(TRANSACTIONS_PATH)) {
      expect(existsSync(TRANSACTIONS_PATH)).toBe(true)
      return
    }
    const src = readFileSync(TRANSACTIONS_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+createTransaction/)
  })

  it('validates type against receita/despesa (FIN-02 — regime de caixa)', () => {
    if (!existsSync(TRANSACTIONS_PATH)) {
      expect(existsSync(TRANSACTIONS_PATH)).toBe(true)
      return
    }
    const src = readFileSync(TRANSACTIONS_PATH, 'utf8')
    // Zod schema or CHECK must constrain type to 'receita' | 'despesa'
    expect(src).toMatch(/receita/)
    expect(src).toMatch(/despesa/)
  })

  it('scopes by tenant via getActor/tenant_id/get_my_tenant_id (T-3-01)', () => {
    if (!existsSync(TRANSACTIONS_PATH)) {
      expect(existsSync(TRANSACTIONS_PATH)).toBe(true)
      return
    }
    const src = readFileSync(TRANSACTIONS_PATH, 'utf8')
    // Must use getActor() or explicit tenant_id scoping to prevent cross-tenant writes
    expect(src).toMatch(/getActor|tenant_id|get_my_tenant_id/)
  })

  it('inserts into financial_transactions table', () => {
    if (!existsSync(TRANSACTIONS_PATH)) {
      expect(existsSync(TRANSACTIONS_PATH)).toBe(true)
      return
    }
    const src = readFileSync(TRANSACTIONS_PATH, 'utf8')
    expect(src).toMatch(/financial_transactions/)
  })
})
