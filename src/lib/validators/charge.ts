import { z } from 'zod'

// Zod v3 (NUNCA v4) — matches project convention (see appointment.ts)
// chargeSchema: validates createCharge Server Action input

export const chargeSchema = z.object({
  patientId: z.string().uuid('ID do paciente inválido'),

  description: z.string().min(1, 'Descrição obrigatória').max(500),

  billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Tipo de cobrança inválido' }),
  }),

  value: z.number().positive('Valor deve ser maior que zero'),

  // YYYY-MM-DD
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida (YYYY-MM-DD)'),

  // 1 = single charge; 2-21 = installment plan
  installmentCount: z
    .number()
    .int('Número de parcelas deve ser inteiro')
    .min(1, 'Mínimo 1 parcela')
    .max(21, 'Máximo 21 parcelas')
    .default(1),
})

export type ChargeInput = z.infer<typeof chargeSchema>
