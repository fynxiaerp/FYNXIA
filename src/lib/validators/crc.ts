// src/lib/validators/crc.ts
// Zod v3 schemas for all Phase 18 (CRC & Marketing) Server Action inputs.
// No Zod default-value modifier anywhere (D-133) — RHF v7 + @hookform/resolvers v5
// compares input vs output types; a schema-level default creates a mismatch the
// resolver rejects. Forms supply defaults via `useForm({ defaultValues })` instead.
import { z } from 'zod'

// ─── Lead funnel (CRC-01, D-01) ───────────────────────────────────────────────

/** Funnel stage order: Novo → Contatado → Agendado → Convertido / Perdido (D-01). */
export const LEAD_STAGES = ['novo', 'contatado', 'agendado', 'convertido', 'perdido'] as const
export type LeadStage = (typeof LEAD_STAGES)[number]

export const leadSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  source_id: z.string().uuid('Origem inválida'),
  referred_by_patient_id: z.string().uuid().optional(),
  notes: z.string().max(2000, 'Observação muito longa').optional(),
})
export type LeadInput = z.infer<typeof leadSchema>

/** Admin-managed lead source catalog (D-03) — fixed list, not free text. */
export const leadSourceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(80, 'Nome muito longo'),
})
export type LeadSourceInput = z.infer<typeof leadSourceSchema>

/**
 * Forward-only stage transition guard (D-01):
 *   - Same-stage transitions are rejected.
 *   - Unknown stage values are rejected.
 *   - convertido/perdido are terminal — no outbound transition allowed.
 *   - Any non-terminal stage may jump straight to 'perdido'.
 *   - Otherwise, transitions must move strictly forward through
 *     novo → contatado → agendado → convertido.
 */
export function isValidStageTransition(from: string, to: string): boolean {
  if (from === to) return false
  if (!isLeadStage(from) || !isLeadStage(to)) return false

  const TERMINAL_STAGES: readonly LeadStage[] = ['convertido', 'perdido']
  if (TERMINAL_STAGES.includes(from)) return false

  if (to === 'perdido') return true

  const FORWARD_ORDER: readonly LeadStage[] = ['novo', 'contatado', 'agendado', 'convertido']
  const fromIdx = FORWARD_ORDER.indexOf(from)
  const toIdx = FORWARD_ORDER.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return false

  return toIdx > fromIdx
}

function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value)
}

// ─── Campaign segment & channel (CRC-03, D-07/D-08) ───────────────────────────

/** "Inativo há X dias" segment with optional filters (D-07) — not a free query builder. */
export const campaignSegmentSchema = z.object({
  inactiveDays: z.number().int().min(1, 'Informe ao menos 1 dia'),
  lastProcedureServiceId: z.string().uuid().optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  unitId: z.string().uuid().optional(),
})
export type CampaignSegmentInput = z.infer<typeof campaignSegmentSchema>

/** At least one channel required (D-08). */
export const campaignChannelSchema = z
  .object({
    whatsapp: z.boolean(),
    email: z.boolean(),
  })
  .refine((v) => v.whatsapp || v.email, { message: 'Selecione ao menos um canal' })
export type CampaignChannelInput = z.infer<typeof campaignChannelSchema>

// ─── NPS (CRC-04, D-13/D-14) ───────────────────────────────────────────────────

export const npsSubmitSchema = z.object({
  score: z.number().int().min(0, 'Nota mínima é 0').max(10, 'Nota máxima é 10'),
  comment: z.string().max(500, 'Comentário muito longo').optional(),
})
export type NpsSubmitInput = z.infer<typeof npsSubmitSchema>

// ─── Referral program (CRC-05, D-16) ──────────────────────────────────────────

export const referralSchema = z.object({
  referrer_patient_id: z.string().uuid('Paciente indicador inválido'),
  lead_id: z.string().uuid('Lead indicado inválido'),
})
export type ReferralInput = z.infer<typeof referralSchema>

/**
 * D-17: recompensa por indicação — crédito em serviços, valor por indicação
 * configurável. v1 mantém um único valor documentado (constante), sem tabela
 * de configuração nova (18-04-PLAN interfaces) — configurabilidade real fica
 * para uma fase futura (ex.: cadastro por clínica).
 * Lives here (not in referrals.ts) because that file is a 'use server' module
 * and Next.js only allows async function exports from 'use server' files —
 * mirrors D-197 (ai-agent-config-types.ts extraction).
 */
export const REFERRAL_REWARD_DEFAULT = 50.0
