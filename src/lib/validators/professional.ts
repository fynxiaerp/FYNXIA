/**
 * Validator: professional registration (PRO-01, PRO-03)
 *
 * Phase 11:
 * - commissionRulesSchema: discriminated union of commission rule shapes.
 *   Phase 16 (TRIB) consumes these stored rules for calculation.
 *   This plan ONLY validates storage — no calculation here.
 * - professionalSchema: form validation for the professionals cadastro UI (Plan 06).
 * - availabilityWindowSchema / availabilityExceptionSchema: for the AvailabilityGrid
 *   editor (Plan 06 form) — validates individual availability rows before submit.
 *
 * No .default() on any field — follows D-133/D-158 decision:
 * RHF v7 + @hookform/resolvers v5 reject schemas with .default() due to
 * input/output type mismatch. Form defaultValues supply the initial values.
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 */
import { z } from 'zod'

// ─── commission_rules JSONB shape (PRO-03) ─────────────────────────────────

/**
 * One commission rule entry stored in professionals.commission_rules (JSONB).
 *
 * flat_pct  — default % applied to all services for this professional.
 * service_pct — override % applied to a specific service (by UUID).
 *
 * Phase 16 resolution: find service_pct match first, fall back to flat_pct.
 * pct must be in [0, 100]; service_id must be a valid UUID for service_pct.
 */
export const commissionRulesSchema = z.array(
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('flat_pct'),
      pct: z.number().min(0).max(100),
    }),
    z.object({
      type: z.literal('service_pct'),
      service_id: z.string().uuid(),
      pct: z.number().min(0).max(100),
    }),
  ]),
)

export type CommissionRules = z.infer<typeof commissionRulesSchema>

// ─── professional_availability row (for AvailabilityGrid editor) ─────────────

/**
 * Validates a single recurring availability window before submission.
 * Mirrors the shape expected by isSlotWithinAvailability in availability.ts.
 */
export const availabilityWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM'),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM'),
})

export type AvailabilityWindowInput = z.infer<typeof availabilityWindowSchema>

// ─── professional_availability_exceptions row ─────────────────────────────────

/**
 * Validates a single availability exception (folga or extra) before submission.
 * start_time/end_time are required when exception_type = 'extra'.
 */
export const availabilityExceptionSchema = z
  .object({
    exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido — use YYYY-MM-DD'),
    exception_type: z.enum(['folga', 'extra']),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM')
      .optional()
      .nullable(),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM')
      .optional()
      .nullable(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.exception_type === 'extra') {
        return Boolean(data.start_time && data.end_time)
      }
      return true
    },
    { message: 'Horário de início e fim são obrigatórios para exceções do tipo extra' },
  )

export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>

// ─── professionalSchema (PRO-01 form) ────────────────────────────────────────

/**
 * Professional registration form schema.
 * Used by ProfessionalForm.tsx (Plan 06) via react-hook-form + zodResolver.
 *
 * No .default() — form defaultValues supply: vinculo='autonomo', ativo=true,
 * especialidades=[], commission_rules=[].
 */
export const professionalSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  cro: z.string().min(1, 'CRO é obrigatório'),
  cro_uf: z
    .string()
    .length(2, 'UF deve ter 2 caracteres')
    .transform((v) => v.toUpperCase()),
  especialidades: z.array(z.string()),
  vinculo: z.enum(['clt', 'pj', 'autonomo']),
  unit_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional().nullable(),
  commission_rules: commissionRulesSchema,
  ativo: z.boolean().optional(),
})

export type ProfessionalInput = z.infer<typeof professionalSchema>
