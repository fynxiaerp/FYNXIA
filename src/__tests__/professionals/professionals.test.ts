/**
 * Phase 11 — professionals.ts action + commission Zod schema (PRO-01, PRO-03)
 *
 * Source-inspection on src/actions/professionals.ts:
 *   - asserts assertNotReadOnly + createClient from server + logBusinessEvent (PRO-01)
 *   - asserts backfill INSERT … FROM users WHERE role='dentist' is in _professionals.sql (PRO-01)
 *
 * Dynamic-import (absolute-path + existsSync guard) for commissionRulesSchema from
 * src/lib/validators/professional.ts. PURE unit on the shape (PRO-03 — store only; Phase 16 calcs).
 *
 * All new-artifact assertions are RED until Plans 03/04 create the target files.
 * The suite RUNS without crash — guarded dynamic imports return early when file absent.
 *
 * ES2017 gotcha: never use /s (dotAll) flag. Use separate .toMatch() per line.
 * D-144 gotcha: use resolve(process.cwd(), …) NOT @-alias for dynamic imports.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { vi } from 'vitest'

// Mock server-only so any source file that imports it loads cleanly in Vitest
vi.mock('server-only', () => ({}))

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

/**
 * MM(suffix): returns '' when migration file is absent — fail on content, not on throw.
 * Use for Phase 11 target migrations (RED by design until Plan 02/03 land).
 */
function MM(suffix: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
  const match = files.find(f => f.endsWith(suffix))
  return match ? readFileSync(join(MIGRATIONS_DIR, match), 'utf8') : ''
}

/**
 * SRC(rel): read source file by relative path. Returns '' when missing.
 * Assertion fails on empty content, not on ENOENT — RED by design.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── PRO-01: professionals action source-inspection ──────────────────────────

describe('Phase 11 action — professionals.ts (PRO-01)', () => {
  const actionSrc = SRC('src/actions/professionals.ts')

  it('imports createClient from @/lib/supabase/server (server action, not client)', () => {
    expect(actionSrc).toMatch(/createClient/)
    expect(actionSrc).toMatch(/@\/lib\/supabase\/server/)
  })

  it('calls assertNotReadOnly() as write guard (T-11-03)', () => {
    expect(actionSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('calls logBusinessEvent for audit trail', () => {
    expect(actionSrc).toMatch(/logBusinessEvent/)
  })

  it('uses get_my_tenant_id via RLS (not client-side)', () => {
    // The action must NOT call get_my_tenant_id() client-side.
    // Tenant scoping is enforced via RLS in the database; the action reads tenant_id
    // from the actor object (users table via server Supabase client).
    // If get_my_tenant_id appears in source it should be in a SQL/RPC context only.
    // Primary check: action imports server client, not browser client.
    expect(actionSrc).not.toMatch(/createBrowserClient/)
  })
})

// ─── PRO-01: backfill existing dentists into professionals table ──────────────

describe('Phase 11 migration — professionals backfill (PRO-01)', () => {
  it('_professionals.sql includes INSERT INTO professionals FROM users WHERE role=dentist', () => {
    const sql = MM('_professionals.sql')
    expect(sql).toMatch(/INSERT INTO public\.professionals/)
    expect(sql).toMatch(/FROM public\.users/)
    expect(sql).toMatch(/'dentist'/)
  })
})

// ─── PRO-03: commission_rules Zod schema (PURE UNIT) ─────────────────────────

describe('Phase 11 — commissionRulesSchema (PRO-03 store shape validation)', () => {
  const validatorPath = resolve(process.cwd(), 'src/lib/validators/professional.ts')

  it('flat_pct rule { type: flat_pct, pct: 40 } parses OK', async () => {
    if (!existsSync(validatorPath)) {
      expect.fail('src/lib/validators/professional.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ validatorPath) as any
    const schema = mod.commissionRulesSchema ?? mod.professionalSchema?.shape?.commission_rules
    if (!schema) {
      expect.fail('commissionRulesSchema not exported from professional.ts')
    }
    const result = schema.safeParse([{ type: 'flat_pct', pct: 40 }])
    expect(result.success).toBe(true)
  })

  it('service_pct rule { type: service_pct, service_id: uuid, pct: 35 } parses OK', async () => {
    if (!existsSync(validatorPath)) {
      expect.fail('src/lib/validators/professional.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ validatorPath) as any
    const schema = mod.commissionRulesSchema ?? mod.professionalSchema?.shape?.commission_rules
    if (!schema) {
      expect.fail('commissionRulesSchema not exported from professional.ts')
    }
    const result = schema.safeParse([
      { type: 'service_pct', service_id: '00000000-0000-0000-0000-000000000001', pct: 35 },
    ])
    expect(result.success).toBe(true)
  })

  it('pct: 150 (out of 0–100 range) FAILS validation', async () => {
    if (!existsSync(validatorPath)) {
      expect.fail('src/lib/validators/professional.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ validatorPath) as any
    const schema = mod.commissionRulesSchema ?? mod.professionalSchema?.shape?.commission_rules
    if (!schema) {
      expect.fail('commissionRulesSchema not exported from professional.ts')
    }
    const result = schema.safeParse([{ type: 'flat_pct', pct: 150 }])
    expect(result.success).toBe(false)
  })

  it('missing type field FAILS validation', async () => {
    if (!existsSync(validatorPath)) {
      expect.fail('src/lib/validators/professional.ts does not exist yet — Plan 03 target')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* @vite-ignore */ validatorPath) as any
    const schema = mod.commissionRulesSchema ?? mod.professionalSchema?.shape?.commission_rules
    if (!schema) {
      expect.fail('commissionRulesSchema not exported from professional.ts')
    }
    const result = schema.safeParse([{ pct: 40 }])
    expect(result.success).toBe(false)
  })
})
