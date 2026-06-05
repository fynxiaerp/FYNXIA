import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock server-only and Supabase server client so proxy.ts can be imported in test env
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

import { ROLE_ROUTES, isPathAllowed } from '@/proxy'

// ─── ROLE_ROUTES matrix tests (D-07) ─────────────────────────────────────────

describe('ROLE_ROUTES matrix', () => {
  it('receptionist does NOT have access to /superadmin', () => {
    expect(ROLE_ROUTES['receptionist']).not.toContain('/superadmin')
  })

  it('receptionist does NOT have access to /config', () => {
    expect(ROLE_ROUTES['receptionist']).not.toContain('/config')
  })

  it('patient only has access to /paciente and /perfil', () => {
    const patientRoutes = ROLE_ROUTES['patient']
    expect(patientRoutes).toEqual(['/paciente', '/perfil'])
  })

  it('admin has access to /superadmin', () => {
    expect(ROLE_ROUTES['admin']).toContain('/superadmin')
  })

  it('superadmin has access to all route prefixes', () => {
    const superadminRoutes = ROLE_ROUTES['superadmin']
    expect(superadminRoutes).toContain('/clinica')
    expect(superadminRoutes).toContain('/perfil')
    expect(superadminRoutes).toContain('/config')
    expect(superadminRoutes).toContain('/superadmin')
    expect(superadminRoutes).toContain('/paciente')
  })

  it('dentist has access to /clinica and /perfil', () => {
    expect(ROLE_ROUTES['dentist']).toContain('/clinica')
    expect(ROLE_ROUTES['dentist']).toContain('/perfil')
  })

  it('dentist does NOT have access to /superadmin', () => {
    expect(ROLE_ROUTES['dentist']).not.toContain('/superadmin')
  })
})

// ─── isPathAllowed helper tests ──────────────────────────────────────────────

describe('isPathAllowed', () => {
  it('returns false for receptionist → /superadmin', () => {
    expect(isPathAllowed('receptionist', '/superadmin')).toBe(false)
  })

  it('returns false for receptionist → /superadmin/settings', () => {
    expect(isPathAllowed('receptionist', '/superadmin/settings')).toBe(false)
  })

  it('returns true for admin → /superadmin', () => {
    expect(isPathAllowed('admin', '/superadmin')).toBe(true)
  })

  it('returns true for admin → /clinica', () => {
    expect(isPathAllowed('admin', '/clinica')).toBe(true)
  })

  it('returns false for patient → /clinica', () => {
    expect(isPathAllowed('patient', '/clinica')).toBe(false)
  })

  it('returns true for patient → /paciente', () => {
    expect(isPathAllowed('patient', '/paciente')).toBe(true)
  })

  it('returns true for dentist → /clinica/agenda', () => {
    expect(isPathAllowed('dentist', '/clinica/agenda')).toBe(true)
  })

  it('returns false for receptionist → /config', () => {
    expect(isPathAllowed('receptionist', '/config')).toBe(false)
  })

  it('returns true for superadmin → /paciente', () => {
    expect(isPathAllowed('superadmin', '/paciente')).toBe(true)
  })

  it('unknown role defaults to patient-level access (only /paciente)', () => {
    expect(isPathAllowed('unknown_role', '/clinica')).toBe(false)
    expect(isPathAllowed('unknown_role', '/paciente')).toBe(true)
  })
})

// ─── proxy.ts content assertions (grep-style) ────────────────────────────────

describe('proxy.ts source content assertions', () => {
  const proxySource = readFileSync(
    resolve(process.cwd(), 'src/proxy.ts'),
    'utf-8'
  )

  it('does NOT contain getSession', () => {
    expect(proxySource).not.toContain('getSession')
  })

  it('contains ROLE_ROUTES', () => {
    expect(proxySource).toContain('ROLE_ROUTES')
  })

  it('queries users table for role (select role)', () => {
    expect(proxySource).toContain(".select('role')")
  })

  it('sets x-user-role request header', () => {
    expect(proxySource).toContain('x-user-role')
  })

  it('marks /invite as public route (Pitfall 5)', () => {
    expect(proxySource).toContain('/invite')
  })

  it('marks /agendar as public route (Pitfall 5)', () => {
    expect(proxySource).toContain('/agendar')
  })

  it('marks /auth/confirm as public route (Pitfall 5)', () => {
    expect(proxySource).toContain('/auth/confirm')
  })
})
