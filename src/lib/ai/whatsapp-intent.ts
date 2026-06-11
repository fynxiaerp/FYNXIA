// src/lib/ai/whatsapp-intent.ts
// AI-02 intent helpers: button payload → appointment status mapper + LLM free-text classifier.
//
// SECURITY (T-5-intent / D-04):
//   - Button payloads are deterministic (no LLM) — zero hallucination risk.
//   - Free-text uses LLM only as a FALLBACK. The safe default is 'ambiguous', which
//     causes NO status change and logs the message for human review.
//   - If AI_GATEWAY_API_KEY is absent, classifyConfirmationIntent returns 'ambiguous'
//     (safe fallback, no throw) — the webhook degrades gracefully.
import 'server-only'
import { generateText } from 'ai'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'

// ─── Button payload → appointment status (pure, no LLM) ─────────────────────

const CONFIRM_PREFIX = 'CONFIRM_APPOINTMENT_'
const CANCEL_PREFIX = 'CANCEL_APPOINTMENT_'

/**
 * Maps a WhatsApp quick-reply button payload to an appointment status update.
 *
 * Payload format (set at template registration time):
 *   CONFIRM_APPOINTMENT_<appointmentId>  →  { appointmentId, status: 'confirmado' }
 *   CANCEL_APPOINTMENT_<appointmentId>   →  { appointmentId, status: 'cancelado' }
 *
 * Returns null for any unrecognised payload — callers must treat null as "no action"
 * (safe fallback; D-04 principle applied to pure button path as well).
 *
 * @example
 * buttonPayloadToStatus('CONFIRM_APPOINTMENT_abc-123')
 * // → { appointmentId: 'abc-123', status: 'confirmado' }
 *
 * buttonPayloadToStatus('UNKNOWN_PAYLOAD')
 * // → null
 */
export function buttonPayloadToStatus(
  payload: string,
): { appointmentId: string; status: 'confirmado' | 'cancelado' } | null {
  if (payload.startsWith(CONFIRM_PREFIX)) {
    const appointmentId = payload.slice(CONFIRM_PREFIX.length)
    if (!appointmentId) return null
    return { appointmentId, status: 'confirmado' }
  }

  if (payload.startsWith(CANCEL_PREFIX)) {
    const appointmentId = payload.slice(CANCEL_PREFIX.length)
    if (!appointmentId) return null
    return { appointmentId, status: 'cancelado' }
  }

  return null
}

// ─── LLM free-text intent classifier (safe fallback) ────────────────────────

export type ConfirmationIntent = 'confirm' | 'cancel' | 'ambiguous'

/**
 * Classifies a free-text WhatsApp reply into a confirmation intent.
 *
 * Uses Vercel AI Gateway + claude-sonnet-4.6 with ZDR (D-02 / LGPD).
 * AI_GATEWAY_API_KEY is read at call-time (never module scope — Pitfall 2).
 *
 * SAFE FALLBACK: Returns 'ambiguous' when:
 *   - AI_GATEWAY_API_KEY is absent (env not configured).
 *   - The LLM returns anything other than 'confirm' or 'cancel'.
 *   - Any error occurs during the LLM call.
 *
 * Callers must treat 'ambiguous' as NO status change + log for human review.
 *
 * @param text - The raw free-text body from the WhatsApp inbound message.
 * @returns 'confirm' | 'cancel' | 'ambiguous'
 */
export async function classifyConfirmationIntent(
  text: string,
): Promise<ConfirmationIntent> {
  // D-02 / Pitfall 2 — read AI_GATEWAY_API_KEY at call-time (never module scope)
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    // Safe fallback: no key configured → treat as ambiguous (no status change)
    return 'ambiguous'
  }

  try {
    const { text: result } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      system:
        'Classify the patient intent from a WhatsApp reply to an appointment confirmation request. ' +
        'The patient is replying to: "Deseja confirmar ou cancelar sua consulta?" ' +
        'Respond with exactly one word: confirm, cancel, or ambiguous. ' +
        'Use "ambiguous" when the reply is unclear, off-topic, or not clearly confirm/cancel.',
      messages: [{ role: 'user', content: [{ type: 'text', text }] }],
      providerOptions: {
        gateway: {
          zeroDataRetention: true, // D-02: LGPD — no retention of patient message content
        } satisfies GatewayProviderOptions,
      },
      maxOutputTokens: 10, // classification only — enforce minimal token usage
    })

    const intent = result.trim().toLowerCase()
    if (intent === 'confirm') return 'confirm'
    if (intent === 'cancel') return 'cancel'
    return 'ambiguous' // safe fallback for unexpected LLM output
  } catch {
    // Any LLM error → safe fallback (no throw — callers must not fail on AI unavailability)
    return 'ambiguous'
  }
}
