/**
 * Validator: unit (filial) config
 *
 * SYS-01 / Plan 07-05: validated input for creating/updating a unit record.
 * slug must be kebab-case lowercase alphanumeric (URL-safe).
 * CNPJ is optional for units that share the rede CNPJ.
 */
import { z } from 'zod'
import { cnpj } from 'cpf-cnpj-validator'

export const unitSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  cnpj: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.replace(/\D/g, '').length === 0) return true
        return cnpj.isValid(val.replace(/\D/g, ''))
      },
      { message: 'CNPJ da unidade inválido' }
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  phone: z.string().optional(),
  address: z.string().optional(),
  ativo: z.boolean(),
})

export type UnitInput = z.infer<typeof unitSchema>
