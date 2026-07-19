/**
 * DRE Server Actions tests (REP-01) — Plan 19-04
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * Covers (per 19-04-PLAN.md behavior — query-touching paths are covered by
 * Manual-Only verification in 19-VALIDATION.md; these unit tests target the
 * PURE resolution + role gate + YoY-availability logic):
 *   1. resolveDreCostCenterFilter — pure unit→cost-center filter decision
 *      (no unitId → consolidated / unitId+CCs → unit filter / unitId+0 CCs → empty)
 *   2. computeYoyAvailability — pure D-11 decision (≥12 months → available:true
 *      with period shifted exactly one year earlier; <12 months → available:false)
 *   3. getDre role gate (T-19-01) — role outside DRE_ROLES never touches
 *      financial_transactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const DRE_MOD = join(process.cwd(), 'src/actions/dre.ts')

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  client: undefined as unknown,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => hoisted.client),
}))
vi.mock('@/actions/units', () => ({
  listUnits: vi.fn(async () => ({ success: true, units: [] })),
}))

// ─── Mock query builder ───────────────────────────────────────────────────────
// Chainable + thenable (mirrors supabase-js PostgrestFilterBuilder), with
// .single()/.maybeSingle() terminals.

function makeQueryBuilder(resolve: () => { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
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
      // financial_transactions / cost_centers: empty result by default —
      // these role-gate tests only assert whether the table was reached.
      return makeQueryBuilder(() => ({ data: [], error: null }))
    },
  }
}

beforeEach(() => {
  hoisted.client = undefined
})

// ─── File presence ────────────────────────────────────────────────────────────

describe('dre.ts — file presence', () => {
  it('src/actions/dre.ts exists', () => {
    expect(existsSync(DRE_MOD)).toBe(true)
  })
})

// ─── resolveDreCostCenterFilter — pure unit→cost-center resolution ───────────

describe('dre.ts — resolveDreCostCenterFilter (pure unit-filter resolution)', () => {
  it('no unitId → consolidated mode, no cost-center filter (D-03/A4: includes NULL rows)', async () => {
    const { resolveDreCostCenterFilter } = (await import(DRE_MOD)) as {
      resolveDreCostCenterFilter: (
        unitId: string | undefined,
        ids: string[]
      ) => Promise<{ mode: string; costCenterIds?: string[] }>
    }
    const decision = await resolveDreCostCenterFilter(undefined, [])
    expect(decision.mode).toBe('consolidated')
  })

  it('unitId with 2 cost centers → unit mode filtering IN those 2 ids', async () => {
    const { resolveDreCostCenterFilter } = (await import(DRE_MOD)) as {
      resolveDreCostCenterFilter: (
        unitId: string | undefined,
        ids: string[]
      ) => Promise<{ mode: string; costCenterIds?: string[] }>
    }
    const decision = await resolveDreCostCenterFilter('unit-1', ['cc-1', 'cc-2'])
    expect(decision.mode).toBe('unit')
    expect(decision.costCenterIds).toEqual(['cc-1', 'cc-2'])
  })

  it('unitId with 0 cost centers → empty mode (empty result, no query needed)', async () => {
    const { resolveDreCostCenterFilter } = (await import(DRE_MOD)) as {
      resolveDreCostCenterFilter: (
        unitId: string | undefined,
        ids: string[]
      ) => Promise<{ mode: string; costCenterIds?: string[] }>
    }
    const decision = await resolveDreCostCenterFilter('unit-2', [])
    expect(decision.mode).toBe('empty')
  })
})

// ─── computeYoyAvailability — pure D-11 YoY-availability decision ────────────

describe('dre.ts — computeYoyAvailability (D-11)', () => {
  it('earliest transaction ≥12 months before `from` → available:true, period shifted exactly one year earlier', async () => {
    const { computeYoyAvailability } = (await import(DRE_MOD)) as {
      computeYoyAvailability: (
        earliest: string | null,
        from: string,
        to: string
      ) => Promise<{ available: boolean; shiftedFrom?: string; shiftedTo?: string }>
    }
    const result = await computeYoyAvailability('2024-01-01', '2025-01-01', '2025-01-31')
    expect(result.available).toBe(true)
    expect(result.shiftedFrom).toBe('2024-01-01')
    expect(result.shiftedTo).toBe('2024-01-31')
  })

  it('earliest transaction <12 months before `from` → available:false, no shifted period attempted', async () => {
    const { computeYoyAvailability } = (await import(DRE_MOD)) as {
      computeYoyAvailability: (
        earliest: string | null,
        from: string,
        to: string
      ) => Promise<{ available: boolean; shiftedFrom?: string; shiftedTo?: string }>
    }
    const result = await computeYoyAvailability('2024-06-01', '2025-01-01', '2025-01-31')
    expect(result.available).toBe(false)
    expect(result.shiftedFrom).toBeUndefined()
    expect(result.shiftedTo).toBeUndefined()
  })

  it('no transaction history at all (earliest null) → available:false', async () => {
    const { computeYoyAvailability } = (await import(DRE_MOD)) as {
      computeYoyAvailability: (
        earliest: string | null,
        from: string,
        to: string
      ) => Promise<{ available: boolean }>
    }
    const result = await computeYoyAvailability(null, '2025-01-01', '2025-01-31')
    expect(result.available).toBe(false)
  })
})

// ─── getDre role gate (T-19-01) ───────────────────────────────────────────────

type GetDre = (params: { from: string; to: string; unitId?: string }) => Promise<{
  success: boolean
  dre?: unknown
  error?: string
}>

describe('dre.ts — getDre role gate (T-19-01, D-09)', () => {
  it('role outside DRE_ROLES (dentist) → success:false, no query against financial_transactions', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'dentist' }, fromCalls })

    const { getDre } = (await import(DRE_MOD)) as { getDre: GetDre }
    const result = await getDre({ from: '2025-01-01', to: '2025-01-31' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Permissão insuficiente para visualizar o DRE')
    expect(fromCalls).not.toContain('financial_transactions')
  })

  it('role inside DRE_ROLES (admin) → proceeds and queries financial_transactions', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'admin' }, fromCalls })

    const { getDre } = (await import(DRE_MOD)) as { getDre: GetDre }
    const result = await getDre({ from: '2025-01-01', to: '2025-01-31' })

    expect(result.success).toBe(true)
    expect(fromCalls).toContain('financial_transactions')
  })

  it('socio is allowed (D-09 DRE_ROLES includes socio)', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-2', tenant_id: 'c-1', role: 'socio' }, fromCalls })

    const { getDre } = (await import(DRE_MOD)) as { getDre: GetDre }
    const result = await getDre({ from: '2025-01-01', to: '2025-01-31' })

    expect(result.success).toBe(true)
  })
})
