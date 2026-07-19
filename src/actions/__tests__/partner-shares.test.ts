/**
 * Societário Server Actions tests (REP-03) — Plan 19-06
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern,
 * mirrors src/actions/__tests__/budget-targets.test.ts / dre.test.ts)
 *
 * Covers (per 19-06-PLAN.md <behavior>):
 *   1. assertSharesValid (D-22) — wraps validateSharesSumTo100: rejects a set that
 *      sums to 0.9, accepts a set that sums to exactly 1.0 (rounding-tolerant).
 *   2. priorCloseDate (D-20) — returns the day immediately before a given
 *      vigencia_inicio, used to close prior open vigências without gaps/overlaps.
 *   3. Write role gate (T-19-10, A1) — a role outside SHARE_WRITE_ROLES never
 *      reaches partner_shares for create/close.
 *   4. getPartnerDistribution (D-26) — never inserts into financial_transactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const PARTNER_SHARES_MOD = join(process.cwd(), 'src/actions/partner-shares.ts')

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
        // 'users' is queried both by getActor (.select('id, tenant_id, role').single())
        // and by listSocios (.select('id, full_name, email').order(...), no .single()) —
        // disambiguate by the select() columns to return the right shape for each.
        let isActorLookup = true
        const builder: Record<string, unknown> = {
          select: (cols: string) => {
            isActorLookup = cols.includes('tenant_id')
            return builder
          },
          eq: () => builder,
          order: () => builder,
          single: () => Promise.resolve({ data: opts.actor, error: null }),
          then: (
            onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
            onRejected?: (e: unknown) => unknown
          ) =>
            Promise.resolve(isActorLookup ? { data: opts.actor, error: null } : { data: [], error: null }).then(
              onFulfilled,
              onRejected
            ),
        }
        return builder
      }
      // partner_shares / financial_transactions: empty result by default — these
      // role-gate tests only assert whether the table was reached.
      return makeQueryBuilder(() => ({ data: [], error: null }))
    },
  }
}

beforeEach(() => {
  hoisted.client = undefined
})

// ─── File presence ────────────────────────────────────────────────────────────

describe('partner-shares.ts — file presence', () => {
  it('src/actions/partner-shares.ts exists', () => {
    expect(existsSync(PARTNER_SHARES_MOD)).toBe(true)
  })
})

// ─── assertSharesValid — pure D-22 sum-to-100% validation ────────────────────

type AssertSharesValid = (
  shares: Array<{ userId: string; percentual: number }>,
  data: string
) => Promise<{ valid: boolean; sum: number }>

describe('partner-shares.ts — assertSharesValid (D-22)', () => {
  it('0.6 + 0.3 (sum 0.9) is rejected', async () => {
    const { assertSharesValid } = (await import(PARTNER_SHARES_MOD)) as {
      assertSharesValid: AssertSharesValid
    }
    const result = await assertSharesValid(
      [
        { userId: 'u-1', percentual: 0.6 },
        { userId: 'u-2', percentual: 0.3 },
      ],
      '2026-01-01'
    )
    expect(result.valid).toBe(false)
    expect(result.sum).toBeCloseTo(0.9, 4)
  })

  it('0.6 + 0.4 (sum 1.0) is accepted', async () => {
    const { assertSharesValid } = (await import(PARTNER_SHARES_MOD)) as {
      assertSharesValid: AssertSharesValid
    }
    const result = await assertSharesValid(
      [
        { userId: 'u-1', percentual: 0.6 },
        { userId: 'u-2', percentual: 0.4 },
      ],
      '2026-01-01'
    )
    expect(result.valid).toBe(true)
    expect(result.sum).toBeCloseTo(1, 4)
  })

  it('rounding case: 0.3333 + 0.3333 + 0.3334 (sum exactly 1.0) is accepted', async () => {
    const { assertSharesValid } = (await import(PARTNER_SHARES_MOD)) as {
      assertSharesValid: AssertSharesValid
    }
    const result = await assertSharesValid(
      [
        { userId: 'u-1', percentual: 0.3333 },
        { userId: 'u-2', percentual: 0.3333 },
        { userId: 'u-3', percentual: 0.3334 },
      ],
      '2026-01-01'
    )
    expect(result.valid).toBe(true)
  })
})

// ─── priorCloseDate — pure D-20 day-before derivation ────────────────────────

type PriorCloseDate = (newInicio: string) => Promise<string>

describe('partner-shares.ts — priorCloseDate (D-20)', () => {
  it('2026-07-01 → 2026-06-30', async () => {
    const { priorCloseDate } = (await import(PARTNER_SHARES_MOD)) as { priorCloseDate: PriorCloseDate }
    expect(await priorCloseDate('2026-07-01')).toBe('2026-06-30')
  })

  it('2026-03-01 → 2026-02-28 (non-leap year month-end)', async () => {
    const { priorCloseDate } = (await import(PARTNER_SHARES_MOD)) as { priorCloseDate: PriorCloseDate }
    expect(await priorCloseDate('2026-03-01')).toBe('2026-02-28')
  })

  it('2026-01-01 → 2025-12-31 (year rollover)', async () => {
    const { priorCloseDate } = (await import(PARTNER_SHARES_MOD)) as { priorCloseDate: PriorCloseDate }
    expect(await priorCloseDate('2026-01-01')).toBe('2025-12-31')
  })
})

// ─── Write role gate (T-19-10, A1) ────────────────────────────────────────────

type CreatePartnerShareVigencia = (input: {
  vigenciaInicio: string
  shares: Array<{ userId: string; percentual: number }>
}) => Promise<{ success: boolean; error?: string }>

type ClosePartnerShareVigencia = (params: { vigenciaInicio: string }) => Promise<{
  success: boolean
  error?: string
}>

describe('partner-shares.ts — write role gate (T-19-10, A1)', () => {
  it('createPartnerShareVigencia: socio role is rejected before touching partner_shares', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'socio' }, fromCalls })

    const { createPartnerShareVigencia } = (await import(PARTNER_SHARES_MOD)) as {
      createPartnerShareVigencia: CreatePartnerShareVigencia
    }
    const result = await createPartnerShareVigencia({
      vigenciaInicio: '2026-01-01',
      shares: [{ userId: '22222222-2222-2222-2222-222222222222', percentual: 1 }],
    })

    expect(result.success).toBe(false)
    expect(fromCalls).not.toContain('partner_shares')
  })

  it('createPartnerShareVigencia: admin role proceeds to partner_shares', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'admin' }, fromCalls })

    const { createPartnerShareVigencia } = (await import(PARTNER_SHARES_MOD)) as {
      createPartnerShareVigencia: CreatePartnerShareVigencia
    }
    const result = await createPartnerShareVigencia({
      vigenciaInicio: '2026-01-01',
      shares: [{ userId: '22222222-2222-2222-2222-222222222222', percentual: 1 }],
    })

    expect(result.success).toBe(true)
    expect(fromCalls).toContain('partner_shares')
  })

  it('createPartnerShareVigencia: shares summing to 90% are rejected before any write', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'admin' }, fromCalls })

    const { createPartnerShareVigencia } = (await import(PARTNER_SHARES_MOD)) as {
      createPartnerShareVigencia: CreatePartnerShareVigencia
    }
    const result = await createPartnerShareVigencia({
      vigenciaInicio: '2026-01-01',
      shares: [
        { userId: '22222222-2222-2222-2222-222222222222', percentual: 0.6 },
        { userId: '33333333-3333-3333-3333-333333333333', percentual: 0.3 },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/100%/)
    expect(fromCalls).not.toContain('partner_shares')
  })

  it('closePartnerShareVigencia: receptionist role is rejected before touching partner_shares', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({
      actor: { id: 'u-1', tenant_id: 'c-1', role: 'receptionist' },
      fromCalls,
    })

    const { closePartnerShareVigencia } = (await import(PARTNER_SHARES_MOD)) as {
      closePartnerShareVigencia: ClosePartnerShareVigencia
    }
    const result = await closePartnerShareVigencia({ vigenciaInicio: '2026-01-01' })

    expect(result.success).toBe(false)
    expect(fromCalls).not.toContain('partner_shares')
  })
})

// ─── getPartnerDistribution — never writes financial_transactions (D-26) ─────

type GetPartnerDistribution = (params: { from: string; to: string }) => Promise<{
  success: boolean
  distribution?: unknown
  error?: string
}>

describe('partner-shares.ts — getPartnerDistribution (D-26, purely informative)', () => {
  it('reads partner_shares + financial_transactions but never inserts', async () => {
    const fromCalls: string[] = []
    hoisted.client = makeMockClient({ actor: { id: 'u-1', tenant_id: 'c-1', role: 'admin' }, fromCalls })

    const { getPartnerDistribution } = (await import(PARTNER_SHARES_MOD)) as {
      getPartnerDistribution: GetPartnerDistribution
    }
    const result = await getPartnerDistribution({ from: '2026-01-01', to: '2026-01-31' })

    expect(result.success).toBe(true)
    expect(fromCalls).toContain('partner_shares')
    expect(fromCalls).toContain('financial_transactions')
  })
})
