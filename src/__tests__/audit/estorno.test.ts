/**
 * Phase 10 — audit/estorno.test.ts (Wave 0 RED scaffold)
 *
 * Covers:
 * - AUD-02: estorno action alçada enforcement
 * - AUD-02: estorno creates approval_requests row with type='estorno'
 * - AUD-02: estorno requires motivo/reason
 * - AUD-02: approval routing (required_role set for alçada)
 *
 * Convention (mirrors connectors.test.ts):
 * - SRC(relPath) returns '' if file missing (RED on content, not ENOENT)
 * - canApprove PURE unit reused from governance contract (alçada check)
 *
 * Tests are RED by design until Plan 04 creates createEstorno in
 * src/actions/audit-actions.ts (or a dedicated estorno export).
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
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

// ─── AUD-02: createEstorno source-inspection ──────────────────────────────────
// RED by design until Plan 04 creates createEstorno in audit-actions.ts

describe('createEstorno in src/actions/audit-actions.ts (AUD-02)', () => {
  const src = SRC('src/actions/audit-actions.ts')

  it('exports createEstorno function', () => {
    expect(src).toMatch(/export.*function createEstorno|export async function createEstorno/)
  })

  it('requires reason/motivo parameter (AUD-02: motivo obrigatório)', () => {
    // Estorno requires a motivo — the function must reference 'reason' or 'motivo'
    expect(src).toMatch(/\breason\b|\bmotivo\b/)
  })

  it('inserts into approval_requests table with type estorno', () => {
    // AUD-02: estorno goes through the unified approval queue
    expect(src).toMatch(/approval_requests/)
    expect(src).toMatch(/['"]estorno['"]/)
  })

  it('sets required_role (alçada enforcement — AUD-02)', () => {
    // The alçada (minimum role to approve) must be set on the approval_requests row
    expect(src).toMatch(/required_role/)
  })

  it('calls assertNotReadOnly() (write guard — no read-only role can initiate estorno)', () => {
    expect(src).toMatch(/assertNotReadOnly\(\)/)
  })
})

// ─── AUD-02: canApprove alçada PURE unit (estorno scenario) ──────────────────
// canApprove is a pure sync function in policy-types.ts (NOT exported from
// approval-actions.ts — 'use server' files may only export async functions).

describe('canApprove alçada — estorno scenario (AUD-02)', () => {
  async function importCanApprove() {
    const p = resolve(process.cwd(), 'src/lib/ai/policy-types.ts')
    if (!existsSync(p)) {
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ p) as any
    return typeof mod.canApprove === 'function' ? mod.canApprove as (role: string, requiredRole: string) => boolean : null
  }

  it('estorno with required_role=admin: receptionist cannot approve (alçada — AUD-02)', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    // Receptionist cannot approve an admin-level estorno
    expect(fn('receptionist', 'admin')).toBe(false)
  })

  it('estorno with required_role=admin: admin can approve', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('admin', 'admin')).toBe(true)
  })

  it('estorno with required_role=admin: dentist cannot approve', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('dentist', 'admin')).toBe(false)
  })
})
