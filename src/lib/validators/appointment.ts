import { z } from 'zod'

// Zod v3 (NUNCA v4)
// Appointment statuses: D-03 — 5 status fixos
// Source: D-04 — 'interno' | 'publico'

export const appointmentSchema = z
  .object({
    dentist_id: z.string().uuid('ID do dentista inválido'),

    patient_id: z
      .string()
      .uuid('ID do paciente inválido')
      .optional(),

    start_time: z
      .string()
      .datetime({ message: 'Data/hora de início inválida' }),

    end_time: z
      .string()
      .datetime({ message: 'Data/hora de fim inválida' }),

    status: z
      .enum(['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado'])
      .default('agendado'),

    notes: z.string().optional(),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: 'Horário de fim deve ser posterior ao horário de início',
    path: ['end_time'],
  })

export type AppointmentInput = z.infer<typeof appointmentSchema>

// ─── Calendar event mapping ──────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  start: string
  end: string
  dentistId: string
  status: string
  title: string
  patientName?: string
}

/**
 * Maps an appointment record to a FullCalendar event object.
 * Pure function — no side effects.
 */
export function mapAppointmentToEvent(appointment: {
  id: string
  start_time: string
  end_time: string
  dentist_id: string
  status: string
  notes?: string | null
  patient?: { full_name: string } | null
}): CalendarEvent {
  const patientName = appointment.patient?.full_name ?? 'Paciente não informado'
  return {
    id: appointment.id,
    start: appointment.start_time,
    end: appointment.end_time,
    dentistId: appointment.dentist_id,
    status: appointment.status,
    title: patientName,
    patientName,
  }
}

/**
 * Filters a list of calendar events to only those belonging to the given dentist.
 * Covers Pitfall 3: FullCalendar must display only the selected dentist's events.
 */
export function filterEventsByDentist(
  events: CalendarEvent[],
  dentistId: string
): CalendarEvent[] {
  return events.filter((e) => e.dentistId === dentistId)
}
