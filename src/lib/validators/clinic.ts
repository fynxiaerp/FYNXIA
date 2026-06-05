import { z } from 'zod'

export const clinicSettingsSchema = z.object({
  name: z.string().min(2, 'Nome da clínica é obrigatório'),
  phone: z
    .string()
    .regex(/^\(\d{2}\)\s9?\d{4}-\d{4}$/, 'Telefone inválido — use (11) 99999-9999')
    .optional(),
  address: z.string().optional(),
  specialty: z.string().optional(),
})

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>
