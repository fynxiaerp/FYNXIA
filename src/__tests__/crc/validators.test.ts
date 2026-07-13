/**
 * Phase 18 — crc/validators.test.ts
 *
 * Real unit tests (TDD RED→GREEN) for src/lib/validators/crc.ts.
 * Zod v3 schemas (no .default() — D-133) for all CRC Server Action inputs,
 * plus the pure isValidStageTransition state-machine guard.
 *
 * Covers CRC-01 (leads/stage transitions), CRC-03 (campaign segment/channel),
 * CRC-04 (NPS submit), CRC-05 (referral) per 18-CONTEXT.md D-01/D-07/D-14.
 *
 * Phase: 18-crc-marketing / Plan 01
 * Requirements: CRC-01, CRC-03, CRC-04, CRC-05
 */

import { describe, it, expect } from 'vitest'
import {
  LEAD_STAGES,
  leadSchema,
  leadSourceSchema,
  campaignSegmentSchema,
  campaignChannelSchema,
  npsSubmitSchema,
  referralSchema,
  isValidStageTransition,
} from '@/lib/validators/crc'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222'

describe('LEAD_STAGES (D-01)', () => {
  it('is the funnel order novo→contatado→agendado→convertido/perdido', () => {
    expect(LEAD_STAGES).toEqual(['novo', 'contatado', 'agendado', 'convertido', 'perdido'])
  })
})

describe('leadSchema (CRC-01)', () => {
  it('accepts a minimal valid lead', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty full_name', () => {
    const result = leadSchema.safeParse({
      full_name: '',
      source_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid (non-uuid) source_id', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email when provided', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: VALID_UUID,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty-string email (optional field convention)', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: VALID_UUID,
      email: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts referred_by_patient_id when a valid uuid (D-16)', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: VALID_UUID,
      referred_by_patient_id: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects notes longer than 2000 chars', () => {
    const result = leadSchema.safeParse({
      full_name: 'Maria Silva',
      source_id: VALID_UUID,
      notes: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('leadSourceSchema (D-03)', () => {
  it('accepts a valid name', () => {
    expect(leadSourceSchema.safeParse({ name: 'Instagram' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(leadSourceSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects name over 80 chars', () => {
    expect(leadSourceSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false)
  })
})

describe('campaignSegmentSchema (CRC-03, D-07)', () => {
  it('accepts a minimal valid segment (inactiveDays only)', () => {
    const result = campaignSegmentSchema.safeParse({ inactiveDays: 30 })
    expect(result.success).toBe(true)
  })

  it('rejects inactiveDays < 1', () => {
    expect(campaignSegmentSchema.safeParse({ inactiveDays: 0 }).success).toBe(false)
  })

  it('accepts optional filters (lastProcedureServiceId, ageMin/ageMax, unitId)', () => {
    const result = campaignSegmentSchema.safeParse({
      inactiveDays: 60,
      lastProcedureServiceId: VALID_UUID,
      ageMin: 18,
      ageMax: 65,
      unitId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })
})

describe('campaignChannelSchema (CRC-03, D-08)', () => {
  it('accepts whatsapp-only', () => {
    expect(campaignChannelSchema.safeParse({ whatsapp: true, email: false }).success).toBe(true)
  })

  it('accepts email-only', () => {
    expect(campaignChannelSchema.safeParse({ whatsapp: false, email: true }).success).toBe(true)
  })

  it('rejects both channels false (at least one required)', () => {
    expect(campaignChannelSchema.safeParse({ whatsapp: false, email: false }).success).toBe(false)
  })
})

describe('npsSubmitSchema (CRC-04, D-13/D-14)', () => {
  it('accepts a valid score with no comment', () => {
    expect(npsSubmitSchema.safeParse({ score: 8 }).success).toBe(true)
  })

  it('rejects score < 0', () => {
    expect(npsSubmitSchema.safeParse({ score: -1 }).success).toBe(false)
  })

  it('rejects score > 10', () => {
    expect(npsSubmitSchema.safeParse({ score: 11 }).success).toBe(false)
  })

  it('rejects comment over 500 chars', () => {
    const result = npsSubmitSchema.safeParse({ score: 5, comment: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts comment up to 500 chars', () => {
    const result = npsSubmitSchema.safeParse({ score: 5, comment: 'x'.repeat(500) })
    expect(result.success).toBe(true)
  })
})

describe('referralSchema (CRC-05, D-16)', () => {
  it('accepts valid referrer + lead uuids', () => {
    const result = referralSchema.safeParse({
      referrer_patient_id: VALID_UUID,
      lead_id: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid referrer_patient_id', () => {
    const result = referralSchema.safeParse({
      referrer_patient_id: 'not-a-uuid',
      lead_id: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })
})

describe('isValidStageTransition (CRC-01, D-01)', () => {
  it('allows forward transition novo→contatado', () => {
    expect(isValidStageTransition('novo', 'contatado')).toBe(true)
  })

  it('allows forward transition contatado→agendado', () => {
    expect(isValidStageTransition('contatado', 'agendado')).toBe(true)
  })

  it('allows agendado→convertido', () => {
    expect(isValidStageTransition('agendado', 'convertido')).toBe(true)
  })

  it('allows any non-terminal stage to jump straight to perdido', () => {
    expect(isValidStageTransition('novo', 'perdido')).toBe(true)
    expect(isValidStageTransition('contatado', 'perdido')).toBe(true)
    expect(isValidStageTransition('agendado', 'perdido')).toBe(true)
  })

  it('rejects backward transition convertido→novo', () => {
    expect(isValidStageTransition('convertido', 'novo')).toBe(false)
  })

  it('rejects any outbound transition from convertido (terminal)', () => {
    expect(isValidStageTransition('convertido', 'contatado')).toBe(false)
    expect(isValidStageTransition('convertido', 'perdido')).toBe(false)
  })

  it('rejects any outbound transition from perdido (terminal)', () => {
    expect(isValidStageTransition('perdido', 'novo')).toBe(false)
    expect(isValidStageTransition('perdido', 'convertido')).toBe(false)
  })

  it('rejects same-stage transition', () => {
    expect(isValidStageTransition('novo', 'novo')).toBe(false)
    expect(isValidStageTransition('contatado', 'contatado')).toBe(false)
  })

  it('rejects unknown stage values', () => {
    expect(isValidStageTransition('novo', 'bogus')).toBe(false)
    expect(isValidStageTransition('bogus', 'novo')).toBe(false)
  })
})
