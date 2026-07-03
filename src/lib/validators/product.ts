/**
 * Validators: Estoque & Materiais — Phase 17
 *
 * productSchema:                 validates products table CRUD (EST-01)
 * stockEntrySchema:              validates stock_entries table (D-10)
 * stockDrawSchema:               validates stock_draws manual draws (D-19)
 * serviceMaterialTemplateSchema: validates service_material_templates (D-07)
 *
 * T-17-01: productSchema.superRefine rejects implante without numero_anvisa_produto
 * T-17-02: stockDrawSchema z.enum rejects motivos outside the allowed list
 *
 * Zod v3 only (project constraint — CLAUDE.md). Never import from 'zod/v4'.
 * No .default() anywhere — forms provide explicit defaultValues; server actions
 * supply fallbacks inline. Avoids RHF v7 resolver type incompatibility (D-133).
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 17-estoque-materiais / Plan 01
 * Requirements: EST-01, EST-02, EST-03
 */
import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = ['insumo', 'medicamento', 'implante'] as const
export const UNIDADES_MEDIDA = ['un', 'ml', 'g', 'cx', 'fr'] as const
export const DRAW_MOTIVOS = [
  'perda',
  'quebra',
  'vencimento',
  'ajuste_inventario',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]
export type DrawMotivo = (typeof DRAW_MOTIVOS)[number]

// ─── productSchema ────────────────────────────────────────────────────────────
// D-03: implante requires numero_anvisa_produto (validated via .superRefine)
// D-05: estoque_minimo required; estoque_maximo optional
// No .default() — RHF v7 / hookform-resolvers v5 type mismatch (D-133)

export const productSchema = z
  .object({
    name: z
      .string({ required_error: 'Nome obrigatório' })
      .min(1, 'Nome obrigatório')
      .max(200, 'Nome deve ter no máximo 200 caracteres'),

    sku: z.string().max(100, 'SKU deve ter no máximo 100 caracteres').optional().nullable(),

    category: z.enum(PRODUCT_CATEGORIES, {
      errorMap: () => ({ message: 'Categoria inválida' }),
    }),

    unidade_medida: z.enum(UNIDADES_MEDIDA, {
      errorMap: () => ({ message: 'Unidade inválida' }),
    }),

    estoque_minimo: z
      .number({
        required_error: 'Estoque mínimo obrigatório',
        invalid_type_error: 'Deve ser número',
      })
      .min(0, 'Deve ser ≥ 0'),

    estoque_maximo: z.number().min(0, 'Deve ser ≥ 0').optional().nullable(),

    preferred_supplier_id: z.string().uuid('ID de fornecedor inválido').optional().nullable(),

    // Optional in the object — required conditionally for implante via superRefine (T-17-01)
    numero_anvisa_produto: z
      .string()
      .max(50, 'Número ANVISA deve ter no máximo 50 caracteres')
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    // T-17-01: Tampering — ANVISA required for implants before any DB operation
    if (val.category === 'implante' && !val.numero_anvisa_produto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Número ANVISA é obrigatório para implantes.',
        path: ['numero_anvisa_produto'],
      })
    }
  })

export type ProductInput = z.infer<typeof productSchema>

// ─── stockEntrySchema ─────────────────────────────────────────────────────────
// D-10: entrada manual de estoque — produto, lote, validade, custo
// D-03: implante requires data_validade + numero_anvisa_lote; medicamento requires data_validade
// categoria_produto is passed as context for conditional validation (not persisted directly here)

export const stockEntrySchema = z
  .object({
    product_id: z.string({ required_error: 'Produto obrigatório' }).uuid('ID de produto inválido'),

    // Passed as context for conditional validation (mirrors the product's category)
    categoria_produto: z.enum(PRODUCT_CATEGORIES, {
      errorMap: () => ({ message: 'Categoria de produto inválida' }),
    }),

    supplier_id: z.string().uuid('ID de fornecedor inválido').optional().nullable(),

    numero_lote: z
      .string({ required_error: 'Número de lote obrigatório' })
      .min(1, 'Número de lote obrigatório')
      .max(100, 'Número de lote deve ter no máximo 100 caracteres'),

    // Optional in object — conditionally required for implante/medicamento (superRefine)
    data_validade: z.string().optional().nullable(),

    qtd: z
      .number({
        required_error: 'Quantidade obrigatória',
        invalid_type_error: 'Deve ser número',
      })
      .positive('A quantidade deve ser maior que zero.'),

    custo_unitario: z
      .number({
        required_error: 'Custo unitário obrigatório',
        invalid_type_error: 'Deve ser número',
      })
      .min(0, 'Custo unitário não pode ser negativo'),

    nota_fiscal: z.string().max(100, 'NF deve ter no máximo 100 caracteres').optional().nullable(),

    // Optional in object — conditionally required for implante (superRefine)
    numero_anvisa_lote: z
      .string()
      .max(50, 'Número ANVISA deve ter no máximo 50 caracteres')
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    // D-03: medicamento and implante both require validade
    if (
      (val.categoria_produto === 'implante' || val.categoria_produto === 'medicamento') &&
      !val.data_validade
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de validade obrigatória para esta categoria.',
        path: ['data_validade'],
      })
    }
    // D-03: implante also requires ANVISA lot number
    if (val.categoria_produto === 'implante' && !val.numero_anvisa_lote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Número ANVISA do lote é obrigatório para implantes.',
        path: ['numero_anvisa_lote'],
      })
    }
  })

export type StockEntryInput = z.infer<typeof stockEntrySchema>

// ─── stockDrawSchema ──────────────────────────────────────────────────────────
// D-19: baixa manual com motivo obrigatório — apenas admin/operacional
// T-17-02: motivo validated via z.enum — values outside list rejected at parse

export const stockDrawSchema = z.object({
  product_id: z.string({ required_error: 'Produto obrigatório' }).uuid('ID de produto inválido'),

  qtd: z
    .number({
      required_error: 'Quantidade obrigatória',
      invalid_type_error: 'Deve ser número',
    })
    .positive('A quantidade deve ser maior que zero.'),

  // T-17-02: z.enum enforces list — 'extravio', etc. are rejected
  motivo: z.enum(DRAW_MOTIVOS, {
    errorMap: () => ({ message: 'Motivo inválido' }),
  }),

  observacao: z
    .string()
    .max(500, 'Observação deve ter no máximo 500 caracteres')
    .optional()
    .nullable(),
})

export type StockDrawInput = z.infer<typeof stockDrawSchema>

// ─── serviceMaterialTemplateSchema ───────────────────────────────────────────
// D-07: template de consumo por serviço — admin configura via /config/servicos

export const serviceMaterialTemplateSchema = z.object({
  service_id: z.string({ required_error: 'Serviço obrigatório' }).uuid('ID de serviço inválido'),

  product_id: z.string({ required_error: 'Produto obrigatório' }).uuid('ID de produto inválido'),

  qtd_padrao: z
    .number({
      required_error: 'Quantidade padrão obrigatória',
      invalid_type_error: 'Deve ser número',
    })
    .positive('A quantidade deve ser maior que zero.'),
})

export type ServiceMaterialTemplateInput = z.infer<typeof serviceMaterialTemplateSchema>
