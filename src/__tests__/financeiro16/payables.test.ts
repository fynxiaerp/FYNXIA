/**
 * Phase 16 — Payables action behavior RED specs (FOP-01)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 3 Plan 06 creates src/actions/payables.ts.
 * Uses mocked Supabase admin client — no real DB.
 *
 * Requirements encoded:
 *   FOP-01 — baixarPayable: inserts financial_transaction type='despesa' + decrements saldo_atual (D-03)
 *   FOP-01 — baixa parcial: valorPago < saldo → installment status='parcial' (D-04)
 *   FOP-01 — idempotency/CAS: second baixa on 'pago' installment does NOT re-insert (D-30 pattern)
 *   D-23   — role gate: non-writer role returns error mentioning permissão
 */

import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const PAYABLES_MOD = join(process.cwd(), 'src/actions/payables.ts')

// ─── Mock setup ──────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

// ─── payables action file presence ───────────────────────────────────────────

describe('payables.ts — file presence', () => {
  it('src/actions/payables.ts exists (RED until Plan 06 creates it)', () => {
    expect(existsSync(PAYABLES_MOD)).toBe(true)
  })
})

// ─── baixarPayable — despesa insert + saldo debit (D-03) ─────────────────────

describe('payables.ts — baixarPayable inserts despesa + debits saldo_atual (D-03)', () => {
  it('baixarPayable calls insert on financial_transactions with type="despesa"', async () => {
    const { baixarPayable } = await import(PAYABLES_MOD) as {
      baixarPayable: (params: {
        installmentId: string
        bankAccountId: string
        valorPago: number
        dataPagamento: string
        adminClient?: unknown
        userRole?: string
      }) => Promise<{ success: boolean; error?: string }>
    }

    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null })
    const updateMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'inst-1', status: 'pendente', valor: 500, valor_pago: null },
      error: null,
    })

    const mockClient = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ single: singleMock }) }),
        insert: insertMock,
        update: () => ({ eq: () => ({ eq: updateMock }) }),
      }),
    }

    await baixarPayable({
      installmentId: 'inst-1',
      bankAccountId: 'ba-1',
      valorPago: 500,
      dataPagamento: '2026-06-22',
      adminClient: mockClient,
      userRole: 'admin',
    })

    // financial_transactions insert must have been called with type='despesa'
    expect(insertMock).toHaveBeenCalledTimes(1)
    const insertArg = insertMock.mock.calls[0][0]
    expect(insertArg).toMatchObject({ type: 'despesa' })
  })
})

// ─── baixa parcial (D-04) ─────────────────────────────────────────────────────

describe('payables.ts — baixa parcial sets status="parcial" (D-04)', () => {
  it('valorPago < saldo → installment update called with status="parcial"', async () => {
    const { baixarPayable } = await import(PAYABLES_MOD) as {
      baixarPayable: (params: {
        installmentId: string
        bankAccountId: string
        valorPago: number
        dataPagamento: string
        adminClient?: unknown
        userRole?: string
      }) => Promise<{ success: boolean; error?: string }>
    }

    const statusUpdates: string[] = []
    const mockClient = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'inst-1', status: 'pendente', valor: 500, valor_pago: null },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null }),
        update: (vals: Record<string, unknown>) => {
          if (vals.status) statusUpdates.push(vals.status as string)
          return { eq: () => ({ eq: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }
        },
      }),
    }

    await baixarPayable({
      installmentId: 'inst-1',
      bankAccountId: 'ba-1',
      valorPago: 200,  // partial: 200 < 500
      dataPagamento: '2026-06-22',
      adminClient: mockClient,
      userRole: 'admin',
    })

    expect(statusUpdates).toContain('parcial')
  })
})

// ─── Idempotency: second baixa on 'pago' installment does not re-insert ──────

describe('payables.ts — idempotency/CAS: already-pago installment skips re-insert', () => {
  it('baixarPayable on pago installment does NOT call financial_transactions insert again', async () => {
    const { baixarPayable } = await import(PAYABLES_MOD) as {
      baixarPayable: (params: {
        installmentId: string
        bankAccountId: string
        valorPago: number
        dataPagamento: string
        adminClient?: unknown
        userRole?: string
      }) => Promise<{ success: boolean; error?: string }>
    }

    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null })
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'inst-1', status: 'pago', valor: 500, valor_pago: 500 },
              error: null,
            }),
          }),
        }),
        insert: insertMock,
        update: () => ({ eq: () => ({ eq: vi.fn() }) }),
      }),
    }

    await baixarPayable({
      installmentId: 'inst-1',
      bankAccountId: 'ba-1',
      valorPago: 500,
      dataPagamento: '2026-06-22',
      adminClient: mockClient,
      userRole: 'admin',
    })

    // Must NOT re-insert (idempotent — already paid)
    expect(insertMock).toHaveBeenCalledTimes(0)
  })
})

// ─── Role gate: non-writer role returns permissão error (D-23) ───────────────

describe('payables.ts — role gate (D-23): non-writer returns error', () => {
  it('baixarPayable called by auditor role returns error mentioning permissão', async () => {
    const { baixarPayable } = await import(PAYABLES_MOD) as {
      baixarPayable: (params: {
        installmentId: string
        bankAccountId: string
        valorPago: number
        dataPagamento: string
        adminClient?: unknown
        userRole?: string
      }) => Promise<{ success: boolean; error?: string }>
    }

    const mockClient = {
      from: () => ({
        select: () => ({ eq: () => ({ single: vi.fn() }) }),
        insert: vi.fn(),
      }),
    }

    const result = await baixarPayable({
      installmentId: 'inst-1',
      bankAccountId: 'ba-1',
      valorPago: 500,
      dataPagamento: '2026-06-22',
      adminClient: mockClient,
      userRole: 'auditor',  // read-only role
    })

    expect(result.success).toBe(false)
    expect(result.error?.toLowerCase()).toMatch(/permiss/)
  })
})
