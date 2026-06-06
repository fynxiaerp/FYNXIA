/**
 * Phase 3 — createCharge action + PaymentGateway tests (FIN-04, FIN-05, FIN-06)
 * Test type: source-inspection via existsSync + readFileSync
 *
 * RED until Plan 02 authors:
 *   - src/actions/charges.ts
 *   - src/lib/asaas/gateway.ts
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHARGES_PATH = resolve(process.cwd(), 'src/actions/charges.ts')
const GATEWAY_PATH = resolve(process.cwd(), 'src/lib/asaas/gateway.ts')

describe('charges Server Action — src/actions/charges.ts (FIN-04, FIN-05)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    expect(existsSync(CHARGES_PATH)).toBe(true)
  })

  it('exports createCharge function', () => {
    if (!existsSync(CHARGES_PATH)) {
      expect(existsSync(CHARGES_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CHARGES_PATH, 'utf8')
    expect(src).toMatch(/export\s+async\s+function\s+createCharge/)
  })

  it('handles PIX QR code retrieval after charge creation (FIN-04)', () => {
    if (!existsSync(CHARGES_PATH)) {
      expect(existsSync(CHARGES_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CHARGES_PATH, 'utf8')
    expect(src).toMatch(/getPixQrCode/)
  })

  it('handles installment charge — creates multiple receivables (FIN-06)', () => {
    if (!existsSync(CHARGES_PATH)) {
      expect(existsSync(CHARGES_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CHARGES_PATH, 'utf8')
    expect(src).toMatch(/installmentCount|getInstallmentCharges/)
  })
})

describe('PaymentGateway abstraction — src/lib/asaas/gateway.ts (D-01)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    expect(existsSync(GATEWAY_PATH)).toBe(true)
  })

  it('exports PaymentGateway interface', () => {
    if (!existsSync(GATEWAY_PATH)) {
      expect(existsSync(GATEWAY_PATH)).toBe(true)
      return
    }
    const src = readFileSync(GATEWAY_PATH, 'utf8')
    expect(src).toMatch(/PaymentGateway/)
  })

  it('exports AsaasAdapter class implementing PaymentGateway', () => {
    if (!existsSync(GATEWAY_PATH)) {
      expect(existsSync(GATEWAY_PATH)).toBe(true)
      return
    }
    const src = readFileSync(GATEWAY_PATH, 'utf8')
    expect(src).toMatch(/AsaasAdapter/)
  })

  it('gateway exposes getPixQrCode method (FIN-04)', () => {
    if (!existsSync(GATEWAY_PATH)) {
      expect(existsSync(GATEWAY_PATH)).toBe(true)
      return
    }
    const src = readFileSync(GATEWAY_PATH, 'utf8')
    expect(src).toMatch(/getPixQrCode/)
  })

  it('gateway exposes getInstallmentCharges method (FIN-06)', () => {
    if (!existsSync(GATEWAY_PATH)) {
      expect(existsSync(GATEWAY_PATH)).toBe(true)
      return
    }
    const src = readFileSync(GATEWAY_PATH, 'utf8')
    expect(src).toMatch(/getInstallmentCharges/)
  })
})
