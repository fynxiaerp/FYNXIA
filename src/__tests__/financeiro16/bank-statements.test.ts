/**
 * Phase 16 — Bank statements action behavior RED specs (FOP-02 idempotency, D-11)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 3 Plan 07 creates src/actions/bank-statements.ts.
 * Uses mocked Supabase admin client — no real DB.
 *
 * Requirements encoded:
 *   FOP-02 — importOFX: inserts statement_lines for each parsed OFX line
 *   D-11   — FITID idempotency: 23505 unique violation → skipped (not duplicated)
 *   D-11   — fitid_fallback: line without FITID gets sha256 hash as fitid_fallback
 */

import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144) ──────────────────────────────────────────

const BANK_STMTS_MOD = join(process.cwd(), 'src/actions/bank-statements.ts')

// ─── Mock setup ──────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

// ─── bank-statements action file presence ────────────────────────────────────

describe('bank-statements.ts — file presence', () => {
  it('src/actions/bank-statements.ts exists (RED until Plan 07 creates it)', () => {
    expect(existsSync(BANK_STMTS_MOD)).toBe(true)
  })
})

// ─── importOFX — inserts statement_lines for each parsed line ─────────────────

describe('bank-statements.ts — importOFX inserts statement_lines', () => {
  it('importOFX with 3-line OFX buffer calls insert for each statement_line', async () => {
    const { importOFX } = await import(BANK_STMTS_MOD) as {
      importOFX: (params: {
        bankAccountId: string
        clinicId: string
        buffer: Buffer
        adminClient?: unknown
      }) => Promise<{ imported: number; skipped: number; error?: string }>
    }

    const insertedRows: unknown[] = []
    const mockClient = {
      from: (table: string) => ({
        insert: (rows: unknown) => {
          if (table === 'statement_lines') {
            const arr = Array.isArray(rows) ? rows : [rows]
            arr.forEach(r => insertedRows.push(r))
          }
          return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'sl-1' }, error: null }) }), error: null, data: { id: 'bs-1' } }
        },
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'ba-1', clinic_id: 'c-1' }, error: null }) }) }),
        update: () => ({ eq: () => vi.fn().mockResolvedValue({ data: {}, error: null }) }),
      }),
    }

    // Minimal OFX buffer with 3 STMTTRN (same as fixture)
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601<DTEND>20260630
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260605<TRNAMT>1500.00<FITID>FIT001<MEMO>DEPOSITO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260610<TRNAMT>-200.00<FITID>FIT002<MEMO>PAGAMENTO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260615<TRNAMT>3200.50<FITID>FIT003<MEMO>TED</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>4500.50<DTASOF>20260630</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

    const result = await importOFX({
      bankAccountId: 'ba-1',
      clinicId: 'c-1',
      buffer: Buffer.from(ofxContent, 'utf-8'),
      adminClient: mockClient,
    })

    expect(result.imported).toBeGreaterThan(0)
    expect(result.imported).toBe(3)
  })
})

// ─── FITID idempotency: 23505 → skipped (D-11) ────────────────────────────────

describe('bank-statements.ts — importOFX FITID idempotency via 23505 skip (D-11)', () => {
  it('lines whose insert returns Postgres error code 23505 are counted as skipped, not duplicated', async () => {
    const { importOFX } = await import(BANK_STMTS_MOD) as {
      importOFX: (params: {
        bankAccountId: string
        clinicId: string
        buffer: Buffer
        adminClient?: unknown
      }) => Promise<{ imported: number; skipped: number; error?: string }>
    }

    // Mock: first insert succeeds (bank_statements), subsequent inserts return 23505
    let insertCallCount = 0
    const mockClient = {
      from: (table: string) => ({
        insert: (rows: unknown) => {
          insertCallCount++
          if (table === 'statement_lines') {
            // Simulate unique violation on all statement_lines
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                }),
              }),
              error: { code: '23505' },
              data: null,
            }
          }
          // bank_statements insert succeeds
          return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'bs-1' }, error: null }) }), error: null, data: { id: 'bs-1' } }
        },
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'ba-1', clinic_id: 'c-1' }, error: null }) }) }),
        update: () => ({ eq: () => vi.fn() }),
      }),
    }

    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601<DTEND>20260630
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260605<TRNAMT>1500.00<FITID>FIT001<MEMO>DEPOSITO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260610<TRNAMT>-200.00<FITID>FIT002<MEMO>PAGAMENTO</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1300.00<DTASOF>20260630</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

    const result = await importOFX({
      bankAccountId: 'ba-1',
      clinicId: 'c-1',
      buffer: Buffer.from(ofxContent, 'utf-8'),
      adminClient: mockClient,
    })

    // On 23505 → lines are skipped, not re-inserted
    expect(result.skipped).toBeGreaterThan(0)
    expect(result.imported).toBe(0) // all were duplicates
  })
})

// ─── fitid_fallback: line without FITID gets sha256 hash (D-11) ──────────────

describe('bank-statements.ts — importOFX fitid_fallback for lines without FITID (D-11)', () => {
  it('insert payload has fitid_fallback non-null when fitid is null/absent', async () => {
    const { importOFX } = await import(BANK_STMTS_MOD) as {
      importOFX: (params: {
        bankAccountId: string
        clinicId: string
        buffer: Buffer
        adminClient?: unknown
      }) => Promise<{ imported: number; skipped: number; error?: string }>
    }

    const insertedPayloads: Record<string, unknown>[] = []
    const mockClient = {
      from: (table: string) => ({
        insert: (rows: unknown) => {
          if (table === 'statement_lines') {
            const arr = Array.isArray(rows) ? rows : [rows]
            arr.forEach((r: Record<string, unknown>) => insertedPayloads.push(r))
          }
          return { select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'sl-1' }, error: null }) }), error: null, data: { id: 'bs-1' } }
        },
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'ba-1', clinic_id: 'c-1' }, error: null }) }) }),
        update: () => ({ eq: () => vi.fn() }),
      }),
    }

    // OFX line WITHOUT FITID (some banks omit it)
    const ofxNoFitid = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601<DTEND>20260630
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260605<TRNAMT>500.00<MEMO>SEM FITID</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>500.00<DTASOF>20260630</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

    await importOFX({
      bankAccountId: 'ba-1',
      clinicId: 'c-1',
      buffer: Buffer.from(ofxNoFitid, 'utf-8'),
      adminClient: mockClient,
    })

    // At least one inserted row should have fitid_fallback set (non-null, non-empty sha256)
    const withFallback = insertedPayloads.filter(
      r => r.fitid_fallback != null && typeof r.fitid_fallback === 'string' && r.fitid_fallback.length > 0
    )
    expect(withFallback.length).toBeGreaterThan(0)
  })
})
