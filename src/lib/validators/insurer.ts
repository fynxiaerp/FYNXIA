/**
 * Validators: Operadoras de Convênio — Phase 15 CONV-01
 *
 * insurerSchema: validates the insurers table CRUD (D-26/CONV-01).
 *   name, tissVersion, prazoPagamentoDias, status are required.
 *   cnpj, registroAns, contato* are optional (not all insurers supply all data).
 *
 * T-15-06: insurerSchema length-bounds cnpj/registroAns + status enum; write
 *          gated to admin/financeiro in Plan 03 RLS (D-18).
 *
 * Zod v3 only (project constraint — CLAUDE.md). Never import from 'zod/v4'.
 * No .default() anywhere — RHF defaultValues supplies 'ativo', '3.05.00', 30
 * etc. Avoids RHF v7 resolver type incompatibility (D-133).
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 02
 * Requirements: CONV-01, CONV-03
 */
import { z } from 'zod'

// ─── Insurer (insurers table) ────────────────────────────────────────────────

export const insurerSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(120, 'Nome deve ter no máximo 120 caracteres'),

  // T-15-06: length-bounded; format validation deferred to UX layer
  cnpj: z.string().max(18, 'CNPJ deve ter no máximo 18 caracteres').optional().nullable(),

  registroAns: z
    .string()
    .max(20, 'Registro ANS deve ter no máximo 20 caracteres')
    .optional()
    .nullable(),

  // TISS XML version — RHF defaultValues provides '3.05.00'
  tissVersion: z.string().min(1, 'Versão TISS obrigatória'),

  // Payment deadline in calendar days (D-26)
  prazoPagamentoDias: z
    .number()
    .int('Prazo deve ser um número inteiro')
    .min(0, 'Prazo não pode ser negativo'),

  // Allow empty string (cleared field) or valid email
  contatoEmail: z
    .string()
    .email('E-mail de contato inválido')
    .optional()
    .or(z.literal('')),

  contatoPhone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .optional()
    .nullable(),

  // FK to integration_connectors (Phase 9 Hub) — optional until connector is set up
  connectorId: z.string().uuid('Conector inválido').optional().nullable(),

  // T-15-06: enum restricts to valid status values
  status: z.enum(['ativo', 'em_negociacao', 'inativo'], {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
})

export type InsurerInput = z.infer<typeof insurerSchema>
