import { z } from 'zod'

// Zod v3 (NUNCA v4 — @hookform/resolvers v5.x tem edge cases com v4)
// CPF format: 000.000.000-00 (plaintext — D-06; busca na recepção)
// Campos de saúde (medical_history/allergies/medications) são opcionais strings —
// AES-256 é aplicado no Server Action antes do INSERT, nunca aqui.

export const patientSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nome completo deve ter pelo menos 2 caracteres'),

  cpf: z
    .string()
    .regex(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      'CPF deve estar no formato 000.000.000-00'
    ),

  date_of_birth: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Data de nascimento deve ser uma data ISO (YYYY-MM-DD)'
    ),

  phone: z.string().optional(),

  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),

  address: z.string().optional(),

  // D-07: campos criptografados com AES-256-GCM antes do INSERT (no Server Action)
  medical_history: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
})

export type PatientInput = z.infer<typeof patientSchema>
