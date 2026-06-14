/**
 * Phase 10 — audit/audit-ui.test.ts (Wave 0 RED scaffold)
 *
 * Covers:
 * - AUD-01: audit_logs query lib (table_name filter, actor_id, date range, pagination)
 * - AUD-03: audit screen page is a Server Component, renders before/after diff,
 *           references queryAuditLogs / audit-actions
 *
 * Convention (mirrors connectors.test.ts):
 * - SRC(relPath) returns '' if file missing (RED on content, not ENOENT)
 * - No dynamic imports needed — pure source-inspection only
 *
 * Tests are RED by design until Plan 04 creates:
 * - src/actions/audit-actions.ts
 * - src/app/(dashboard)/conformidade/auditoria/page.tsx
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))

// ─── SRC helper ──────────────────────────────────────────────────────────────

function SRC(relPath: string): string {
  const absPath = resolve(process.cwd(), relPath)
  try {
    return readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

// ─── AUD-01/03: audit-actions.ts source-inspection ───────────────────────────
// RED by design until Plan 04 creates src/actions/audit-actions.ts

describe('src/actions/audit-actions.ts source-inspection (AUD-01, AUD-03)', () => {
  const src = SRC('src/actions/audit-actions.ts')

  it('queries audit_logs table', () => {
    expect(src).toMatch(/audit_logs/)
  })

  it('has table_name filter (AUD-03: filter by entity type)', () => {
    // Audit screen must allow filtering by entity (patients, appointments, etc.)
    expect(src).toMatch(/table_name/)
  })

  it('has actor_id filter (AUD-03: filter by who made the change)', () => {
    expect(src).toMatch(/actor_id/)
  })

  it('has created_at range filter with gte (date from — AUD-03: filter by period)', () => {
    expect(src).toMatch(/gte/)
  })

  it('has created_at range filter with lte (date to)', () => {
    expect(src).toMatch(/lte/)
  })

  it('orders results by created_at descending', () => {
    expect(src).toMatch(/order\(['"]created_at['"]/)
  })

  it('supports pagination with range() call', () => {
    // AUD-03: audit screen must paginate — audit_logs can have millions of rows
    expect(src).toMatch(/range\(/)
  })

  it('exports queryAuditLogs function', () => {
    expect(src).toMatch(/export.*function queryAuditLogs|export async function queryAuditLogs|export const queryAuditLogs/)
  })
})

// ─── AUD-03: audit screen page source-inspection ─────────────────────────────
// RED by design until Plan 04 creates the auditoria page

describe('src/app/(dashboard)/conformidade/auditoria/page.tsx source-inspection (AUD-03)', () => {
  // Note: parenthesized route group (dashboard) — path must be exact
  const src = SRC('src/app/(dashboard)/conformidade/auditoria/page.tsx')

  it('page is a Server Component (no "use client" directive at top)', () => {
    // RSC: audit screen must NOT be a client component (queries run server-side)
    // A 'use client' at the top of the file would break server-only data access
    const firstLine = src.split('\n').slice(0, 3).join('\n')
    expect(firstLine).not.toMatch(/'use client'|"use client"/)
  })

  it('references queryAuditLogs or audit-actions (data source)', () => {
    expect(src).toMatch(/queryAuditLogs|audit-actions/)
  })

  it('renders old_values (before state — AUD-01 before/after diff)', () => {
    // AUD-01: audit trail records before content; page must display it
    expect(src).toMatch(/old_values/)
  })

  it('renders new_values (after state — AUD-01 before/after diff)', () => {
    // AUD-01: audit trail records after content; page must display it
    expect(src).toMatch(/new_values/)
  })
})
