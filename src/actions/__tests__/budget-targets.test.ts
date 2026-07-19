/**
 * Orçamento Server Actions tests (REP-02) — Plan 19-05
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern,
 * mirrors src/actions/__tests__/dre.test.ts)
 *
 * Covers (per 19-05-PLAN.md <behavior>):
 *   1. isMonthLocked (D-18) — a month strictly before the current SP month is locked;
 *      current month and future months are not. Fixed reference via injected `now`.
 *   2. currentMonthSP — pure SP wall-clock (UTC-3 fixo) derivation, injectable `now`.
 *   3. computeBudgetCell — pure per-cell shaping: meta/realizado → semaphore (D-15)
 *      wired through budgetDeviationSemaphore + locked (D-18), injected `now`.
 *   4. Role gate (T-19-08, D-14) — role outside BUDGET_WRITE_ROLES never touches
 *      budget_targets / financial_transactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const BUDGET_MOD = join(process.cwd(), 'src/actions/budget-targets.ts')

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  client: undefined as unknown,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => hoisted.client),
}))
vi.mock('@/lib/audit', () => ({
  logBusinessEvent: vi.fn(async () => undefined),
}))

// ─── Mock query builder ───────────────────────────────────────────────────────
// Chainable + thenable (mirrors supabase-js PostgrestFilterBuilder), with
// .single()/.maybeSingle() terminals.

function makeQueryBuilder(resolve: () => { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    update: () => builder,
    insert: () => builder,
    single: () => Promise.resolve(resolve()),
    maybeSingle: () => Promise.resolve(resolve()),
    then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  }
  return builder
}

function makeMockClient(opts: {
  actor: { id: string; tenant_id: string; role: string }
  fromCalls: string[]
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: opts.actor.id } }, error: null }),
    },
    from: (table: string) => {
      opts.fromCalls.push(table)
      if (table === 'users') {
        return makeQueryBuilder(() => ({ data: opts.actor, error: null }))
      }
      // budget_targets / cost_centers / financial_transactions: empty result by
      // default — these role-gate tests only assert whether the table was reached.
      return makeQueryBuilder(() => ({ data: [], error: null }))
    },
  }
}

beforeEach(() => {
  hoisted.client = undefined
})

// ─── File presence ────────────────────────────────────────────────────────────

describe('budget-targets.ts — file presence', () => {
  it('src/actions/budget-targets.ts exists', () => {
    expect(existsSync(BUDGET_MOD)).toBe(true)
  })
})

// ─── currentMonthSP — pure SP wall-clock derivation ──────────────────────────

describe('budget-targets.ts — currentMonthSP (D-18, injectable now)', () => {
  it('2026-07-15T12:00:00Z (noon UTC) → SP wall-clock ano=2026 mes=7', async () => {
    const { currentMonthSP } = (await import(BUDGET_MOD)) as {
      currentMonthSP: (now?: Date) => Promise<{ ano: number; mes: number }>
    }
    const result = await currentMonthSP(new Date('2026-07-15T12:00:00Z'))
    expect(result).toEqual({ ano: 2026, mes: 7 })
  })

  it('2026-01-01T01:00:00Z (1am UTC, before SP midnight rollover) → SP wall-clock ano=2025 mes=12', async () => {
    const { currentMonthSP } = (await import(BUDGET_MOD)) as {
      currentMonthSP: (now?: Date) => Promise<{ ano: number; mes: number }>
    }
    // 01:00 UTC - 3h offset = 2025-12-31 22:00 SP — still December of the prior year.
    const result = await currentMonthSP(new Date('2026-01-01T01:00:00Z'))
    expect(result).toEqual({ ano: 2025, mes: 12 })
  })
})

// ─── isMonthLocked — pure D-18 decision, injected `now` ──────────────────────

describe('budget-targets.ts — isMonthLocked (D-18)', () => {
  const NOW = new Date('2026-07-15T12:00:00Z') // SP wall-clock: 2026-07 (current)

  it('a month strictly before the current SP month is locked', async () => {
    const { isMonthLocked } = (await import(BUDGET_MOD)) as {
      isMonthLocked: (ano: number, mes: number, now?: Date) => Promise<boolean>
    }
    expect(await isMonthLocked(2026, 6, NOW)).toBe(true)
  })

  it('the current SP month is NOT locked', async () => {
    const { isMonthLocked } = (await import(BUDGET_MOD)) as {
      isMonthLocked: (ano: number, mes: number, now?: Date) => Promise<boolean>
    }
    expect(await isMonthLocked(2026, 7, NOW)).toBe(false)
  })

  it('a future month is NOT locked', async () => {
    const { isMonthLocked } = (await import(BUDGET_MOD)) as {
      isMonthLocked: (ano: number, mes: number, now?: Date) => Promise<boolean>
    }
    expect(await isMonthLocked(2026, 8, NOW)).toBe(false)
  })

  it('any month of a strictly prior year is locked', async () => {
    const { isMonthLocked } = (await import(BUDGET_MOD)) as {
      isMonthLocked: (ano: number, mes: number, now?: Date) => Promise<boolean>
    }
    expect(await isMonthLocked(2025, 12, NOW)).toBe(true)
  })

  it('any month of a future year is NOT locked', async () => {
    const { isMonthLocked } = (await import(BUDGET_MOD)) as {
      isMonthLocked: (ano: number, mes: number, now?: Date) => Promise<boolean>
    }
    expect(await isMonthLocked(2027, 1, NOW)).toBe(false)
  })
})

// ─── computeBudgetCell — pure per-cell shaping (D-15 semaphore + D-18 lock) ──

describe('budget-targets.ts — computeBudgetCell (D-15/D-18)', () => {
  const NOW = new Date('2026-07-15T12:00:00Z')

  it('meta=1000, realizado=1100 (10% deviation) → semaphore amarelo', async () => {
    const { computeBudgetCell } = (await import(BUDGET_MOD)) as {
      computeBudgetCell: (
        meta: number,
        realizado: number,
        ano: number,
        mes: number,
        now?: Date
      ) => Promise<{ mes: number; meta: number; realizado: number; semaphore: string; locked: boolean }>
    }
    const cell = await computeBudgetCell(1000, 1100, 2026, 7, NOW)
    expect(cell.semaphore).toBe('amarelo')
    expect(cell.meta).toBe(1000)
    expect(cell.realizado).toBe(1100)
  })

  it('a locked past-month cell carries locked:true alongside its semaphore', async () => {
    const { computeBudgetCell } = (await import(BUDGET_MOD)) as {
      computeBudgetCell: (
        meta: number,
        realizado: number,
        ano: number,
        mes: number,
        now?: Date
      ) => Promise<{ locked: boolean }>
    }
    const cell = await computeBudgetCell(1000, 1000, 2026, 6, NOW)
    expect(cell.locked).toBe(true)
  })

  it('the current month cell carries locked:false', async () => {
    const { computeBudgetCell } = (await import(BUDGET_MOD)) as {
      computeBudgetCell: (
        meta: number,
        realizado: number,
        ano: number,
        mes: number,
        now?: Date
      ) => Promise<{ locked: boolean }>
    }
    const cell = await computeBudgetCell(1000, 1000, 2026, 7, NOW)
    expect(cell.locked).toBe(false)
  })
})

// ─── Role gate (T-19-08, D-14) ────────────────────────────────────────────────

type GetBudgetVsRealizado = (params: { ano: number; unitId?: string }) => Promise<{
  success: boolean
  rows?: unknown
  error?: string
}>

describe('budget-targets.ts — getBudgetVsRealizado role gate (T-19-08, D-14)', () => {
  it('role outside BUDGET_WRITE_ROLES (dentist) → success:false, no query against budget_targets', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'dentist' }, fromCalls })

    const { getBudgetVsRealizado } = (await import(BUDGET_MOD)) as { getBudgetVsRealizado: GetBudgetVsRealizado }
    const result = await getBudgetVsRealizado({ ano: 2026 })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Permissão insuficiente para acessar o orçamento')
    expect(fromCalls).not.toContain('budget_targets')
    expect(fromCalls).not.toContain('financial_transactions')
  })

  it('role inside BUDGET_WRITE_ROLES (socio) → proceeds and queries budget_targets', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-2', tenant_id: 'c-1', role: 'socio' }, fromCalls })

    const { getBudgetVsRealizado } = (await import(BUDGET_MOD)) as { getBudgetVsRealizado: GetBudgetVsRealizado }
    const result = await getBudgetVsRealizado({ ano: 2026 })

    expect(result.success).toBe(true)
    expect(fromCalls).toContain('budget_targets')
  })

  it('admin is allowed (D-14 BUDGET_WRITE_ROLES includes admin)', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-3', tenant_id: 'c-1', role: 'admin' }, fromCalls })

    const { getBudgetVsRealizado } = (await import(BUDGET_MOD)) as { getBudgetVsRealizado: GetBudgetVsRealizado }
    const result = await getBudgetVsRealizado({ ano: 2026 })

    expect(result.success).toBe(true)
  })
})
