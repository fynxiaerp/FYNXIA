import { z } from 'zod'
import { createHash } from 'node:crypto'

// ─── CFO Questions (Questionário de Anamnese CFO fixo) ──────────────────────
// D-18: perguntas obrigatórias do questionário CFO para anamnese odontológica.

export interface CfoQuestion {
  key: string
  label: string
}

export const CFO_QUESTIONS: CfoQuestion[] = [
  { key: 'alergia_medicamento', label: 'Possui alergia a algum medicamento?' },
  { key: 'alergia_anestesia', label: 'Possui alergia a anestesia local?' },
  { key: 'hipertensao', label: 'É hipertenso (pressão alta)?' },
  { key: 'diabetes', label: 'É diabético?' },
  { key: 'problema_cardiaco', label: 'Possui problema cardíaco?' },
  { key: 'gravidez', label: 'Está grávida (para pacientes do sexo feminino)?' },
  { key: 'uso_medicamento_continuo', label: 'Faz uso de medicamento de uso contínuo?' },
  { key: 'problema_coagulacao', label: 'Possui problema de coagulação sanguínea?' },
  { key: 'problema_renal', label: 'Possui problema renal?' },
  { key: 'problema_respiratorio', label: 'Possui problema respiratório (asma, bronquite)?' },
  { key: 'cirurgia_recente', label: 'Passou por cirurgia nos últimos 6 meses?' },
  { key: 'hepatite_ou_aids', label: 'É portador de hepatite ou HIV/AIDS?' },
]

// ─── Anamnesis Zod Schema (v3) ───────────────────────────────────────────────

// Responses are a record of boolean answers keyed by CFO_QUESTIONS keys.
// Exported so the service-role public/presencial flows can validate the
// untrusted `responses` payload before persisting it (CR-02). `.strict()`
// rejects unknown keys; `observacoes` is length-bounded to close the public
// JSONB injection surface (IN-01).
export const cfoResponsesSchema = z
  .object({
    alergia_medicamento: z.boolean(),
    alergia_anestesia: z.boolean(),
    hipertensao: z.boolean(),
    diabetes: z.boolean(),
    problema_cardiaco: z.boolean(),
    gravidez: z.boolean(),
    uso_medicamento_continuo: z.boolean(),
    problema_coagulacao: z.boolean(),
    problema_renal: z.boolean(),
    problema_respiratorio: z.boolean(),
    cirurgia_recente: z.boolean(),
    hepatite_ou_aids: z.boolean(),
    observacoes: z.string().max(2000).optional(),
  })
  .strict()

export const anamnesisSchema = z.object({
  responses: cfoResponsesSchema,
  // signature is a data URL (image/png base64) — required; non-empty
  signature: z.string().min(1, 'Assinatura é obrigatória'),
})

export type AnamnesisInput = z.infer<typeof anamnesisSchema>
export type CfoResponses = z.infer<typeof cfoResponsesSchema>

// ─── SHA-256 of PNG DataURL ──────────────────────────────────────────────────
// RESEARCH Padrão 6 — pure function, Node.js built-in crypto.
// Strips the data URI prefix, decodes base64, computes SHA-256 hex (64 chars).

export function sha256OfPngDataUrl(dataUrl: string): string {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buf = Buffer.from(base64, 'base64')
  return createHash('sha256').update(buf).digest('hex')
}

// ─── isTokenValid ────────────────────────────────────────────────────────────
// T-2-07: single-use + expiry guard.
// Returns true ONLY if token_used_at IS NULL AND token_expires_at > now.

export function isTokenValid(
  row: { token_used_at: string | null; token_expires_at: string | null },
  now: Date
): boolean {
  if (row.token_used_at !== null) return false
  if (row.token_expires_at === null) return false
  return new Date(row.token_expires_at) > now
}
