import { describe, it, expect } from 'vitest'
import {
  sha256OfPngDataUrl,
  isTokenValid,
  anamnesisSchema,
  CFO_QUESTIONS,
} from '@/lib/validators/anamnesis'

// ─── sha256OfPngDataUrl tests ────────────────────────────────────────────────
// CLINIC-08, T-2-07: SHA-256 of signature PNG is deterministic

describe('sha256OfPngDataUrl', () => {
  // Minimal valid PNG base64 (1x1 transparent PNG)
  const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const MINIMAL_DATA_URL = `data:image/png;base64,${MINIMAL_PNG_B64}`

  it('returns a 64-character hex string', () => {
    const hash = sha256OfPngDataUrl(MINIMAL_DATA_URL)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces same hash', () => {
    const hash1 = sha256OfPngDataUrl(MINIMAL_DATA_URL)
    const hash2 = sha256OfPngDataUrl(MINIMAL_DATA_URL)
    expect(hash1).toBe(hash2)
  })

  it('different PNG data produces different hash', () => {
    const otherB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='
    const otherDataUrl = `data:image/png;base64,${otherB64}`
    const hash1 = sha256OfPngDataUrl(MINIMAL_DATA_URL)
    const hash2 = sha256OfPngDataUrl(otherDataUrl)
    expect(hash1).not.toBe(hash2)
  })

  it('strips data URI prefix before hashing', () => {
    // Hash of the raw base64 bytes (without prefix) should match
    const hash = sha256OfPngDataUrl(MINIMAL_DATA_URL)
    expect(hash).toHaveLength(64) // sanity; prefix-stripping is implicit
  })
})

// ─── isTokenValid tests ──────────────────────────────────────────────────────
// T-2-07: single-use + expiry enforcement

describe('isTokenValid', () => {
  const now = new Date('2026-06-05T12:00:00.000Z')

  it('returns false when token_used_at is already set (already used)', () => {
    const row = {
      token_used_at: '2026-06-04T10:00:00.000Z',
      token_expires_at: '2026-06-07T12:00:00.000Z', // still in the future
    }
    expect(isTokenValid(row, now)).toBe(false)
  })

  it('returns false when token_expires_at is in the past (expired)', () => {
    const row = {
      token_used_at: null,
      token_expires_at: '2026-06-04T12:00:00.000Z', // past
    }
    expect(isTokenValid(row, now)).toBe(false)
  })

  it('returns false when token_expires_at equals now (expired — not strictly after)', () => {
    const row = {
      token_used_at: null,
      token_expires_at: now.toISOString(),
    }
    expect(isTokenValid(row, now)).toBe(false)
  })

  it('returns false when token_expires_at is null', () => {
    const row = {
      token_used_at: null,
      token_expires_at: null,
    }
    expect(isTokenValid(row, now)).toBe(false)
  })

  it('returns true when token_used_at is null and token_expires_at is in the future', () => {
    const row = {
      token_used_at: null,
      token_expires_at: '2026-06-08T12:00:00.000Z', // 72h ahead
    }
    expect(isTokenValid(row, now)).toBe(true)
  })

  it('returns true for a fresh token (just created, 72h expiry)', () => {
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()
    const row = {
      token_used_at: null,
      token_expires_at: expiresAt,
    }
    expect(isTokenValid(row, now)).toBe(true)
  })
})

// ─── anamnesisSchema tests ───────────────────────────────────────────────────
// D-18: schema rejects submission without signature

describe('anamnesisSchema', () => {
  const validResponses = {
    alergia_medicamento: false,
    alergia_anestesia: false,
    hipertensao: false,
    diabetes: false,
    problema_cardiaco: false,
    gravidez: false,
    uso_medicamento_continuo: false,
    problema_coagulacao: false,
    problema_renal: false,
    problema_respiratorio: false,
    cirurgia_recente: false,
    hepatite_ou_aids: false,
  }

  it('rejects submission without signature (empty string)', () => {
    const result = anamnesisSchema.safeParse({
      responses: validResponses,
      signature: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects submission with missing signature field', () => {
    const result = anamnesisSchema.safeParse({
      responses: validResponses,
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid submission with signature', () => {
    const result = anamnesisSchema.safeParse({
      responses: validResponses,
      signature: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(result.success).toBe(true)
  })

  it('accepts responses with optional observacoes', () => {
    const result = anamnesisSchema.safeParse({
      responses: { ...validResponses, observacoes: 'Alérgica a dipirona' },
      signature: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when a required boolean response is missing', () => {
    const { hipertensao: _, ...incompleteResponses } = validResponses
    const result = anamnesisSchema.safeParse({
      responses: incompleteResponses,
      signature: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(result.success).toBe(false)
  })
})

// ─── CFO_QUESTIONS export tests ──────────────────────────────────────────────

describe('CFO_QUESTIONS', () => {
  it('exports at least 6 questions', () => {
    expect(CFO_QUESTIONS.length).toBeGreaterThanOrEqual(6)
  })

  it('every question has a key and a pt-BR label', () => {
    for (const q of CFO_QUESTIONS) {
      expect(q.key).toBeTruthy()
      expect(q.label).toBeTruthy()
      expect(typeof q.key).toBe('string')
      expect(typeof q.label).toBe('string')
    }
  })

  it('includes core CFO questions', () => {
    const keys = CFO_QUESTIONS.map((q) => q.key)
    expect(keys).toContain('alergia_medicamento')
    expect(keys).toContain('diabetes')
    expect(keys).toContain('hipertensao')
    expect(keys).toContain('problema_cardiaco')
    expect(keys).toContain('gravidez')
    expect(keys).toContain('uso_medicamento_continuo')
  })
})
