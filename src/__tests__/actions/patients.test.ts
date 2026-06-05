/**
 * Patient action tests — Task 0/1, Plan 02-02
 *
 * Tests:
 *   1. encrypt/decrypt roundtrip — AES-256-GCM via src/lib/crypto.ts (D-07)
 *   2. buildAnonymizedPatch — LGPD anonymization values (D-08)
 *   3. patientSchema — CPF format validation (Zod v3)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

// ─── Mock server-only before any imports ────────────────────────────────────
vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

vi.mock('@/lib/audit', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}))

// ─── Set ENCRYPTION_KEY before importing crypto ──────────────────────────────
beforeAll(() => {
  // 64-char hex = 32 bytes (AES-256 key requirement)
  process.env.ENCRYPTION_KEY =
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
})

// ─── Import modules under test ───────────────────────────────────────────────
import { encrypt, decrypt } from '@/lib/crypto'
import { patientSchema } from '@/lib/validators/patient'
import { buildAnonymizedPatch } from '@/lib/patient-anonymize'

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('encrypt/decrypt roundtrip', () => {
  it('decrypts a value to the original plaintext', () => {
    const original = 'histórico médico — asma, rinite'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('each encryption produces a different ciphertext (IV randomness)', () => {
    const val = 'alergias: penicilina'
    expect(encrypt(val)).not.toBe(encrypt(val))
  })

  it('roundtrip with special characters (PT-BR)', () => {
    const original = 'Medicação: ácido acetilsalicílico 100mg/dia; anticoagulantes'
    expect(decrypt(encrypt(original))).toBe(original)
  })
})

describe('buildAnonymizedPatch', () => {
  it('returns exact LGPD anonymization values (D-08)', () => {
    const patch = buildAnonymizedPatch()

    expect(patch.full_name).toBe('Paciente Excluído')
    expect(patch.cpf).toBe('000.000.000-00')
    expect(patch.phone).toBe('(00) 00000-0000')
    expect(patch.email).toBe('anonimizado@excluido.local')
    expect(patch.address).toBeNull()
    expect(patch.medical_history).toBeNull()
    expect(patch.allergies).toBeNull()
    expect(patch.medications).toBeNull()
    expect(patch.is_anonymized).toBe(true)
    expect(typeof patch.deleted_at).toBe('string')
    // deleted_at must be a valid ISO date string
    expect(() => new Date(patch.deleted_at)).not.toThrow()
  })
})

describe('patientSchema validation', () => {
  it('rejects CPF with invalid format', () => {
    const result = patientSchema.safeParse({
      full_name: 'João Silva',
      cpf: '12345678901', // sem pontuação
    })
    expect(result.success).toBe(false)
  })

  it('rejects CPF with partial mask', () => {
    const result = patientSchema.safeParse({
      full_name: 'Maria Souza',
      cpf: '123.456.789.01', // 4 octetos em vez de 3 + 2
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty full_name', () => {
    const result = patientSchema.safeParse({
      full_name: 'A', // menos de 2 caracteres
      cpf: '123.456.789-01',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid CPF and name', () => {
    const result = patientSchema.safeParse({
      full_name: 'Carlos Oliveira',
      cpf: '123.456.789-01',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional health fields', () => {
    const result = patientSchema.safeParse({
      full_name: 'Ana Costa',
      cpf: '987.654.321-00',
      medical_history: 'Hipertensão',
      allergies: 'Dipirona',
      medications: 'Losartana 50mg',
    })
    expect(result.success).toBe(true)
  })
})
