/**
 * src/lib/financeiro/ofx-parser.ts — OFX SGML/XML parser wrapper (FOP-02)
 *
 * Wraps ofx-data-extractor to extract StatementLine[] from OFX Buffer.
 * Pure async function — no 'server-only', no DB/I/O beyond reading the buffer.
 *
 * SECURITY:
 *   T-16-12: ofx-data-extractor lenient mode + getWarnings; returns warnings
 *            without throwing on minor malformed OFX content.
 *   D-11: FITID extracted as-is; idempotency key enforcement is at the action layer.
 */

import { Ofx } from 'ofx-data-extractor'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatementLine {
  fitid: string
  date: Date
  amount: number       // positive = credit, negative = debit
  memo: string
  check_number?: string
}

// ─── parseOfxBuffer ───────────────────────────────────────────────────────────

/**
 * Parse an OFX file buffer and return structured StatementLine[].
 *
 * DTPOSTED format: YYYYMMDD or YYYYMMDDHHMMSS — only first 8 chars used.
 * Uses ofx-data-extractor.getTransactionsSummary() API (verified npm 1.5.0).
 */
export async function parseOfxBuffer(buffer: Buffer): Promise<{
  account_id?: string
  lines: StatementLine[]
  warnings: string[]
}> {
  // fromBuffer is synchronous in ofx-data-extractor 1.5.0
  const ofx = Ofx.fromBuffer(buffer)

  // getBankTransferList returns the array of STMTTRN objects (FITID, DTPOSTED, TRNAMT, MEMO, NAME, CHECKNUM)
  // getTransactionsSummary returns aggregate stats, not the transaction list
  const transactions = ofx.getBankTransferList()

  const lines: StatementLine[] = transactions.map((t) => {
    // Parse DTPOSTED: take first 8 chars (YYYYMMDD), convert to Date
    const dtRaw = String(t.DTPOSTED ?? '').slice(0, 8)
    const date =
      dtRaw.length === 8
        ? new Date(
            `${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`
          )
        : new Date(String(t.DTPOSTED))

    const line: StatementLine = {
      fitid: String(t.FITID ?? ''),
      date,
      amount: Number(t.TRNAMT),
      memo: (t.MEMO ?? t.NAME ?? '') as string,
    }

    if (t.CHECKNUM) {
      line.check_number = String(t.CHECKNUM)
    }

    return line
  })

  const rawWarnings =
    typeof ofx.getWarnings === 'function' ? ofx.getWarnings() : []
  // OfxDiagnostic[] → string[] (toString each entry for type safety)
  const warnings: string[] = rawWarnings.map((w) => String(w))

  return { lines, warnings }
}
