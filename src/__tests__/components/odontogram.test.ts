/**
 * Odontogram unit tests — validates STATUS_COLORS, FDI_TEETH, mapDentalRecordsToToothStatus
 * Phase 02-03 Plan: CLINIC-06, D-12, D-13
 */
import { describe, it, expect } from 'vitest'
import {
  STATUS_COLORS,
  FDI_TEETH,
  mapDentalRecordsToToothStatus,
  type ToothStatus,
} from '@/components/odontogram/Tooth'

// ─── STATUS_COLORS ─────────────────────────────────────────────────────────────

describe('STATUS_COLORS', () => {
  it('contains exactly 9 statuses (D-13)', () => {
    const keys = Object.keys(STATUS_COLORS)
    expect(keys).toHaveLength(9)
  })

  it('has correct color for higido (#4ade80)', () => {
    expect(STATUS_COLORS.higido).toBe('#4ade80')
  })

  it('has correct color for cariado (#ef4444)', () => {
    expect(STATUS_COLORS.cariado).toBe('#ef4444')
  })

  it('has correct color for extraido (#6b7280)', () => {
    expect(STATUS_COLORS.extraido).toBe('#6b7280')
  })

  it('has correct color for em_tratamento (#f59e0b)', () => {
    expect(STATUS_COLORS.em_tratamento).toBe('#f59e0b')
  })

  it('has correct color for implante (#3b82f6)', () => {
    expect(STATUS_COLORS.implante).toBe('#3b82f6')
  })

  it('has correct color for coroa (#a855f7)', () => {
    expect(STATUS_COLORS.coroa).toBe('#a855f7')
  })

  it('has correct color for selante (#06b6d4)', () => {
    expect(STATUS_COLORS.selante).toBe('#06b6d4')
  })

  it('has correct color for fraturado (#f97316)', () => {
    expect(STATUS_COLORS.fraturado).toBe('#f97316')
  })

  it('has correct color for restaurado (#84cc16)', () => {
    expect(STATUS_COLORS.restaurado).toBe('#84cc16')
  })
})

// ─── FDI_TEETH ─────────────────────────────────────────────────────────────────

describe('FDI_TEETH', () => {
  it('contains exactly 32 teeth', () => {
    expect(FDI_TEETH).toHaveLength(32)
  })

  it('contains all upper-right teeth (11-18)', () => {
    for (let i = 11; i <= 18; i++) {
      expect(FDI_TEETH).toContain(i)
    }
  })

  it('contains all upper-left teeth (21-28)', () => {
    for (let i = 21; i <= 28; i++) {
      expect(FDI_TEETH).toContain(i)
    }
  })

  it('contains all lower-left teeth (31-38)', () => {
    for (let i = 31; i <= 38; i++) {
      expect(FDI_TEETH).toContain(i)
    }
  })

  it('contains all lower-right teeth (41-48)', () => {
    for (let i = 41; i <= 48; i++) {
      expect(FDI_TEETH).toContain(i)
    }
  })

  it('contains no teeth outside valid FDI ranges', () => {
    for (const tooth of FDI_TEETH) {
      const inRange =
        (tooth >= 11 && tooth <= 18) ||
        (tooth >= 21 && tooth <= 28) ||
        (tooth >= 31 && tooth <= 38) ||
        (tooth >= 41 && tooth <= 48)
      expect(inRange).toBe(true)
    }
  })

  it('has no duplicate tooth numbers', () => {
    const unique = new Set(FDI_TEETH)
    expect(unique.size).toBe(FDI_TEETH.length)
  })
})

// ─── mapDentalRecordsToToothStatus ─────────────────────────────────────────────

describe('mapDentalRecordsToToothStatus', () => {
  it('returns higido as default for tooth with no records', () => {
    const result = mapDentalRecordsToToothStatus([])
    expect(result[11]).toBe('higido')
    expect(result[48]).toBe('higido')
  })

  it('returns the status of the single record for a tooth', () => {
    const records = [
      {
        id: 'rec-1',
        tooth_number: 15,
        status: 'cariado' as ToothStatus,
        created_at: '2026-06-01T10:00:00Z',
      },
    ]
    const result = mapDentalRecordsToToothStatus(records)
    expect(result[15]).toBe('cariado')
  })

  it('returns the most recent status when multiple records exist for the same tooth', () => {
    const records = [
      {
        id: 'rec-1',
        tooth_number: 21,
        status: 'cariado' as ToothStatus,
        created_at: '2026-01-01T10:00:00Z',
      },
      {
        id: 'rec-2',
        tooth_number: 21,
        status: 'restaurado' as ToothStatus,
        created_at: '2026-06-01T10:00:00Z', // more recent
      },
    ]
    const result = mapDentalRecordsToToothStatus(records)
    expect(result[21]).toBe('restaurado')
  })

  it('returns higido for teeth with no records while returning correct status for teeth with records', () => {
    const records = [
      {
        id: 'rec-1',
        tooth_number: 36,
        status: 'extraido' as ToothStatus,
        created_at: '2026-06-01T10:00:00Z',
      },
    ]
    const result = mapDentalRecordsToToothStatus(records)
    // tooth with record
    expect(result[36]).toBe('extraido')
    // tooth without record should default to higido
    expect(result[11]).toBe('higido')
  })

  it('handles records for multiple different teeth', () => {
    const records = [
      {
        id: 'rec-1',
        tooth_number: 14,
        status: 'implante' as ToothStatus,
        created_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'rec-2',
        tooth_number: 24,
        status: 'coroa' as ToothStatus,
        created_at: '2026-06-01T10:00:00Z',
      },
    ]
    const result = mapDentalRecordsToToothStatus(records)
    expect(result[14]).toBe('implante')
    expect(result[24]).toBe('coroa')
    expect(result[11]).toBe('higido')
  })
})
