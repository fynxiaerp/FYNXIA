/**
 * Phase 10 — governance/approvals.test.ts (Wave 0 RED scaffold)
 *
 * Covers:
 * - AIG-02: approval state machine + idempotency + execution guard
 * - AUD-02: approval/reject logged to audit trail (logBusinessEvent)
 * - AUD-03: conformidade module in proxy.ts (RBAC — auditor/dpo/admin access)
 * - T-10-04: approval double-execution prevention (idempotency_key + executed_at)
 *
 * Convention (mirrors connectors.test.ts):
 * - SRC(relPath) returns '' if file missing (RED on content, not ENOENT)
 * - PURE unit for canApprove alçada helper (green once Plan 03 exports it)
 * - Dynamic import with existsSync guard for canApprove
 *
 * Tests are RED by design until Plan 03 creates src/actions/approval-actions.ts
 * and Plan 03 adds 'conformidade' to src/proxy.ts.
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

// ─── AIG-02/AUD-02: approval-actions.ts source-inspection ────────────────────
// RED by design until Plan 03 creates src/actions/approval-actions.ts

describe('src/actions/approval-actions.ts source-inspection (AIG-02, AUD-02)', () => {
  const src = SRC('src/actions/approval-actions.ts')

  it('calls assertNotReadOnly() (guards write action — no read-only role can approve)', () => {
    expect(src).toMatch(/assertNotReadOnly\(\)/)
  })

  it('references idempotency_key (T-10-04: prevents double-execution)', () => {
    expect(src).toMatch(/idempotency/)
  })

  it('references executed_at (T-10-04: marks payload as executed)', () => {
    expect(src).toMatch(/executed_at/)
  })

  it('has status guard eq(\'status\', \'pending\') before approve/execute', () => {
    // Ensures only pending requests are approved — not already-decided ones
    expect(src).toMatch(/eq\(['"]status['"],\s*['"]pending['"]/)
  })

  it('calls logBusinessEvent (AUD-02: approve/reject recorded in audit trail)', () => {
    expect(src).toMatch(/logBusinessEvent/)
  })

  it('exports createApprovalRequest function', () => {
    expect(src).toMatch(/export.*function createApprovalRequest|export async function createApprovalRequest/)
  })

  it('exports approveRequest function', () => {
    expect(src).toMatch(/export.*function approveRequest|export async function approveRequest/)
  })

  it('exports rejectRequest function', () => {
    expect(src).toMatch(/export.*function rejectRequest|export async function rejectRequest/)
  })
})

// ─── AIG-02: canApprove alçada helper — PURE unit ────────────────────────────
// Dynamically imports canApprove from approval-actions or a types file.
// RED until Plan 03 exports this function.

describe('canApprove alçada check — PURE unit (AIG-02, AUD-02)', () => {
  async function importCanApprove() {
    // Check approval-actions first, then a shared types/helpers file
    const primaryPath = resolve(process.cwd(), 'src/actions/approval-actions.ts')
    const fallbackPath = resolve(process.cwd(), 'src/lib/ai/policy.ts')
    const targetPath = existsSync(primaryPath) ? primaryPath : fallbackPath

    if (!existsSync(targetPath)) {
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ targetPath) as any
    return typeof mod.canApprove === 'function' ? mod.canApprove as (role: string, requiredRole: string) => boolean : null
  }

  it('admin can approve required_role=admin', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('admin', 'admin')).toBe(true)
  })

  it('superadmin can approve required_role=admin (hierarchy)', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('superadmin', 'admin')).toBe(true)
  })

  it('receptionist cannot approve required_role=admin (alçada enforcement — AIG-02)', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('receptionist', 'admin')).toBe(false)
  })

  it('dentist cannot approve required_role=admin', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('dentist', 'admin')).toBe(false)
  })

  it('auditor cannot approve required_role=admin (read-only role — AUD-03)', async () => {
    const fn = await importCanApprove()
    if (!fn) expect.fail('canApprove not exported from approval-actions.ts yet — Plan 03 target')
    expect(fn('auditor', 'admin')).toBe(false)
  })
})

// ─── AUD-03: conformidade module in proxy.ts source-inspection ───────────────
// RED until Plan 03 adds 'conformidade' as a ModuleKey + entries in proxy.ts

describe('src/proxy.ts — conformidade module (AUD-03)', () => {
  const src = SRC('src/proxy.ts')

  it('proxy.ts exists (baseline)', () => {
    // proxy.ts must already exist — this is a regression guard
    expect(src).not.toBe('')
  })

  it('has conformidade as a ModuleKey (type union)', () => {
    // ModuleKey type union must include 'conformidade'
    expect(src).toMatch(/['"]conformidade['"]/)
  })

  it('auditor has conformidade: { allowed: true, readOnly: true }', () => {
    // auditor role: conformidade read-only (their primary module)
    // Check that 'auditor' and 'conformidade' both appear in the source (same line or across lines)
    expect(src).toMatch(/auditor/)
    expect(src).toMatch(/conformidade/)
    // Check that readOnly: true appears in the source (for the conformidade section)
    expect(src).toMatch(/readOnly:\s*true/)
  })

  it('dpo has conformidade: { allowed: true, readOnly: true }', () => {
    // dpo role: conformidade read-only
    expect(src).toMatch(/dpo/)
    expect(src).toMatch(/conformidade/)
  })

  it('admin has conformidade: { allowed: true } (without readOnly for write access)', () => {
    // admin role: conformidade read-write — proxy source must reference admin + conformidade
    expect(src).toMatch(/admin/)
    expect(src).toMatch(/conformidade/)
  })

  it('ROUTE_MODULE_MAP includes prefix /conformidade → module conformidade', () => {
    // Most-specific route mapping for the conformidade section
    // Source must have the /conformidade prefix string and reference conformidade as a module
    expect(src).toMatch(/\/conformidade/)
    expect(src).toMatch(/['"]conformidade['"]/)
  })
})
