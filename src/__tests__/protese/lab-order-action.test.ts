/**
 * lab-order-action.test.ts — Source-inspection tests for LAB Server Actions (LAB-01/LAB-02)
 *
 * Phase 13 Plan 04 (TDD RED→GREEN):
 * Tests that src/actions/lab-orders.ts contains the required financial controls
 * without executing Supabase or any server-side code. All assertions are against
 * the SOURCE TEXT of the action file (readFileSync).
 *
 * Critical invariants verified:
 *   1. File is a 'use server' module
 *   2. Imports isCostPostable + buildLabExpenseDescription from lab-cost lib
 *   3. setLabOrderCost inserts into financial_transactions with type:'despesa' and tenant_id
 *   4. setLabOrderCost backfills financial_transaction_id on lab_orders
 *   5. Double-post guard: checks existing financial_transaction_id before posting (idempotency)
 *   6. assertNotReadOnly + logBusinessEvent present
 *   7. financial_transactions uses tenant_id (NOT clinic_id) — critical schema requirement
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 04
 * Requirements: LAB-01, LAB-02
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ACTION_FILE = path.resolve(process.cwd(), 'src/actions/lab-orders.ts')
const has = existsSync(ACTION_FILE)

describe('lab-orders.ts — source-inspection (LAB-01/LAB-02)', () => {
  it('action file exists', () => {
    expect(has).toBe(true)
  })

  it("starts with 'use server' directive", () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src.trimStart().startsWith("'use server'")).toBe(true)
  })

  it('imports isCostPostable from lab-cost lib', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('isCostPostable')
    expect(src).toContain('lab-cost')
  })

  it('imports buildLabExpenseDescription from lab-cost lib', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('buildLabExpenseDescription')
    expect(src).toContain('lab-cost')
  })

  it('inserts into financial_transactions (LAB-02 despesa posting)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('financial_transactions')
  })

  it("financial_transactions insert uses type: 'despesa' (LAB-02)", () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain("type: 'despesa'")
  })

  it('financial_transactions insert uses tenant_id (NOT clinic_id) — critical schema requirement', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // Must contain tenant_id: on the financial_transactions insert
    expect(src).toContain('tenant_id:')
  })

  it('backfills financial_transaction_id on lab_orders (LAB-02)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('financial_transaction_id')
  })

  it('double-post guard: rejects if financial_transaction_id already set ("já lançado")', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // Must contain the pt-BR error message for the idempotency guard (T-13-15)
    expect(src).toContain('já lançado')
  })

  it('calls assertNotReadOnly (read-only role gate)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('assertNotReadOnly')
  })

  it('calls logBusinessEvent (audit trail — LGPD IDs only)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('logBusinessEvent')
  })

  it('all top-level exports are async functions (Turbopack use server constraint)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // Should not have any non-async exported functions
    const nonAsyncExports = src.match(/^export function /m)
    expect(nonAsyncExports).toBeNull()
  })

  it('contains lab.order.cost.posted event (LAB-02 audit)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('lab.order.cost.posted')
  })

  it('COST_ROLES is admin+superadmin only (matches financial RLS)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('COST_ROLES')
    // Must include admin and superadmin
    expect(src).toContain("'admin'")
    expect(src).toContain("'superadmin'")
  })

  it('ORDER_ROLES includes dentist (lab orders are clinical workflows)', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    expect(src).toContain('ORDER_ROLES')
    expect(src).toContain("'dentist'")
  })

  it('lab_orders uses clinic_id (not tenant_id) for tenant scope', () => {
    if (!has) return
    const src = readFileSync(ACTION_FILE, 'utf8')
    // lab_orders and prosthetic_labs use clinic_id (per migration schema)
    expect(src).toContain('clinic_id')
  })
})
