/**
 * Phase 16 — Bank statements action behavior specs (FOP-02 idempotency, D-11)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * Security note (T-16-31): importOFX derives clinic_id from the AUTHENTICATED
 * actor (getActor → createClient → users.tenant_id), never from caller input.
 * These tests mock the server Supabase client module (not param injection) so
 * clinic scoping stays server-controlled. The production signature is
 * importOFX({ bankAccountId, filename, buffer }). Asserting clinic_id ===
 * actor.tenant_id ('c-1') in the persisted rows proves T-16-31 is honored.
 *
 * OFX parsing is covered separately by ofx-parser.test.ts, so parseOfxBuffer is
 * mocked here to return controlled StatementLine[] — these specs target the
 * persistence + idempotency + fitid_fallback logic of importOFX only.
 *
 * Requirements encoded:
 *   FOP-02 — importOFX: inserts statement_lines for each parsed OFX line
 *   D-11   — FITID idempotency: duplicate lines are skipped (not re-inserted)
 *   D-11   — fitid_fallback: line without FITID gets sha256 hash as fitid_fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const BANK_STMTS_MOD = join(process.cwd(), 'src/actions/bank-statements.ts')

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  client: undefined as unknown,
  parsed: { lines: [] as Array<Record<string, unknown>>, warnings: [] as string[] },
}))

// T-16-31: mock the server client module so clinic_id resolution stays
// server-side (actor.tenant_id), never trusting caller-supplied ids.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => hoisted.client),
}))
vi.mock('@/lib/audit', () => ({ logBusinessEvent: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// OFX parsing covered by ofx-parser.test.ts — mock here for controlled lines.
vi.mock('@/lib/financeiro/ofx-parser', () => ({
  parseOfxBuffer: vi.fn(async () => hoisted.parsed),
}))

// ─── Mock client builder ──────────────────────────────────────────────────────
// Supports the exact call chains importOFX uses:
//   auth.getUser()
//   from('users').select(..).eq(..).single()            → actor {id,tenant_id,role}
//   from('bank_accounts').select('id').eq(..).single()  → ownership re-check
//   from('bank_statements').insert(..).select('id').single()
//   from('statement_lines').upsert(rows,opts).select('id') → captured + result

type UpsertMode = 'inserted' | 'allSkipped'

function makeMockClient(opts: {
  capturedLines: Record<string, unknown>[]
  upsertMode: UpsertMode
  actor?: { id: string; tenant_id: string; role: string }
}) {
  const actor = opts.actor ?? { id: 'u-1', tenant_id: 'c-1', role: 'admin' }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor.id } }, error: null }),
    },
    from: (table: string) => ({
      select: (_cols?: string) => ({
        eq: (_col?: string, _val?: unknown) => ({
          single: vi.fn().mockResolvedValue(
            table === 'users'
              ? { data: actor, error: null }
              : table === 'bank_accounts'
                ? { data: { id: 'ba-1' }, error: null }
                : { data: null, error: null },
          ),
        }),
      }),
      insert: (_row: unknown) => ({
        select: (_c?: string) => ({
          single: vi.fn().mockResolvedValue(
            table === 'bank_statements'
              ? { data: { id: 'bs-1' }, error: null }
              : { data: { id: 'x-1' }, error: null },
          ),
        }),
      }),
      upsert: (rows: unknown, _opts?: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows]
        if (table === 'statement_lines') {
          arr.forEach((r) => opts.capturedLines.push(r as Record<string, unknown>))
        }
        return {
          // upsert(...).select('id') is awaited directly
          select: (_c?: string) =>
            Promise.resolve({
              data: opts.upsertMode === 'allSkipped' ? [] : arr.map((_, i) => ({ id: `sl-${i}` })),
              error: null,
            }),
        }
      },
      update: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }),
    }),
  }
}

type StatementLine = { fitid: string; date: Date; amount: number; memo: string; check_number?: string }

function line(fitid: string, amount: number, memo: string, day = 5): StatementLine {
  return { fitid, date: new Date(`2026-06-${String(day).padStart(2, '0')}`), amount, memo }
}

type ImportOFX = (params: {
  bankAccountId: string
  filename: string
  buffer: Buffer
}) => Promise<{ success: boolean; statementId?: string; imported?: number; skipped?: number; warnings?: string[]; error?: string }>

const DUMMY_BUFFER = Buffer.from('OFX', 'utf-8')

beforeEach(() => {
  hoisted.client = undefined
  hoisted.parsed = { lines: [], warnings: [] }
})

// ─── bank-statements action file presence ────────────────────────────────────

describe('bank-statements.ts — file presence', () => {
  it('src/actions/bank-statements.ts exists', () => {
    expect(existsSync(BANK_STMTS_MOD)).toBe(true)
  })
})

// ─── importOFX — inserts statement_lines for each parsed line ─────────────────

describe('bank-statements.ts — importOFX inserts statement_lines', () => {
  it('importOFX with 3 parsed lines upserts each statement_line (imported = 3)', async () => {
    const captured: Record<string, unknown>[] = []
    hoisted.client = makeMockClient({ capturedLines: captured, upsertMode: 'inserted' })
    hoisted.parsed = {
      lines: [
        line('FIT001', 1500.0, 'DEPOSITO', 5),
        line('FIT002', -200.0, 'PAGAMENTO', 10),
        line('FIT003', 3200.5, 'TED', 15),
      ] as unknown as Array<Record<string, unknown>>,
      warnings: [],
    }

    const { importOFX } = (await import(BANK_STMTS_MOD)) as { importOFX: ImportOFX }

    const result = await importOFX({
      bankAccountId: 'ba-1',
      filename: 'extrato.ofx',
      buffer: DUMMY_BUFFER,
    })

    expect(result.success).toBe(true)
    expect(result.imported).toBe(3)
    expect(captured.length).toBe(3)
    // T-16-31: clinic_id comes from the authenticated actor, not caller input
    expect(captured.every((r) => r.clinic_id === 'c-1')).toBe(true)
  })
})

// ─── FITID idempotency: duplicates skipped (D-11) ─────────────────────────────

describe('bank-statements.ts — importOFX FITID idempotency skips duplicates (D-11)', () => {
  it('lines already present (upsert ignoreDuplicates returns no rows) are counted as skipped, not duplicated', async () => {
    const captured: Record<string, unknown>[] = []
    hoisted.client = makeMockClient({ capturedLines: captured, upsertMode: 'allSkipped' })
    hoisted.parsed = {
      lines: [line('FIT001', 1500.0, 'DEPOSITO', 5), line('FIT002', -200.0, 'PAGAMENTO', 10)] as unknown as Array<
        Record<string, unknown>
      >,
      warnings: [],
    }

    const { importOFX } = (await import(BANK_STMTS_MOD)) as { importOFX: ImportOFX }

    const result = await importOFX({
      bankAccountId: 'ba-1',
      filename: 'extrato-dup.ofx',
      buffer: DUMMY_BUFFER,
    })

    // Duplicates → lines are skipped, not re-inserted
    expect(result.success).toBe(true)
    expect(result.skipped).toBeGreaterThan(0)
    expect(result.imported).toBe(0)
  })
})

// ─── fitid_fallback: line without FITID gets sha256 hash (D-11) ──────────────

describe('bank-statements.ts — importOFX fitid_fallback for lines without FITID (D-11)', () => {
  it('upsert payload has fitid_fallback non-null when fitid is null/absent', async () => {
    const captured: Record<string, unknown>[] = []
    hoisted.client = makeMockClient({ capturedLines: captured, upsertMode: 'inserted' })
    // Line WITHOUT FITID (some banks omit it) → importOFX computes sha256 fallback
    hoisted.parsed = {
      lines: [line('', 500.0, 'SEM FITID', 5)] as unknown as Array<Record<string, unknown>>,
      warnings: [],
    }

    const { importOFX } = (await import(BANK_STMTS_MOD)) as { importOFX: ImportOFX }

    await importOFX({
      bankAccountId: 'ba-1',
      filename: 'extrato-sem-fitid.ofx',
      buffer: DUMMY_BUFFER,
    })

    // At least one captured row should have fitid_fallback set (non-null, non-empty sha256)
    const withFallback = captured.filter(
      (r) => r.fitid_fallback != null && typeof r.fitid_fallback === 'string' && (r.fitid_fallback as string).length > 0,
    )
    expect(withFallback.length).toBeGreaterThan(0)
    // T-16-31: clinic_id from actor, not input
    expect(captured.every((r) => r.clinic_id === 'c-1')).toBe(true)
  })
})
