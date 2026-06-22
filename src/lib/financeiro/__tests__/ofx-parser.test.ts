/**
 * Phase 16 — OFX parser RED specs (FOP-02)
 * Test type: absolute-path dynamic-import-with-existsSync-guard (D-144 pattern)
 *
 * All tests are RED until Wave 1 Plan 04 creates src/lib/financeiro/ofx-parser.ts.
 * Uses the real sample.ofx fixture from Task 1.
 *
 * Requirements encoded:
 *   FOP-02 — parseOfxBuffer: parses 3 STMTTRN from fixture → 3 StatementLine objects
 *   FOP-02 — FITID: first line has fitid === 'FIT001'
 *   FOP-02 — Amounts: credit positive, debit negative
 *   FOP-02 — date is a Date object
 *   FOP-02 — memo is a string
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Module path (absolute — D-144: @-alias causes TS2307 when target missing) ─

const OFX_MOD    = join(process.cwd(), 'src/lib/financeiro/ofx-parser.ts')
const FIXTURE    = join(process.cwd(), 'src/__tests__/financeiro16/fixtures/sample.ofx')

// ─── parseOfxBuffer — FOP-02 ─────────────────────────────────────────────────

describe('ofx-parser.ts — file presence', () => {
  it('src/lib/financeiro/ofx-parser.ts exists (RED until Plan 04 creates it)', () => {
    expect(existsSync(OFX_MOD)).toBe(true)
  })
})

describe('ofx-parser.ts — parseOfxBuffer from sample.ofx fixture', () => {
  it('fixture file exists at src/__tests__/financeiro16/fixtures/sample.ofx', () => {
    expect(existsSync(FIXTURE)).toBe(true)
  })

  it('parseOfxBuffer returns lines.length === 3 (3 STMTTRN in fixture)', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: unknown[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(result.lines.length).toBe(3)
  })

  it('first line has fitid === "FIT001"', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: { fitid: string; date: Date; amount: number; memo: string }[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(result.lines[0].fitid).toBe('FIT001')
  })

  it('first line amount is positive (credit 1500.00)', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: { fitid: string; date: Date; amount: number; memo: string }[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(result.lines[0].amount).toBeGreaterThan(0)
    expect(result.lines[0].amount).toBe(1500)
  })

  it('second line (FIT002) has negative amount (debit -200.00)', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: { fitid: string; amount: number }[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(result.lines[1].fitid).toBe('FIT002')
    expect(result.lines[1].amount).toBeLessThan(0)
    expect(result.lines[1].amount).toBe(-200)
  })

  it('first line date is a Date object', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: { date: unknown }[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(result.lines[0].date).toBeInstanceOf(Date)
  })

  it('first line memo is a non-empty string', async () => {
    const { parseOfxBuffer } = await import(OFX_MOD) as {
      parseOfxBuffer: (buffer: Buffer) => Promise<{ lines: { memo: string }[]; warnings: string[] }>
    }
    const buffer = readFileSync(FIXTURE)
    const result = await parseOfxBuffer(buffer)
    expect(typeof result.lines[0].memo).toBe('string')
    expect(result.lines[0].memo.length).toBeGreaterThan(0)
  })
})
