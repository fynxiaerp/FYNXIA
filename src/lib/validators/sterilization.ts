/**
 * Validator: sterilization cycle create + kit-usage link (CME-01, CME-03)
 *
 * Phase 13 (CME-01, CME-03):
 * - sterilizationCycleSchema validates the fields for creating a sterilization cycle
 *   (autoclave_id, params, biological_result, cycle_date, validade).
 * - kitUsageSchema validates the link between a sterilization cycle (lote) and a
 *   patient + appointment for CME-03 traceability.
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

export const sterilizationCycleSchema = z.object({
  autoclave_id: z.string().uuid('Autoclave inválida'),
  unit_id: z.string().uuid('Unidade inválida').optional(),
  cycle_number: z.string().max(100, 'Número do ciclo deve ter no máximo 100 caracteres').optional(),
  temperatura: z.number().nonnegative('Temperatura deve ser não-negativa').optional(),
  tempo_minutos: z
    .number()
    .int('Tempo deve ser um número inteiro')
    .nonnegative('Tempo deve ser não-negativo')
    .optional(),
  pressao: z.number().nonnegative('Pressão deve ser não-negativa').optional(),
  biological_result: z.enum(['pendente', 'aprovado', 'reprovado'], {
    errorMap: () => ({ message: 'Resultado biológico inválido' }),
  }),
  cycle_date: z.string().min(8, 'Data do ciclo inválida'),
  validade: z.string().min(8, 'Data de validade inválida').optional(),
  operator_id: z.string().uuid('Operador inválido').optional(),
  notes: z.string().max(2000, 'Observações devem ter no máximo 2000 caracteres').optional(),
})

export type SterilizationCycleInput = z.infer<typeof sterilizationCycleSchema>

export const kitUsageSchema = z.object({
  sterilization_cycle_id: z.string().uuid('Ciclo de esterilização inválido'),
  patient_id: z.string().uuid('Paciente inválido'),
  appointment_id: z.string().uuid('Consulta inválida').optional(),
  unit_id: z.string().uuid('Unidade inválida').optional(),
  kit_label: z.string().max(200, 'Etiqueta do kit deve ter no máximo 200 caracteres').optional(),
})

export type KitUsageInput = z.infer<typeof kitUsageSchema>
