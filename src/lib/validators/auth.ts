import { z } from 'zod'
import { zodValidator } from 'cpf-cnpj-validator/zod'

const { cpf: zCpf, cnpj: zCnpj } = zodValidator(z)

// Accept either a valid CPF (dentista autônomo) or CNPJ (clínica)
const documentSchema = z.union([zCpf(), zCnpj()], {
  errorMap: () => ({ message: 'Informe um CPF ou CNPJ válido' }),
})

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export const signupSchema = z.object({
  clinicName: z.string().min(2, 'Nome da clínica é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  document: documentSchema, // CPF or CNPJ; stored in clinics.cnpj
  phone: z
    .string()
    .regex(/^\(\d{2}\)\s9?\d{4}-\d{4}$/, 'Telefone inválido — use (11) 99999-9999'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
