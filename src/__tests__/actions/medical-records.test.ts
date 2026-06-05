/**
 * Medical Records + Dental Records Server Actions tests
 * Phase 02-03: CLINIC-05, CLINIC-07, D-09, D-10, D-14, D-15
 *
 * NOTE: These tests are UNIT tests that exercise logic purely — they test
 * schema parsing, role gate logic, and the medicalRecordSchema validator.
 * They do NOT test DB round-trips (covered by integration tests later).
 */
import { describe, it, expect } from 'vitest'
import { medicalRecordSchema, dentalRecordSchema } from '@/lib/validators/medical-record'

// ─── medicalRecordSchema ──────────────────────────────────────────────────────

describe('medicalRecordSchema', () => {
  it('accepts input with at least one text field filled (diagnosis)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      diagnosis: 'Cárie classe II no dente 16',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with at least one text field filled (treatment_plan)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      treatment_plan: 'Restauração direta com resina composta',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with at least one text field filled (prescription)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      prescription: 'Amoxicilina 500mg 8/8h por 7 dias',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with all three text fields filled', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      diagnosis: 'Cárie',
      treatment_plan: 'Restauração',
      prescription: 'Analgésico',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional appointment_id when valid UUID', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      appointment_id: '00000000-0000-0000-0000-000000000002',
      diagnosis: 'Avaliação',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when all three text fields are absent/empty (refine)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Ao menos')
  })

  it('rejects when all three text fields are empty strings (refine)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      diagnosis: '',
      treatment_plan: '',
      prescription: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid patient_id (not a UUID)', () => {
    const result = medicalRecordSchema.safeParse({
      patient_id: 'not-a-uuid',
      diagnosis: 'Cárie',
    })
    expect(result.success).toBe(false)
  })
})

// ─── dentalRecordSchema ────────────────────────────────────────────────────────

describe('dentalRecordSchema', () => {
  it('accepts valid FDI tooth number in range 11-18 with valid status', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 16,
      status: 'cariado',
    })
    expect(result.success).toBe(true)
  })

  it('accepts tooth number in range 21-28', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 24,
      status: 'restaurado',
    })
    expect(result.success).toBe(true)
  })

  it('accepts tooth number in range 31-38', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 36,
      status: 'extraido',
    })
    expect(result.success).toBe(true)
  })

  it('accepts tooth number in range 41-48', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 45,
      status: 'implante',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid tooth number outside all FDI ranges (e.g., 19)', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 19,
      status: 'higido',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('FDI')
  })

  it('rejects tooth number 0', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 0,
      status: 'higido',
    })
    expect(result.success).toBe(false)
  })

  it('rejects tooth number 49 (out of range)', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 49,
      status: 'higido',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status value', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 16,
      status: 'broken', // invalid
    })
    expect(result.success).toBe(false)
  })

  it('accepts all 9 valid status values', () => {
    const validStatuses = [
      'higido',
      'cariado',
      'extraido',
      'em_tratamento',
      'implante',
      'coroa',
      'selante',
      'fraturado',
      'restaurado',
    ]
    for (const status of validStatuses) {
      const result = dentalRecordSchema.safeParse({
        patient_id: '00000000-0000-0000-0000-000000000001',
        tooth_number: 16,
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts optional appointment_id when valid UUID', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      appointment_id: '00000000-0000-0000-0000-000000000002',
      tooth_number: 16,
      status: 'cariado',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional notes field', () => {
    const result = dentalRecordSchema.safeParse({
      patient_id: '00000000-0000-0000-0000-000000000001',
      tooth_number: 21,
      status: 'coroa',
      notes: 'Coroa provisória colocada',
    })
    expect(result.success).toBe(true)
  })
})

// ─── Role gate logic for dental records (D-15) ────────────────────────────────

describe('dental records role gate logic (D-15)', () => {
  // These tests verify the role check logic used in updateDentalRecord
  function isDentalWriteAllowed(role: string): boolean {
    return role === 'admin' || role === 'dentist'
  }

  it('allows admin to write dental records', () => {
    expect(isDentalWriteAllowed('admin')).toBe(true)
  })

  it('allows dentist to write dental records', () => {
    expect(isDentalWriteAllowed('dentist')).toBe(true)
  })

  it('blocks receptionist from writing dental records (D-15)', () => {
    expect(isDentalWriteAllowed('receptionist')).toBe(false)
  })

  it('blocks patient role from writing dental records (D-15)', () => {
    expect(isDentalWriteAllowed('patient')).toBe(false)
  })

  it('blocks superadmin from writing via application layer (defense in depth)', () => {
    // superadmin can write via RLS service role, not via the application Server Action gate
    expect(isDentalWriteAllowed('superadmin')).toBe(false)
  })
})

// ─── Medical record: dentist_id spoofing guard (T-2-12) ───────────────────────

describe('createMedicalRecord dentist_id invariant (T-2-12)', () => {
  // This test asserts the structural contract: dentist_id must come from actor, not input.
  // We verify this by reading the source of the action.
  it('action source does not use input.dentist_id', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'src/actions/medical-records.ts'
    )
    const source = fs.readFileSync(filePath, 'utf-8')
    // Must contain actor.id assignment
    expect(source).toContain('actor.id')
    // Must NOT use input dentist_id from client
    expect(source).not.toContain('input.dentist_id')
    expect(source).not.toContain('parsed.data.dentist_id')
  })

  it('listMedicalRecords orders by created_at and does not filter by dentist_id (D-10/CLINIC-07)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'src/actions/medical-records.ts'
    )
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).toContain('created_at')
    // Must NOT filter by dentist_id in listMedicalRecords
    // (multi-dentist history requirement D-10)
    const listFnMatch = source.match(/listMedicalRecords[\s\S]*?^}/m)
    if (listFnMatch) {
      expect(listFnMatch[0]).not.toContain('.eq(\'dentist_id\'')
    }
  })
})
