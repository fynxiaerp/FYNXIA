/**
 * Phase 3 — ReceivablesTable behavioral source-inspection (FIN-03, FIN-06, D-04)
 * Test type: source-inspection via readFileSync/toMatch (Phase 2 pattern)
 *
 * Asserts:
 *   1. ReceivablesTable imports and calls deriveReceivableStatus (client-side vencido, D-04)
 *   2. ReceivablesTable does NOT read a stored 'vencido' literal from the DB
 *   3. ReceivablesTable uses Accordion for installment grouping (FIN-06)
 *   4. TransactionModal calls createTransaction Server Action (FIN-02)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RECEIVABLES_TABLE_PATH = resolve(
  process.cwd(),
  'src/components/financeiro/ReceivablesTable.tsx'
)
const TRANSACTION_MODAL_PATH = resolve(
  process.cwd(),
  'src/components/financeiro/TransactionModal.tsx'
)

describe('ReceivablesTable (FIN-03, FIN-06, D-04)', () => {
  it('file exists (RED until Task 2 authors ReceivablesTable)', () => {
    expect(existsSync(RECEIVABLES_TABLE_PATH)).toBe(true)
  })

  it('calls deriveReceivableStatus for client-side vencido derivation (D-04)', () => {
    if (!existsSync(RECEIVABLES_TABLE_PATH)) {
      expect(existsSync(RECEIVABLES_TABLE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECEIVABLES_TABLE_PATH, 'utf8')
    expect(src).toMatch(/deriveReceivableStatus/)
  })

  it('does NOT assign stored vencido from DB (D-04 — derived only)', () => {
    if (!existsSync(RECEIVABLES_TABLE_PATH)) {
      expect(existsSync(RECEIVABLES_TABLE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECEIVABLES_TABLE_PATH, 'utf8')
    // Must NOT pattern-match on a literal 'vencido' value read from status field
    // Allowed: deriveReceivableStatus returns 'vencido'; Not allowed: status === 'vencido' for DB reads
    expect(src).not.toMatch(/\.status\s*===\s*['"]vencido['"]/)
  })

  it('uses shadcn Accordion for installment grouping (FIN-06)', () => {
    if (!existsSync(RECEIVABLES_TABLE_PATH)) {
      expect(existsSync(RECEIVABLES_TABLE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(RECEIVABLES_TABLE_PATH, 'utf8')
    expect(src).toMatch(/Accordion/)
  })
})

describe('TransactionModal (FIN-02)', () => {
  it('file exists', () => {
    expect(existsSync(TRANSACTION_MODAL_PATH)).toBe(true)
  })

  it('calls createTransaction Server Action', () => {
    if (!existsSync(TRANSACTION_MODAL_PATH)) {
      expect(existsSync(TRANSACTION_MODAL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(TRANSACTION_MODAL_PATH, 'utf8')
    expect(src).toMatch(/createTransaction/)
  })
})
