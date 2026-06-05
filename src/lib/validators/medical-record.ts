/**
 * Zod v3 validators for medical_records and dental_records
 * Phase 02-03: CLINIC-05, CLINIC-06, D-09
 */
import { z } from 'zod'

// ─── medicalRecordSchema ──────────────────────────────────────────────────────

/**
 * Schema for creating a new prontuário entry.
 * Refine: at least one of diagnosis, treatment_plan, prescription must be non-empty.
 * D-09: campos estruturados separados (TEXT); sem rich text.
 */
export const medicalRecordSchema = z
  .object({
    patient_id: z.string().uuid({ message: 'ID de paciente inválido' }),
    appointment_id: z
      .string()
      .uuid({ message: 'ID de agendamento inválido' })
      .optional(),
    diagnosis: z.string().optional(),
    treatment_plan: z.string().optional(),
    prescription: z.string().optional(),
  })
  .refine(
    (data) =>
      !!(data.diagnosis?.trim() || data.treatment_plan?.trim() || data.prescription?.trim()),
    {
      message:
        'Ao menos um campo deve ser preenchido: diagnóstico, plano de tratamento ou prescrição',
      path: ['diagnosis'],
    }
  )

export type MedicalRecordInput = z.infer<typeof medicalRecordSchema>

// ─── dentalRecordSchema ────────────────────────────────────────────────────────

/**
 * Valid FDI tooth numbers: 11-18, 21-28, 31-38, 41-48.
 */
function isValidFdiTooth(n: number): boolean {
  return (
    (n >= 11 && n <= 18) ||
    (n >= 21 && n <= 28) ||
    (n >= 31 && n <= 38) ||
    (n >= 41 && n <= 48)
  )
}

const VALID_STATUSES = [
  'higido',
  'cariado',
  'extraido',
  'em_tratamento',
  'implante',
  'coroa',
  'selante',
  'fraturado',
  'restaurado',
] as const

/**
 * Schema for inserting a dental_records snapshot.
 * tooth_number must be a valid FDI number.
 * status must be one of the 9 valid statuses.
 * D-14: snapshot per atendimento, no UPDATE/DELETE (INSERT-only policy).
 */
export const dentalRecordSchema = z.object({
  patient_id: z.string().uuid({ message: 'ID de paciente inválido' }),
  appointment_id: z
    .string()
    .uuid({ message: 'ID de agendamento inválido' })
    .optional(),
  tooth_number: z
    .number()
    .int()
    .refine(isValidFdiTooth, {
      message:
        'Número de dente inválido. Use numeração FDI: 11-18, 21-28, 31-38, 41-48',
    }),
  status: z.enum(VALID_STATUSES, {
    errorMap: () => ({
      message: `Status inválido. Use um dos seguintes: ${VALID_STATUSES.join(', ')}`,
    }),
  }),
  notes: z.string().optional(),
})

export type DentalRecordInput = z.infer<typeof dentalRecordSchema>
