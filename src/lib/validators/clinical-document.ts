/**
 * Zod v3 schemas for clinical document emission (RX-01/RX-02/RX-03)
 *
 * No .default() on any field — follows D-133/D-158 decision:
 * RHF v7 + @hookform/resolvers v5 reject schemas with .default() due to
 * input/output type mismatch. Form defaultValues supply the initial values.
 *
 * Note: doc-type-conditional requiredness (receita needs ≥1 medication;
 * atestado needs atestado_motivo; exame needs exame_solicitacao) is enforced
 * in the Server Action (Plan 04), not via Zod .superRefine(), to keep the
 * form schema flat for RHF fieldArray compatibility.
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 02
 * Requirements: RX-01, RX-02, RX-03
 */

import { z } from 'zod'

// ─── medicationLineSchema ─────────────────────────────────────────────────────
// One line on a prescription (receita): medication reference + posologia text.
// Used as an array in clinicalDocumentSchema.medications (receita_simples / receita_controle_especial).

export const medicationLineSchema = z.object({
  medication_id: z.string().uuid(),
  medication_name: z.string().min(1),
  posologia: z.string().min(1).max(500),
  quantidade: z.string().max(100).optional(),
})

export type MedicationLineInput = z.infer<typeof medicationLineSchema>

// ─── clinicalDocumentSchema ───────────────────────────────────────────────────
// Flat schema for all clinical document types.
// Conditional field requirements (by doc_type) are enforced in the action.

export const clinicalDocumentSchema = z.object({
  // Which type of clinical document to emit (RX-01 / D-04)
  doc_type: z.enum([
    'receita_simples',
    'receita_controle_especial',
    'atestado',
    'solicitacao_exame',
  ]),

  // Patient + appointment linkage
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),

  // RX-03: portal visibility flag
  portal_visible: z.boolean().optional(),

  // receita_simples / receita_controle_especial payload
  medications: z.array(medicationLineSchema).optional(),

  // atestado payload
  atestado_motivo: z.string().max(2000).optional(),
  atestado_dias: z.number().int().min(0).optional(),

  // solicitacao_exame payload
  exame_solicitacao: z.string().max(2000).optional(),

  // shared optional notes field
  observacoes: z.string().max(2000).optional(),
})

export type ClinicalDocumentInput = z.infer<typeof clinicalDocumentSchema>
