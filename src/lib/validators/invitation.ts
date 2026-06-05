import { z } from 'zod'

export const createInviteSchema = z
  .object({
    email: z.string().email('E-mail inválido'),
    role: z.enum(['admin', 'dentist', 'receptionist', 'patient']),
    mode: z.enum(['email', 'direct']),
    tempPassword: z.string().min(8).optional(), // required when mode='direct'
  })
  .refine((d) => d.mode !== 'direct' || (d.tempPassword?.length ?? 0) >= 8, {
    message: 'Senha temporária obrigatória (mín. 8) para criação direta',
    path: ['tempPassword'],
  })

export const patientSelfRegisterSchema = z.object({
  clinicSlug: z.string().min(1, 'Slug da clínica é obrigatório'),
  email: z.string().email('E-mail inválido'),
  fullName: z.string().min(2, 'Nome completo é obrigatório'),
})

export const acceptInvitationSchema = z.object({
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>
export type PatientSelfRegisterInput = z.infer<typeof patientSelfRegisterSchema>
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
