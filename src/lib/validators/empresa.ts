/**
 * Validator: empresa (rede / clinic) config
 *
 * SYS-01 / Plan 07-05: validated input for updating the clinic (rede) record.
 * Accepts either CNPJ or CPF (cpf-cnpj-validator); regime_tributario constrained
 * to the 4 values enforced by the DB CHECK (migration 20260614000150).
 */
import { z } from 'zod'
import { cnpj, cpf } from 'cpf-cnpj-validator'

export const REGIME_TRIBUTARIO_VALUES = [
  'simples_nacional',
  'lucro_presumido',
  'lucro_real',
  'mei',
] as const

export type RegimeTributario = (typeof REGIME_TRIBUTARIO_VALUES)[number]

export const empresaSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    cnpj_or_cpf: z.string().min(1, 'CNPJ ou CPF é obrigatório'),
    regime_tributario: z.enum(REGIME_TRIBUTARIO_VALUES, {
      errorMap: () => ({ message: 'Regime tributário inválido' }),
    }),
    phone: z.string().optional(),
    address: z.string().optional(),
  })
  .refine(
    (data) => {
      const raw = data.cnpj_or_cpf.replace(/\D/g, '')
      return cnpj.isValid(raw) || cpf.isValid(raw)
    },
    {
      message: 'CNPJ ou CPF inválido',
      path: ['cnpj_or_cpf'],
    }
  )

export type EmpresaInput = z.infer<typeof empresaSchema>
