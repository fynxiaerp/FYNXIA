/**
 * Phase 3 — ChargeForm + PixQRDisplay behavioral source-inspection (FIN-04, FIN-05)
 * Test type: source-inspection via readFileSync/toMatch (Phase 2 pattern)
 *
 * Asserts:
 *   1. ChargeForm calls createCharge Server Action (FIN-04/05)
 *   2. ChargeForm uses a Switch for parcelamento toggle (FIN-06)
 *   3. PixQRDisplay renders Asaas base64 QR as inline data URL
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHARGE_FORM_PATH = resolve(
  process.cwd(),
  'src/components/financeiro/ChargeForm.tsx'
)
const PIX_QR_PATH = resolve(
  process.cwd(),
  'src/components/financeiro/PixQRDisplay.tsx'
)

describe('ChargeForm (FIN-04, FIN-05, FIN-06)', () => {
  it('file exists (RED until Task 3 authors ChargeForm)', () => {
    expect(existsSync(CHARGE_FORM_PATH)).toBe(true)
  })

  it('calls createCharge Server Action (FIN-04/05)', () => {
    if (!existsSync(CHARGE_FORM_PATH)) {
      expect(existsSync(CHARGE_FORM_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CHARGE_FORM_PATH, 'utf8')
    expect(src).toMatch(/createCharge\(/)
  })

  it('uses Switch for parcelamento toggle (FIN-06)', () => {
    if (!existsSync(CHARGE_FORM_PATH)) {
      expect(existsSync(CHARGE_FORM_PATH)).toBe(true)
      return
    }
    const src = readFileSync(CHARGE_FORM_PATH, 'utf8')
    expect(src).toMatch(/Switch/)
  })
})

describe('PixQRDisplay (FIN-04)', () => {
  it('file exists', () => {
    expect(existsSync(PIX_QR_PATH)).toBe(true)
  })

  it('renders Asaas base64 QR as inline data URL (data:image/png;base64)', () => {
    if (!existsSync(PIX_QR_PATH)) {
      expect(existsSync(PIX_QR_PATH)).toBe(true)
      return
    }
    const src = readFileSync(PIX_QR_PATH, 'utf8')
    expect(src).toMatch(/data:image\/png;base64/)
  })
})
