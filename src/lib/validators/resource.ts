/**
 * Validator: resource create/edit (RES-01)
 *
 * Phase 11 (RES-01):
 * - resourceSchema validates the fields for creating or updating a physical resource
 *   (room, chair, equipment) in a clinical unit.
 *
 * No .default() — forms provide explicit defaultValues; server actions supply
 * fallbacks when needed. This avoids RHF v7 resolver type incompatibility with
 * Zod schemas that use .default() (input vs output type mismatch — D-133/D-158).
 *
 * Zod v3 only (project constraint — CLAUDE.md). Never import from 'zod/v4'.
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 */
import { z } from 'zod'

export const resourceSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  tipo: z.enum(['sala', 'cadeira', 'equipamento'], {
    errorMap: () => ({ message: 'Tipo deve ser sala, cadeira ou equipamento' }),
  }),
  unit_id: z.string().uuid('Unidade inválida'),
  patrimonio: z.string().optional(),
  numero_serie: z.string().optional(),
  status: z.enum(['ativo', 'manutencao', 'inativo'], {
    errorMap: () => ({ message: 'Status deve ser ativo, manutencao ou inativo' }),
  }),
  manutencao_prevista: z.string().optional(),
})

export type ResourceInput = z.infer<typeof resourceSchema>
