import { z } from 'zod'

// Zod v3 (NUNCA v4) — matches project convention (D-133: no .default())
// service-order validators for OS creation, item lines, and faturar action.

// ---------------------------------------------------------------------------
// Money helper — re-declared locally to avoid cross-plan import ordering issues
// (mirrors isMoney2dp in charge.ts)
// ---------------------------------------------------------------------------
export const isMoney2dp = (v: number): boolean =>
  Number.isFinite(v) && Number(v.toFixed(2)) === v

// ---------------------------------------------------------------------------
// serviceOrderItemSchema — one line item of the OS
// ---------------------------------------------------------------------------
export const serviceOrderItemSchema = z.object({
  serviceId: z.string().uuid('ID do serviço inválido').optional().nullable(),

  professionalId: z
    .string()
    .uuid('ID do profissional inválido')
    .optional()
    .nullable(),

  description: z
    .string()
    .min(1, 'Descrição obrigatória')
    .max(300, 'Descrição muito longa (máx 300 caracteres)'),

  tussCode: z.string().max(20, 'Código TUSS muito longo').optional().nullable(),

  quantity: z
    .number()
    .int('Quantidade deve ser inteira')
    .min(1, 'Quantidade mínima é 1'),

  valorUnitario: z
    .number()
    .refine(isMoney2dp, { message: 'Valor unitário inválido (máx 2 casas decimais)' }),

  desconto: z
    .number()
    .refine(isMoney2dp, { message: 'Desconto inválido (máx 2 casas decimais)' }),

  dente: z.string().max(10, 'Código de dente muito longo').optional().nullable(),

  face: z.string().max(10, 'Código de face muito longo').optional().nullable(),

  accountId: z.string().uuid('ID da conta inválido').optional().nullable(),

  costCenterId: z
    .string()
    .uuid('ID do centro de custo inválido')
    .optional()
    .nullable(),
})

export type ServiceOrderItemInput = z.infer<typeof serviceOrderItemSchema>

// ---------------------------------------------------------------------------
// serviceOrderSchema — OS header + items array
// Refine: when pagador === 'convenio', insurerId must be present (CONV path).
// ---------------------------------------------------------------------------
export const serviceOrderSchema = z
  .object({
    patientId: z.string().uuid('ID do paciente inválido').optional().nullable(),

    unitId: z.string().uuid('ID da unidade inválido').optional().nullable(),

    pagador: z.enum(['particular', 'convenio'], {
      errorMap: () => ({ message: 'Pagador deve ser particular ou convenio' }),
    }),

    insurerId: z.string().uuid('ID da operadora inválido').optional().nullable(),

    descontoTotal: z
      .number()
      .refine(isMoney2dp, { message: 'Desconto total inválido (máx 2 casas decimais)' }),

    acrescimoTotal: z
      .number()
      .refine(isMoney2dp, { message: 'Acréscimo total inválido (máx 2 casas decimais)' }),

    notes: z
      .string()
      .max(1000, 'Notas muito longas (máx 1000 caracteres)')
      .optional()
      .nullable(),

    items: z.array(serviceOrderItemSchema),
  })
  .refine(
    (data) => {
      if (data.pagador === 'convenio') {
        return data.insurerId != null && data.insurerId !== ''
      }
      return true
    },
    {
      message: 'Operadora obrigatória para convênio',
      path: ['insurerId'],
    }
  )

export type ServiceOrderInput = z.infer<typeof serviceOrderSchema>

// ---------------------------------------------------------------------------
// faturarOsSchema — input to the faturar Server Action
// installmentCount: 1–21 (D-21 up to 21x parcelamento)
// ---------------------------------------------------------------------------
export const faturarOsSchema = z.object({
  osId: z.string().uuid('ID da OS inválido'),

  billingType: z
    .enum(['PIX', 'BOLETO', 'CREDIT_CARD'], {
      errorMap: () => ({ message: 'Tipo de cobrança inválido' }),
    })
    .optional()
    .nullable(),

  installmentCount: z
    .number()
    .int('Número de parcelas deve ser inteiro')
    .min(1, 'Mínimo 1 parcela')
    .max(21, 'Máximo 21 parcelas')
    .optional()
    .nullable(),
})

export type FaturarOsInput = z.infer<typeof faturarOsSchema>
