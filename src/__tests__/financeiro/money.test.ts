/**
 * Phase 3 — Money formatting helpers (formatBRL, deriveReceivableStatus)
 * Test type: unit — pure functions, no server dependencies
 *
 * Requirement: FIN-01 (BRL formatting), D-04 (vencido derived client-side)
 */

import { describe, it, expect } from 'vitest'
import { formatBRL, deriveReceivableStatus } from '@/lib/format/money'

describe('formatBRL', () => {
  it('formats 1234.56 as R$ 1.234,56', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
  })

  it('formats 0 as R$ 0,00 (never blank)', () => {
    const result = formatBRL(0)
    expect(result).toMatch(/0,00/)
  })

  it('formats large value correctly', () => {
    const result = formatBRL(8500)
    expect(result).toMatch(/8\.500,00/)
  })
})

describe('deriveReceivableStatus (D-04)', () => {
  it('returns vencido for pendente with past due date', () => {
    const pastDate = '2020-01-01'
    expect(deriveReceivableStatus('pendente', pastDate)).toBe('vencido')
  })

  it('returns pago regardless of due date', () => {
    const pastDate = '2020-01-01'
    expect(deriveReceivableStatus('pago', pastDate)).toBe('pago')
  })

  it('returns pendente for pendente with future due date', () => {
    const futureDate = '2099-12-31'
    expect(deriveReceivableStatus('pendente', futureDate)).toBe('pendente')
  })

  it('returns estornado regardless of due date', () => {
    const pastDate = '2020-01-01'
    expect(deriveReceivableStatus('estornado', pastDate)).toBe('estornado')
  })
})
