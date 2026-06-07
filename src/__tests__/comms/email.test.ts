/**
 * Phase 4 — AppointmentReminderEmail template tests (COMMS-02)
 * Test type: source-inspection of src/emails/AppointmentReminderEmail.tsx (Plan 03)
 *
 * RED until Plan 03 creates AppointmentReminderEmail.tsx.
 *
 * NOTE: Full React render (renderToStaticMarkup) would require JSX transform and
 * react-dom in the Vitest node environment. Since the project uses source-inspection
 * for component testing (see recibo.test.ts pattern), we assert that the template
 * file references all required props and Brazilian Portuguese copy — the same contract
 * a render test would verify. Plan 03 implementers may upgrade to a render test if
 * they add @vitejs/plugin-react to vitest.config.ts.
 *
 * COMMS-02: AppointmentReminderEmail renders appointment details (patientName,
 * clinicName, appointmentDate, appointmentTime, dentistName).
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const EMAIL_PATH = resolve(process.cwd(), 'src/emails/AppointmentReminderEmail.tsx')

describe('AppointmentReminderEmail template — src/emails/AppointmentReminderEmail.tsx (COMMS-02)', () => {
  it('file exists (fails RED until Plan 03)', () => {
    expect(existsSync(EMAIL_PATH)).toBe(true)
  })

  it('exports AppointmentReminderEmail component (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/export.*AppointmentReminderEmail|export function AppointmentReminderEmail|export const AppointmentReminderEmail/)
  })

  it('accepts patientName prop (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/patientName/)
  })

  it('accepts clinicName prop (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/clinicName/)
  })

  it('accepts appointmentDate prop (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/appointmentDate/)
  })

  it('accepts appointmentTime prop (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/appointmentTime/)
  })

  it('accepts dentistName prop (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/dentistName/)
  })

  it('uses @react-email/components (COMMS-02 — mirrors CollectionReminderEmail pattern)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    expect(src).toMatch(/@react-email\/components/)
  })

  it('includes Brazilian Portuguese copy for reminder context (COMMS-02)', () => {
    if (!existsSync(EMAIL_PATH)) {
      expect(existsSync(EMAIL_PATH)).toBe(true)
      return
    }
    const src = readFileSync(EMAIL_PATH, 'utf8')
    // Must have pt-BR language attribute or Portuguese content
    expect(src).toMatch(/pt-BR|consulta|lembrete|Lembrete/i)
  })
})
