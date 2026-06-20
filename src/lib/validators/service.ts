/**
 * Validators: Serviços & Preços de Convênio — Phase 15 billing catalog
 *
 * serviceSchema:      validates services table CRUD (OS-01/D-04/D-05)
 * insurerPriceSchema: validates insurer_prices table CRUD (D-06/CONV-01)
 *
 * T-15-03: isMoney2dp refine enforces 2dp precision on valor_particular /
 *          insurer_prices.valor — mirrors charge.ts pattern.
 *
 * Zod v3 only (project constraint — CLAUDE.md). Never import from 'zod/v4'.
 * No .default() anywhere — forms provide explicit defaultValues; server actions
 * supply fallbacks inline. Avoids RHF v7 resolver type incompatibility (D-133).
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 02
 * Requirements: OS-01, OS-02, CONV-01
 */
import { z } from 'zod'

// WR-01 (mirrors charge.ts): money must not have more than 2 decimal places.
// NUMERIC(12,2) on the DB silently rounds, so validate on the way in.
export const isMoney2dp = (v: number): boolean =>
  Number.isFinite(v) && Number(v.toFixed(2)) === v

// ─── Service (services table) ────────────────────────────────────────────────

export const serviceSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(120, 'Nome deve ter no máximo 120 caracteres'),

  code: z.string().max(50, 'Código deve ter no máximo 50 caracteres').optional(),

  tussCode: z.string().max(20, 'Código TUSS deve ter no máximo 20 caracteres').optional(),

  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),

  // T-15-03: isMoney2dp enforces server-side precision invariant
  valorParticular: z
    .number()
    .min(0, 'Valor não pode ser negativo')
    .refine(isMoney2dp, { message: 'Valor inválido (máximo 2 casas decimais)' }),

  // FK to chart_of_accounts — nullable until clinic classifies the service
  accountId: z.string().uuid('Conta contábil inválida').optional().nullable(),

  // Per-service ISS override (0.0000 – 1.0000, e.g. 0.05 = 5%)
  aliquotaIssOverride: z.number().min(0).max(1).optional().nullable(),

  itemListaServicoOverride: z
    .string()
    .max(10, 'Código LC 116 deve ter no máximo 10 caracteres')
    .optional()
    .nullable(),

  ativo: z.boolean(),
})

export type ServiceInput = z.infer<typeof serviceSchema>

// ─── Insurer price (insurer_prices table) ────────────────────────────────────

export const insurerPriceSchema = z.object({
  insurerId: z.string().uuid('Operadora inválida'),

  serviceId: z.string().uuid('Serviço inválido'),

  // T-15-03: same isMoney2dp guard as serviceSchema.valorParticular
  valor: z
    .number()
    .min(0, 'Valor não pode ser negativo')
    .refine(isMoney2dp, { message: 'Valor inválido (máximo 2 casas decimais)' }),
})

export type InsurerPriceInput = z.infer<typeof insurerPriceSchema>
