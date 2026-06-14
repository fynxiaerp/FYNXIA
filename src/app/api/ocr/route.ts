// src/app/api/ocr/route.ts
// POST /api/ocr — multimodal document OCR via AI Gateway (generateObject + FilePart)
// OCR-01: uploads image/PDF → structured per-field extraction with confidence
// OCR-02: below-threshold fields → ocr_extractions inserted as 'pending_review'
//
// Security / LGPD:
//   T-10-20: zeroDataRetention:true on every Gateway call (no PII retained at gateway)
//   T-10-21: maskCPF applied before any log — never console.log raw extracted object
//   T-10-22: MIME allowlist (image/jpeg, image/png, image/webp, application/pdf) + 4 MB size guard
//   T-10-25: auth.getUser() gate → 401 if unauthenticated
import 'server-only'
export const runtime = 'nodejs'

import { generateObject } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskCPF } from '@/lib/ai/masking'
import { needsReview, minConfidence } from '@/lib/ai/ocr-confidence'

// ─── Allowed MIME types (T-10-22: malicious upload guard) ────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

// ─── Max file size: 4 MB (Vercel nodejs body limit ~4.5 MB — RESEARCH A2) ────

const MAX_FILE_BYTES = 4 * 1024 * 1024

// ─── Zod schema: per-field value + confidence (0–1) ─────────────────────────
// Pilot form: patient document (RG / comprovante de residência)
// Fields: full_name, cpf, birth_date, address

const PatientDocumentSchema = z.object({
  full_name: z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  cpf: z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  birth_date: z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  address: z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }),
})

// ─── POST /api/ocr ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // T-10-25: auth gate — 401 if unauthenticated (mirrors copilot/route.ts)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // D-02 / Pitfall 2 — read AI_GATEWAY_API_KEY at call-time (never module scope)
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI gateway not configured' }, { status: 503 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'Campo "file" é obrigatório' }, { status: 400 })
  }

  // T-10-22: MIME allowlist — reject unsupported file types
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return Response.json(
      {
        error: `Tipo de arquivo não permitido: ${file.type}. Use JPEG, PNG, WebP ou PDF.`,
      },
      { status: 415 }
    )
  }

  // T-10-22: Size guard — reject files > 4 MB (RESEARCH A2: Vercel body limit ~4.5 MB)
  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: 'Arquivo excede 4 MB. Comprima a imagem ou use um PDF menor.' },
      { status: 413 }
    )
  }

  // ─── CR-03: Tenant guard BEFORE AI call ─────────────────────────────────────
  // Resolve clinic_id early — fail fast before sending the document to the AI
  // provider. If the user has no tenant_id, return 403 (not 500 from INSERT).
  // LGPD: prevents sending PII documents to AI Gateway for users with no clinic.
  const admin = createAdminClient()
  const { data: userRow } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const clinicId = (userRow as { tenant_id: string } | null)?.tenant_id
  if (!clinicId) {
    console.error('[ocr] User has no tenant_id — rejecting before AI call', { userId: user.id })
    return Response.json({ error: 'Usuário sem clínica associada.' }, { status: 403 })
  }

  // Encode to base64 for FilePart
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type

  // ─── AI Gateway — generateObject + FilePart + ZDR (OCR-01) ────────────────
  // T-10-20: zeroDataRetention:true on every Gateway call (Pitfall 4 — LGPD)
  // CR-01: wrapped in try/catch — AI Gateway errors (rate limit, network, schema
  // validation) must return a clean JSON 502, never a raw stack trace.
  // LGPD: error body is NOT logged — it may echo prompt content or PII.
  let object: z.infer<typeof PatientDocumentSchema>
  try {
    const aiResult = await generateObject({
      model: 'anthropic/claude-sonnet-4.6', // vision-capable model in GatewayModelId
      schema: PatientDocumentSchema,
      messages: [
        {
          role: 'user',
          content: [
            // FilePart: base64-encoded document image/PDF (AI SDK v6 FilePart)
            // Note: AI SDK v6 FilePart uses 'mediaType' (not 'mimeType') — @ai-sdk/provider-utils
            { type: 'file', data: base64, mediaType: mimeType } as const,
            {
              type: 'text',
              text: [
                'Analise o documento e extraia os campos a seguir em português do Brasil.',
                'Para cada campo, forneça:',
                '  - value: o valor extraído do documento (string vazia se não encontrado)',
                '  - confidence: score de confiança de 0.0 (baixo) a 1.0 (alto)',
                '',
                'Campos a extrair:',
                '  - full_name: nome completo do titular',
                '  - cpf: CPF no formato 000.000.000-00',
                '  - birth_date: data de nascimento no formato YYYY-MM-DD',
                '  - address: endereço completo (logradouro, número, bairro, cidade, estado)',
              ].join('\n'),
            },
          ],
        },
      ],
      providerOptions: {
        gateway: {
          zeroDataRetention: true, // T-10-20: LGPD — Gateway retains no prompt/response PII
        } satisfies GatewayProviderOptions,
      },
    })
    object = aiResult.object
  } catch (aiErr) {
    // Do NOT log the full error — it may echo prompt content (LGPD / T-10-21)
    console.error('[ocr] AI Gateway error:', (aiErr as Error).message)
    return Response.json({ error: 'Falha no serviço de IA. Tente novamente.' }, { status: 502 })
  }

  // ─── Confidence gating (OCR-02) ───────────────────────────────────────────
  const review = needsReview(object)
  const minConf = minConfidence(object)
  const status = review ? 'pending_review' : 'approved'

  // ─── Persist to ocr_extractions ──────────────────────────────────────────
  // admin + clinicId already resolved above (CR-03: tenant guard before AI call)
  const { data: extraction, error: insertError } = await admin
    .from('ocr_extractions')
    .insert({
      clinic_id: clinicId,
      created_by: user.id,
      source_filename: file.name,
      extracted_fields: object,
      min_confidence: minConf,
      status,
      target_table: 'patients', // OCR pilot form
    })
    .select('id')
    .single()

  if (insertError || !extraction) {
    // T-10-21: log error only — NEVER log the raw object (contains CPF)
    // maskCPF applied if CPF value is referenced in any diagnostic output
    console.error('[ocr] Failed to insert extraction:', insertError?.message)
    return Response.json({ error: 'Falha ao salvar extração' }, { status: 500 })
  }

  // T-10-21: LGPD — log extraction ID + masked CPF only (Pitfall 3: no raw CPF in logs)
  // maskCPF ensures the CPF field value is never exposed in server logs
  const maskedCpf = maskCPF(object.cpf.value)
  console.log(
    `[ocr] extraction=${extraction.id} status=${status} cpf=${maskedCpf} minConfidence=${minConf}`
  )

  return Response.json({
    extractionId: extraction.id,
    needsReview: review,
    fields: object,
  })
}
