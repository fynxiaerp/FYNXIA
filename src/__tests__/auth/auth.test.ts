import { describe, it, expect, vi } from 'vitest'

// Mock server-only modules before importing
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
    })),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('server-only', () => ({}))

// ─── Validator Tests ───────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('rejects invalid email', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 chars', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'short' })
    expect(result.success).toBe(false)
  })

  it('accepts valid email + 8-char password', async () => {
    const { loginSchema } = await import('@/lib/validators/auth')
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'validpass' })
    expect(result.success).toBe(true)
  })
})

describe('signupSchema — CPF/CNPJ document field', () => {
  const validBase = {
    clinicName: 'Clínica Teste',
    email: 'admin@clinica.com',
    password: 'senha1234',
    phone: '(11) 99999-1234',
  }

  it('rejects invalid CPF check-digit (111.111.111-11)', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({ ...validBase, document: '111.111.111-11' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid CNPJ (11.111.111/1111-11)', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({ ...validBase, document: '11.111.111/1111-11' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid CPF in document field', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    // Valid CPF: 529.982.247-25
    const result = signupSchema.safeParse({ ...validBase, document: '529.982.247-25' })
    expect(result.success).toBe(true)
  })

  it('accepts a valid CNPJ in document field', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    // Valid CNPJ: 11.222.333/0001-81
    const result = signupSchema.safeParse({ ...validBase, document: '11.222.333/0001-81' })
    expect(result.success).toBe(true)
  })

  it('rejects missing clinicName', async () => {
    const { signupSchema } = await import('@/lib/validators/auth')
    const result = signupSchema.safeParse({ ...validBase, document: '529.982.247-25', clinicName: 'A' })
    expect(result.success).toBe(false)
  })
})

// ─── Server Actions export check ──────────────────────────────────────────

describe('auth Server Actions — export contract', () => {
  it('signUpClinic is exported and is a function', async () => {
    const actions = await import('@/actions/auth')
    expect(typeof actions.signUpClinic).toBe('function')
  })

  it('signIn is exported and is a function', async () => {
    const actions = await import('@/actions/auth')
    expect(typeof actions.signIn).toBe('function')
  })

  it('signOut is exported and is a function', async () => {
    const actions = await import('@/actions/auth')
    expect(typeof actions.signOut).toBe('function')
  })

  it('sendPasswordReset is exported and is a function', async () => {
    const actions = await import('@/actions/auth')
    expect(typeof actions.sendPasswordReset).toBe('function')
  })
})

// ─── logBusinessEvent signature check ─────────────────────────────────────

describe('logBusinessEvent — tenantId required', () => {
  it('logBusinessEvent is exported and is a function', async () => {
    const { logBusinessEvent } = await import('@/lib/audit')
    expect(typeof logBusinessEvent).toBe('function')
  })

  it('logBusinessEvent returns a promise (async function)', async () => {
    const { logBusinessEvent } = await import('@/lib/audit')
    // Call with required params — mock will handle the DB call
    const result = logBusinessEvent({
      tenantId: 'tenant-uuid',
      actorId: 'actor-uuid',
      action: 'TEST_ACTION',
      details: { key: 'value' },
    })
    expect(result).toBeInstanceOf(Promise)
  })
})
