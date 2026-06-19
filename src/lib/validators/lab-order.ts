/**
 * Validators: Laboratório de Prótese — lab supplier + OS protética (LAB-01/LAB-02)
 *
 * labSchema:      validates the prosthetic_labs supplier record (nome required,
 *                 cnpj/contato_nome/telefone/email/notes optional).
 * labStageSchema: validates a single etapa de prova entry in the stages JSONB array.
 * labOrderSchema: validates the lab_orders OS (lab_id, patient_id, prosthesis_type
 *                 required; appointment_id, unit_id, due_date, order_number, cost,
 *                 notes, status enum, stages array optional).
 *
 * Zod v3 only (project constraint — CLAUDE.md). Never import from 'zod/v4'.
 * No .default() — forms provide explicit defaultValues; server actions supply
 * fallbacks when needed. Avoids RHF v7 resolver type incompatibility (D-133).
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 03
 * Requirements: LAB-01, LAB-02
 */
import { z } from 'zod'

// ─── Lab supplier (prosthetic_labs) ──────────────────────────────────────────

export const labSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  cnpj: z.string().max(20).optional(),
  contato_nome: z.string().max(200).optional(),
  telefone: z.string().max(40).optional(),
  email: z.string().email('E-mail inválido').max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
})

export type LabInput = z.infer<typeof labSchema>

// ─── Etapa de prova (stages JSONB array item) ─────────────────────────────────

export const labStageSchema = z.object({
  nome: z.string().min(1).max(200),
  prevista: z.string().min(8).optional(),
  concluida_em: z.string().min(8).optional(),
})

export type LabStageInput = z.infer<typeof labStageSchema>

// ─── OS protética (lab_orders) ────────────────────────────────────────────────

export const labOrderSchema = z.object({
  lab_id: z.string().uuid('Lab inválido'),
  patient_id: z.string().uuid('Paciente inválido'),
  appointment_id: z.string().uuid('Consulta inválida').optional(),
  unit_id: z.string().uuid('Unidade inválida').optional(),
  prosthesis_type: z.string().min(1, 'Tipo de prótese é obrigatório').max(200),
  order_number: z.string().max(100).optional(),
  due_date: z.string().min(8).optional(),
  status: z.enum(['enviado', 'prova', 'concluido']),
  stages: z.array(labStageSchema).optional(),
  cost: z.number().nonnegative('Custo deve ser não-negativo').optional(),
  notes: z.string().max(2000).optional(),
})

export type LabOrderInput = z.infer<typeof labOrderSchema>
