/**
 * Agenda calendar tests — Task 0, Plan 02-02
 *
 * Tests:
 *   1. mapAppointmentToEvent — correct field mapping
 *   2. filterEventsByDentist — returns only events for the given dentist (Pitfall 3)
 */

import { describe, it, expect } from 'vitest'
import {
  mapAppointmentToEvent,
  filterEventsByDentist,
  type CalendarEvent,
} from '@/lib/validators/appointment'

// ─── Test fixtures ───────────────────────────────────────────────────────────

const DENTIST_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const DENTIST_B = 'bbbbbbbb-0000-0000-0000-000000000002'

const appointmentA = {
  id: 'appt-0001',
  start_time: '2026-06-10T09:00:00Z',
  end_time: '2026-06-10T10:00:00Z',
  dentist_id: DENTIST_A,
  status: 'agendado',
  notes: 'Limpeza',
  patient: { full_name: 'João Silva' },
}

const appointmentB = {
  id: 'appt-0002',
  start_time: '2026-06-10T14:00:00Z',
  end_time: '2026-06-10T15:00:00Z',
  dentist_id: DENTIST_B,
  status: 'confirmado',
  notes: null,
  patient: { full_name: 'Maria Souza' },
}

const appointmentNoPatient = {
  id: 'appt-0003',
  start_time: '2026-06-10T11:00:00Z',
  end_time: '2026-06-10T11:30:00Z',
  dentist_id: DENTIST_A,
  status: 'agendado',
  notes: null,
  patient: null,
}

// ─── mapAppointmentToEvent ────────────────────────────────────────────────────

describe('mapAppointmentToEvent', () => {
  it('maps id correctly', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.id).toBe('appt-0001')
  })

  it('maps start time correctly', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.start).toBe('2026-06-10T09:00:00Z')
  })

  it('maps end time correctly', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.end).toBe('2026-06-10T10:00:00Z')
  })

  it('maps dentistId correctly', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.dentistId).toBe(DENTIST_A)
  })

  it('maps status correctly', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.status).toBe('agendado')
  })

  it('uses patient name as title when patient is present', () => {
    const event = mapAppointmentToEvent(appointmentA)
    expect(event.title).toBe('João Silva')
    expect(event.patientName).toBe('João Silva')
  })

  it('uses fallback title when patient is null', () => {
    const event = mapAppointmentToEvent(appointmentNoPatient)
    expect(event.title).toBe('Paciente não informado')
  })
})

// ─── filterEventsByDentist ────────────────────────────────────────────────────

describe('filterEventsByDentist', () => {
  const events: CalendarEvent[] = [
    mapAppointmentToEvent(appointmentA),
    mapAppointmentToEvent(appointmentB),
    mapAppointmentToEvent(appointmentNoPatient),
  ]

  it('returns only events for dentist A', () => {
    const filtered = filterEventsByDentist(events, DENTIST_A)
    expect(filtered.length).toBe(2)
    expect(filtered.every((e) => e.dentistId === DENTIST_A)).toBe(true)
  })

  it('returns only events for dentist B', () => {
    const filtered = filterEventsByDentist(events, DENTIST_B)
    expect(filtered.length).toBe(1)
    expect(filtered[0].dentistId).toBe(DENTIST_B)
  })

  it('excludes events from other dentists (cross-tenant isolation — Pitfall 3)', () => {
    const filteredA = filterEventsByDentist(events, DENTIST_A)
    const dentistBInA = filteredA.some((e) => e.dentistId === DENTIST_B)
    expect(dentistBInA).toBe(false)
  })

  it('returns empty array when dentistId has no events', () => {
    const filtered = filterEventsByDentist(events, 'cccccccc-0000-0000-0000-000000000003')
    expect(filtered).toHaveLength(0)
  })

  it('returns empty array when events list is empty', () => {
    const filtered = filterEventsByDentist([], DENTIST_A)
    expect(filtered).toHaveLength(0)
  })
})
