/**
 * src/lib/validators/payable.ts — Zod v3 validators for payables (FOP-01)
 *
 * Zod v3 (NUNCA v4) — pinned project convention.
 * D-133: NO .default() in schemas — RHF defaultValues provides form defaults.
 * Mirrors patterns from charge.ts / service-order.ts.
 */

import { z } from 'zod'

// Money helper — mirrors isMoney2dp in charge.ts
export const isMoney2dp = (v: number): boolean =>
  Number.isFinite(v) && Number(v.toFixed(2)) === v

// ─── payableSchema ─────────────────────────────────────────────────────────────

export const payableSchema = z.object({
  supplierId: z.string().uuid('ID do fornecedor inválido'),

  descricao: z.string().min(1, 'Descrição obrigatória').max(500),

  accountId: z.string().uuid('ID da conta contábil inválido'),

  costCenterId: z.string().uuid('ID do centro de custo inválido'),

  unitId: z.string().uuid('ID da unidade inválido').optional().nullable(),

  // D-05 (Phase 18): optional link to a marketing campaign — attributes this
  // despesa's cost to campaign ROI (CPL/CAC). NULL = despesa não vinculada.
  campaignId: z.string().uuid('ID da campanha inválido').optional().nullable(),

  valorTotal: z
    .number()
    .positive('Valor deve ser maior que zero')
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),

  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida (YYYY-MM-DD)'),

  parcelas: z
    .number()
    .int('Número de parcelas deve ser inteiro')
    .min(1, 'Mínimo 1 parcela'),

  origem: z.enum(['manual', 'recorrente', 'lab', 'repasse', 'tributo'], {
    errorMap: () => ({ message: 'Origem inválida' }),
  }),

  notes: z.string().max(2000).optional().nullable(),

  documentId: z.string().uuid('ID do documento inválido').optional().nullable(),
})

export type PayableInput = z.infer<typeof payableSchema>

// ─── baixaSchema ───────────────────────────────────────────────────────────────

export const baixaSchema = z.object({
  installmentId: z.string().uuid('ID da parcela inválido'),

  bankAccountId: z.string().uuid('ID da conta bancária inválido'),

  valorPago: z
    .number()
    .positive('Valor pago deve ser maior que zero')
    .refine(isMoney2dp, { message: 'Valor deve ter no máximo 2 casas decimais' }),

  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de pagamento inválida (YYYY-MM-DD)'),

  comprovanteDocumentId: z.string().uuid('ID do comprovante inválido').optional().nullable(),
})

export type BaixaInput = z.infer<typeof baixaSchema>
