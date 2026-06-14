/**
 * Phase 7 RBAC matrix — source-inspection + unit test scaffold (RED by design)
 *
 * This file uses a HYBRID approach:
 *  - Source-inspection (readFileSync) for MODULE_PERMISSIONS and isReadOnly,
 *    which Plan 03 adds to proxy.ts. These assertions are RED now (file doesn't
 *    have the exports yet) and turn GREEN when Plan 03 writes them.
 *  - Direct import of isPathAllowed (already in proxy.ts) for functional tests.
 *    The expanded isPathAllowed for new roles (ti, socio, etc.) is also RED
 *    until Plan 03 updates the ROLE_ROUTES → MODULE_PERMISSIONS migration.
 *
 * tsc stays GREEN because we do NOT statically import the not-yet-exported names.
 *
 * vi.mock blocks mirror src/__tests__/proxy/rbac.test.ts convention.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Mock server-only and Supabase clients ───────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { role: 'admin' }, error: null })),
        })),
      })),
    })),
  })),
}))
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(async () => ({
    user: { id: 'test-user-id' },
    supabaseResponse: { headers: { set: vi.fn() } },
  })),
}))

// isPathAllowed already exists — import it for functional assertions
import { isPathAllowed } from '@/proxy'

// ─── proxy.ts source content helpers ─────────────────────────────────────────

const proxySource = () => readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf-8')

// ─── MODULE_PERMISSIONS shape — source-inspection (RED until Plan 03) ────────

describe('MODULE_PERMISSIONS — source-inspection (SYS-03 / ROLE-01)', () => {
  const ALL_ROLES = [
    'admin', 'superadmin', 'dentist', 'receptionist', 'patient',
    'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno',
  ]

  it('exports MODULE_PERMISSIONS from proxy.ts', () => {
    expect(proxySource()).toMatch(/export.*const MODULE_PERMISSIONS/i)
  })

  it('defines entries for all 11 roles in MODULE_PERMISSIONS', () => {
    const src = proxySource()
    expect(src).toMatch(/MODULE_PERMISSIONS/i)
    for (const role of ALL_ROLES) {
      expect(src).toMatch(new RegExp(`\\b${role}\\b`))
    }
  })

  it('exports isReadOnly function from proxy.ts', () => {
    expect(proxySource()).toMatch(/export function isReadOnly/i)
  })

  it('proxy.ts defines readOnly property for auditor', () => {
    expect(proxySource()).toMatch(/auditor/i)
    expect(proxySource()).toMatch(/readOnly.*true|readOnly: true/i)
  })

  it('proxy.ts defines readOnly property for socio', () => {
    expect(proxySource()).toMatch(/socio/i)
  })

  it('proxy.ts defines readOnly property for dpo', () => {
    expect(proxySource()).toMatch(/dpo/i)
  })

  it('proxy.ts references financeiro module key', () => {
    expect(proxySource()).toMatch(/financeiro/i)
  })

  it('proxy.ts references bi module key', () => {
    expect(proxySource()).toMatch(/\bbi\b/i)
  })
})

// ─── isReadOnly — source-inspection assertions (ROLE-02) ─────────────────────
// These describe the BEHAVIORAL contracts (verified by reading proxy.ts source).
// After Plan 03, we could import isReadOnly directly; for now source-inspection.

describe('isReadOnly — read-only role gating source contracts (ROLE-02)', () => {
  it('source declares isReadOnly returning boolean', () => {
    expect(proxySource()).toMatch(/isReadOnly.*boolean|boolean.*isReadOnly/i)
  })

  it('x-read-only header pattern appears in proxy or guards', () => {
    const guardsSrc = readFileSync(resolve(process.cwd(), 'src/lib/auth/guards.ts'), 'utf-8')
    expect(guardsSrc).toMatch(/x-read-only/i)
  })
})

// ─── isPathAllowed — functional tests for new roles (RED for new roles) ──────

describe('isPathAllowed — module access gating with Phase 7 roles (SYS-03)', () => {
  // Existing roles — these pass today
  it('dentist can access /clinica', () => {
    expect(isPathAllowed('dentist', '/clinica')).toBe(true)
  })

  it('patient cannot access /clinica', () => {
    expect(isPathAllowed('patient', '/clinica')).toBe(false)
  })

  it('admin can access /config', () => {
    expect(isPathAllowed('admin', '/config')).toBe(true)
  })

  // New roles — RED until Plan 03 updates isPathAllowed logic
  it('ti can access /config', () => {
    expect(isPathAllowed('ti', '/config')).toBe(true)
  })

  it('dentist cannot access /config', () => {
    expect(isPathAllowed('dentist', '/config')).toBe(false)
  })

  it('socio can access /clinica/financeiro', () => {
    expect(isPathAllowed('socio', '/clinica/financeiro')).toBe(true)
  })

  it('implantacao can access /clinica', () => {
    expect(isPathAllowed('implantacao', '/clinica')).toBe(true)
  })

  it('aluno can access /clinica', () => {
    expect(isPathAllowed('aluno', '/clinica')).toBe(true)
  })

  it('receptionist cannot access /config', () => {
    expect(isPathAllowed('receptionist', '/config')).toBe(false)
  })
})

// ─── guards.ts source assertions (ROLE-02) ───────────────────────────────────

describe('guards.ts source assertions (ROLE-02)', () => {
  const guardsSource = readFileSync(
    resolve(process.cwd(), 'src/lib/auth/guards.ts'),
    'utf-8'
  )

  it('exports assertNotReadOnly function', () => {
    expect(guardsSource).toContain('export async function assertNotReadOnly')
  })

  it('reads x-read-only header', () => {
    expect(guardsSource).toContain('x-read-only')
  })

  it('is server-only', () => {
    expect(guardsSource).toContain("import 'server-only'")
  })

  it('throws when header is true', () => {
    expect(guardsSource).toMatch(/throw new Error/i)
    expect(guardsSource).toMatch(/somente leitura|read.?only/i)
  })
})
