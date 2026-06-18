/**
 * Phase 12 — teleconsultations.test.ts (TEL-01/TEL-02 source-inspection scaffold)
 *
 * Source-inspection on:
 *   - src/actions/teleconsultations.ts (createTeleconsultation, startTeleconsultation,
 *     endTeleconsultation, createSoapRecord)
 *   - src/lib/validators/teleconsultation.ts (Zod schemas: teleconsultationSchema + soapSchema)
 *
 * New-artifact assertions are RED by design (Wave 0):
 *   - SRC() returns '' when file absent → assertions fail on content, NOT on crash.
 *
 * ES2017 tsconfig: NO /s (dotAll) flag — use separate .toMatch() calls.
 * D-144/D-168: dynamic import via resolve(process.cwd(), ...) not @-alias for validators.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 01 (Wave 0 RED scaffold)
 * Requirements: TEL-01, TEL-02
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'

// Mock server-only so source files importing it load cleanly in Vitest
vi.mock('server-only', () => ({}))

/**
 * SRC(rel): read source file by relative path. Returns '' when missing.
 * Assertion fails on empty content — RED by design, not a crash.
 */
function SRC(rel: string): string {
  const p = resolve(process.cwd(), rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

// ─── TEL-01/TEL-02: src/actions/teleconsultations.ts source-inspection ───────

describe('Phase 12 action — teleconsultations.ts (TEL-01/TEL-02)', () => {
  const actionSrc = SRC('src/actions/teleconsultations.ts')

  // Security: server action fundamentals
  it('imports createClient from @/lib/supabase/server (server action, not client)', () => {
    expect(actionSrc).toMatch(/createClient/)
    expect(actionSrc).toMatch(/@\/lib\/supabase\/server/)
  })

  it('calls assertNotReadOnly() as write guard', () => {
    expect(actionSrc).toMatch(/assertNotReadOnly\(\)/)
  })

  it('calls logBusinessEvent for audit trail', () => {
    expect(actionSrc).toMatch(/logBusinessEvent/)
  })

  it('has role gate referencing dentist', () => {
    expect(actionSrc).toMatch(/dentist/)
  })

  it('references clinic_id for tenant scoping', () => {
    expect(actionSrc).toMatch(/clinic_id/)
  })

  // TEL-01: createTeleconsultation
  it('exports createTeleconsultation as async function (TEL-01)', () => {
    expect(actionSrc).toMatch(/export async function createTeleconsultation/)
  })

  it('createTeleconsultation references external_link (D-03: video = external link)', () => {
    expect(actionSrc).toMatch(/external_link/)
  })

  it('createTeleconsultation references consent_given (CFO consent — TEL-01)', () => {
    expect(actionSrc).toMatch(/consent_given/)
  })

  it('createTeleconsultation references consent_given_at (timestamp — TEL-01)', () => {
    expect(actionSrc).toMatch(/consent_given_at/)
  })

  it('records consent_ip server-side (not from client input — T-12-04 forgery mitigation)', () => {
    expect(actionSrc).toMatch(/consent_ip/)
  })

  it('reads IP from headers server-side (not from client-provided parameter — T-12-04)', () => {
    // IP must be extracted from server-side headers (x-forwarded-for or headers() API)
    // NOT passed as a client input parameter.
    expect(actionSrc).toMatch(/x-forwarded-for|headers\(\)/)
  })

  // TEL-01: session lifecycle
  it('exports startTeleconsultation as async function (TEL-01)', () => {
    expect(actionSrc).toMatch(/export async function startTeleconsultation/)
  })

  it('exports endTeleconsultation as async function (TEL-01)', () => {
    expect(actionSrc).toMatch(/export async function endTeleconsultation/)
  })

  it('references started_at timestamp (session start time — TEL-01)', () => {
    expect(actionSrc).toMatch(/started_at/)
  })

  it('references ended_at timestamp (session end time — TEL-01)', () => {
    expect(actionSrc).toMatch(/ended_at/)
  })

  it('references status field (session state transitions — TEL-01)', () => {
    expect(actionSrc).toMatch(/\bstatus\b/)
  })

  // TEL-02: createSoapRecord
  it('exports createSoapRecord as async function (TEL-02)', () => {
    expect(actionSrc).toMatch(/export async function createSoapRecord/)
  })

  it('createSoapRecord references teleconsultation_id (links SOAP to session — TEL-02)', () => {
    expect(actionSrc).toMatch(/teleconsultation_id/)
  })

  it('createSoapRecord references appointment_id (links SOAP to atendimento — TEL-02)', () => {
    expect(actionSrc).toMatch(/appointment_id/)
  })

  it('createSoapRecord references soap_subjective (S — TEL-02)', () => {
    expect(actionSrc).toMatch(/soap_subjective/)
  })

  it('createSoapRecord references soap_objective (O — TEL-02)', () => {
    expect(actionSrc).toMatch(/soap_objective/)
  })

  it('createSoapRecord references soap_assessment (A — TEL-02)', () => {
    expect(actionSrc).toMatch(/soap_assessment/)
  })

  it('createSoapRecord references soap_plan (P — TEL-02)', () => {
    expect(actionSrc).toMatch(/soap_plan/)
  })
})

// ─── TEL-01/TEL-02: src/lib/validators/teleconsultation.ts source-inspection ─

describe('Phase 12 validator — teleconsultation.ts Zod schemas (TEL-01/TEL-02)', () => {
  const validatorSrc = SRC('src/lib/validators/teleconsultation.ts')

  it('exports teleconsultationSchema', () => {
    expect(validatorSrc).toMatch(/teleconsultationSchema/)
  })

  it('exports soapSchema', () => {
    expect(validatorSrc).toMatch(/soapSchema/)
  })

  it('external_link validated as URL (url( call)', () => {
    expect(validatorSrc).toMatch(/url\(/)
  })

  it('schema does NOT use .default( (D-133/D-158 — RHF defaultValues provides defaults)', () => {
    // .default() causes RHF+resolvers v5 type mismatch — forbidden pattern
    expect(validatorSrc).not.toMatch(/\.default\(/)
  })
})
