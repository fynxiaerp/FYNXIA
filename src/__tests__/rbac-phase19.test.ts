import { describe, it, expect, vi } from 'vitest'

// Mock server-only and Supabase server client so proxy.ts can be imported in test env
// (mirrors src/__tests__/proxy/rbac.test.ts)
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

import { isPathAllowed, isReadOnly } from '@/proxy'

// ─── Phase 19 — relatorios/orcamento/societario RBAC (D-09/D-14/D-24) ───────

describe('Phase 19 RBAC — relatorios/orcamento/societario/bi modules', () => {
  it('admin has access to /clinica/relatorios; dentist does not', () => {
    expect(isPathAllowed('admin', '/clinica/relatorios')).toBe(true)
    expect(isPathAllowed('dentist', '/clinica/relatorios')).toBe(false)
  })

  it('socio has WRITE (not readOnly) access to /clinica/orcamento (D-14)', () => {
    expect(isPathAllowed('socio', '/clinica/orcamento')).toBe(true)
    expect(isReadOnly('socio', '/clinica/orcamento')).toBe(false)
  })

  it('socio is readOnly on /clinica/relatorios and /clinica/societario', () => {
    expect(isReadOnly('socio', '/clinica/relatorios')).toBe(true)
    expect(isReadOnly('socio', '/clinica/societario')).toBe(true)
  })

  it('receptionist does NOT have access to /clinica/societario', () => {
    expect(isPathAllowed('receptionist', '/clinica/societario')).toBe(false)
  })

  it('pre-wired /bi module still works for admin', () => {
    expect(isPathAllowed('admin', '/bi')).toBe(true)
  })
})
