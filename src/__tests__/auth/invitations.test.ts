/**
 * Invitation flow tests — Task 2, Plan 01-03
 *
 * Tests:
 *   1. createInviteSchema validation (direct mode requires tempPassword)
 *   2. patientSelfRegisterSchema validation
 *   3. Server Actions export assertions (no live DB needed)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// ─── Mock server-only modules before importing validators ───────────────────
vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

vi.mock('@/lib/resend', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ error: null }) },
  },
  FROM_EMAIL: 'FYNXIA <onboarding@resend.dev>',
}))

vi.mock('@/lib/audit', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/emails/InviteEmail', () => ({
  InviteEmail: vi.fn(() => null),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// ─── Import validators ───────────────────────────────────────────────────────
import {
  createInviteSchema,
  patientSelfRegisterSchema,
} from '@/lib/validators/invitation'

// ─── Import Server Actions (to verify exports) ───────────────────────────────
import * as InvitationActions from '@/actions/invitations'

// ─────────────────────────────────────────────────────────────────────────────
// Schema tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createInviteSchema', () => {
  describe('mode=email', () => {
    it('accepts valid email invite without tempPassword', () => {
      const result = createInviteSchema.safeParse({
        email: 'dentist@test.com',
        role: 'dentist',
        mode: 'email',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid email invite with tempPassword (ignored for email mode)', () => {
      const result = createInviteSchema.safeParse({
        email: 'dentist@test.com',
        role: 'dentist',
        mode: 'email',
        tempPassword: 'somepassword123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = createInviteSchema.safeParse({
        email: 'not-an-email',
        role: 'dentist',
        mode: 'email',
      })
      expect(result.success).toBe(false)
      expect(result.error?.errors[0]?.message).toBe('E-mail inválido')
    })

    it('rejects invalid role', () => {
      const result = createInviteSchema.safeParse({
        email: 'user@test.com',
        role: 'superuser',
        mode: 'email',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('mode=direct', () => {
    it('rejects direct mode without tempPassword', () => {
      const result = createInviteSchema.safeParse({
        email: 'receptionist@test.com',
        role: 'receptionist',
        mode: 'direct',
      })
      expect(result.success).toBe(false)
      const pathErr = result.error?.errors.find(
        (e) => e.path.includes('tempPassword')
      )
      expect(pathErr).toBeDefined()
    })

    it('rejects direct mode with tempPassword shorter than 8 chars', () => {
      const result = createInviteSchema.safeParse({
        email: 'receptionist@test.com',
        role: 'receptionist',
        mode: 'direct',
        tempPassword: 'short',
      })
      expect(result.success).toBe(false)
    })

    it('accepts direct mode with valid tempPassword (>= 8 chars)', () => {
      const result = createInviteSchema.safeParse({
        email: 'receptionist@test.com',
        role: 'receptionist',
        mode: 'direct',
        tempPassword: 'ValidPass1',
      })
      expect(result.success).toBe(true)
    })

    it('accepts all valid roles in direct mode', () => {
      const roles = ['admin', 'dentist', 'receptionist', 'patient'] as const
      roles.forEach((role) => {
        const result = createInviteSchema.safeParse({
          email: `${role}@test.com`,
          role,
          mode: 'direct',
          tempPassword: 'ValidPassword123',
        })
        expect(result.success, `role=${role} should be valid`).toBe(true)
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// patientSelfRegisterSchema tests
// ─────────────────────────────────────────────────────────────────────────────

describe('patientSelfRegisterSchema', () => {
  it('accepts valid self-register payload', () => {
    const result = patientSelfRegisterSchema.safeParse({
      clinicSlug: 'clinica-sao-paulo',
      email: 'paciente@test.com',
      fullName: 'João Silva',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty clinicSlug', () => {
    const result = patientSelfRegisterSchema.safeParse({
      clinicSlug: '',
      email: 'paciente@test.com',
      fullName: 'João Silva',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = patientSelfRegisterSchema.safeParse({
      clinicSlug: 'clinica-sp',
      email: 'not-email',
      fullName: 'João Silva',
    })
    expect(result.success).toBe(false)
    expect(result.error?.errors[0]?.message).toBe('E-mail inválido')
  })

  it('rejects fullName shorter than 2 chars', () => {
    const result = patientSelfRegisterSchema.safeParse({
      clinicSlug: 'clinica-sp',
      email: 'p@test.com',
      fullName: 'A',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions export verification
// ─────────────────────────────────────────────────────────────────────────────

describe('invitations.ts exports', () => {
  it('exports createInvitation function', () => {
    expect(typeof InvitationActions.createInvitation).toBe('function')
  })

  it('exports acceptInvitation function', () => {
    expect(typeof InvitationActions.acceptInvitation).toBe('function')
  })

  it('exports revokeInvitation function', () => {
    expect(typeof InvitationActions.revokeInvitation).toBe('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// createInvitation input validation (early return, no live DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('createInvitation — schema validation', () => {
  beforeAll(() => {
    vi.clearAllMocks()
  })

  it('returns error for invalid email input', async () => {
    const result = await InvitationActions.createInvitation({
      email: 'not-an-email',
      role: 'dentist',
      mode: 'email',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns error for direct mode without tempPassword', async () => {
    const result = await InvitationActions.createInvitation({
      email: 'user@test.com',
      role: 'receptionist',
      mode: 'direct',
      // tempPassword intentionally missing
    })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns error when user is not authenticated', async () => {
    // Mock returns null user — should return "Não autenticado"
    const result = await InvitationActions.createInvitation({
      email: 'user@test.com',
      role: 'dentist',
      mode: 'email',
    })
    // Either schema error or auth error — both are success=false
    expect(result.success).toBe(false)
  })
})
