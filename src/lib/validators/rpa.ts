/**
 * src/lib/validators/rpa.ts — Zod v3 validator for RPA generation (TRIB-02)
 *
 * Zod v3 (NUNCA v4) — pinned project convention.
 * D-133: NO .default() in schemas — RHF defaultValues provides form defaults.
 * Note: supplierId filtering for autonomo tipo is enforced at the action layer,
 * not here (schema only validates shape/types).
 */

import { z } from 'zod'

const isMoney2dp = (v: number): boolean =>
  Number.isFinite(v) && Number(v.toFixed(2)) === v

// ─── rpaSchema ─────────────────────────────────────────────────────────────────

export const rpaSchema = z.object({
  supplierId: z.string().uuid('ID do fornecedor inválido'),

  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Competência inválida (YYYY-MM)'),

  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de pagamento inválida (YYYY-MM-DD)'),

  valorBruto: z
    .number()
    .positive('Valor bruto deve ser maior que zero')
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),

  modalidadeInss: z.enum(['11pct', 'progressivo'], {
    errorMap: () => ({ message: 'Modalidade INSS inválida' }),
  }),

  issOverride: z.number().optional(),

  unitId: z.string().uuid('ID da unidade inválido').optional(),
})

export type RpaInput = z.infer<typeof rpaSchema>
