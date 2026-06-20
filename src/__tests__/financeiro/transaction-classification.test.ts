/**
 * Phase 14 — Zod classification schema unit tests (FCAD-02, T-14-03)
 * Test type: dynamic-import guard + inline mirror schema
 *
 * Target module: src/lib/financeiro/transaction-schema.ts (created in Plan 03)
 * Exports: transactionClassificationSchema
 *
 * RED state: dynamic import throws because the module does not exist yet.
 *
 * Strategy:
 *   1. Inline mirror schema documents the REQUIRED contract (accountId/costCenterId required)
 *   2. Dynamic import of the pure module asserts the actual implementation matches
 *
 * D-133: No .default() in Zod schemas — RHF defaultValues supplies values.
 * Decision: accountId and costCenterId are REQUIRED uuid fields for manual transactions.
 * bankAccountId is optional nullable.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── Mirror schema (inline contract documentation) ────────────────────────────
// This re-declares the expected shape so the test is self-documenting.
// The actual implementation lives in src/lib/financeiro/transaction-schema.ts
// and will be imported dynamically below.

function isMoney2dp(n: number): boolean {
  return Number.isFinite(n) && Math.round(n * 100) === n * 100
}

// Rule 1 fix (Plan 04): z.string().uuid({ message }) only fires on invalid-format;
// for missing/undefined fields Zod v3 fires "Required". Use required_error to match
// the actual module's behavior (both must fire the same message for the mirror tests
// to be self-consistent "always GREEN").
const mirrorTransactionClassificationSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  categoryId: z.string().uuid().optional().nullable(),
  accountId: z
    .string({
      required_error: 'Conta contábil obrigatória',
      invalid_type_error: 'Conta contábil obrigatória',
    })
    .uuid({ message: 'Conta contábil obrigatória' }),
  costCenterId: z
    .string({
      required_error: 'Centro de custo obrigatório',
      invalid_type_error: 'Centro de custo obrigatório',
    })
    .uuid({ message: 'Centro de custo obrigatório' }),
  bankAccountId: z.string().uuid().optional().nullable(),
  amount: z.number().positive().refine(isMoney2dp),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().nullable(),
})

const VALID_FULL_INPUT = {
  type: 'receita' as const,
  accountId: '00000000-0000-0000-0000-000000000001',
  costCenterId: '00000000-0000-0000-0000-000000000002',
  amount: 250.00,
  transactionDate: '2026-06-19',
}

// ─── Mirror schema tests (inline — always GREEN, document the contract) ───────

describe('transactionClassificationSchema — mirror contract (always GREEN)', () => {
  it('missing accountId → safeParse fails with "Conta contábil obrigatória"', () => {
    const input = { ...VALID_FULL_INPUT, accountId: undefined }
    const result = mirrorTransactionClassificationSchema.safeParse(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Conta contábil obrigatória')
    }
  })

  it('missing costCenterId → safeParse fails with "Centro de custo obrigatório"', () => {
    const input = { ...VALID_FULL_INPUT, costCenterId: undefined }
    const result = mirrorTransactionClassificationSchema.safeParse(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Centro de custo obrigatório')
    }
  })

  it('valid full input → safeParse succeeds', () => {
    const result = mirrorTransactionClassificationSchema.safeParse(VALID_FULL_INPUT)

    expect(result.success).toBe(true)
  })

  it('bankAccountId omitted → safeParse still succeeds (optional field)', () => {
    const input = { ...VALID_FULL_INPUT }
    // bankAccountId intentionally absent
    const result = mirrorTransactionClassificationSchema.safeParse(input)

    expect(result.success).toBe(true)
  })

  it('bankAccountId null → safeParse still succeeds (nullable field)', () => {
    const input = { ...VALID_FULL_INPUT, bankAccountId: null }
    const result = mirrorTransactionClassificationSchema.safeParse(input)

    expect(result.success).toBe(true)
  })
})

// ─── Dynamic-import tests (RED until Plan 03 creates the module) ──────────────

describe('transactionClassificationSchema — dynamic import (RED until Plan 03)', () => {
  it('missing accountId → fails with "Conta contábil obrigatória" (from actual module)', async () => {
    // Dynamic import — throws if module absent → RED
    const mod = await import('@/lib/financeiro/transaction-schema')
    const schema = (
      mod as { transactionClassificationSchema: typeof mirrorTransactionClassificationSchema }
    ).transactionClassificationSchema

    const input = { ...VALID_FULL_INPUT, accountId: undefined }
    const result = schema.safeParse(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Conta contábil obrigatória')
    }
  })

  it('missing costCenterId → fails with "Centro de custo obrigatório" (from actual module)', async () => {
    const mod = await import('@/lib/financeiro/transaction-schema')
    const schema = (
      mod as { transactionClassificationSchema: typeof mirrorTransactionClassificationSchema }
    ).transactionClassificationSchema

    const input = { ...VALID_FULL_INPUT, costCenterId: undefined }
    const result = schema.safeParse(input)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Centro de custo obrigatório')
    }
  })

  it('valid full input → succeeds (from actual module)', async () => {
    const mod = await import('@/lib/financeiro/transaction-schema')
    const schema = (
      mod as { transactionClassificationSchema: typeof mirrorTransactionClassificationSchema }
    ).transactionClassificationSchema

    const result = schema.safeParse(VALID_FULL_INPUT)

    expect(result.success).toBe(true)
  })

  it('bankAccountId omitted → succeeds (optional — from actual module)', async () => {
    const mod = await import('@/lib/financeiro/transaction-schema')
    const schema = (
      mod as { transactionClassificationSchema: typeof mirrorTransactionClassificationSchema }
    ).transactionClassificationSchema

    const input = { ...VALID_FULL_INPUT }
    // bankAccountId intentionally absent
    const result = schema.safeParse(input)

    expect(result.success).toBe(true)
  })
})
