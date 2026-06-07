// src/lib/whatsapp/client.ts
// Meta WhatsApp Cloud API typed fetch wrapper (no SDK — mirrors asaas/client.ts pattern)
// T-4-wa-token: token is server-only — NEVER use NEXT_PUBLIC_ prefix for WHATSAPP_ACCESS_TOKEN
import 'server-only'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhatsAppTemplateParams {
  to: string                     // E.164 format: +5511999999999
  templateName: string           // approved template name (e.g. fynxia_lembrete_consulta)
  languageCode: string           // 'pt_BR'
  components?: WhatsAppComponent[]
}

export interface WhatsAppComponent {
  type: 'body' | 'button'
  sub_type?: 'quick_reply'
  index?: number
  parameters: WhatsAppParameter[]
}

export type WhatsAppParameter =
  | { type: 'text'; text: string }
  | { type: 'payload'; payload: string }

export interface WhatsAppSendResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

// ─── Permanent error codes (no retry — RESEARCH Pitfall 6) ───────────────────

/**
 * Returns true when the error code represents a permanent failure that should
 * not be retried. Transient errors (e.g. 130429 rate limit, network) are retryable.
 *
 * Permanent codes:
 *   131026 — message undeliverable (recipient not on WhatsApp or blocked)
 *   132000 — template not found or not approved
 *   132001 — template parameter count mismatch
 *   190    — invalid or expired access token
 */
export function isPermanentError(code?: number): boolean {
  return [131026, 132000, 132001, 190].includes(code ?? -1)
}

// ─── sendTemplateMessage ──────────────────────────────────────────────────────

/**
 * Sends a WhatsApp template message via Meta Cloud API v21.0.
 *
 * Credentials are read at CALL TIME (not module scope) so that a missing env
 * var during `next build` static analysis does not throw (RESEARCH Pitfall 2).
 *
 * Returns { success: false, error: 'WhatsApp credentials not configured' }
 * when WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN are absent.
 */
export async function sendTemplateMessage(
  params: WhatsAppTemplateParams
): Promise<WhatsAppSendResult> {
  // Call-time credential reads — Pitfall 2
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  const body = {
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components: params.components ?? [],
    },
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as {
      error?: { code?: number; message?: string }
    }
    return {
      success: false,
      error: errBody?.error?.message ?? `HTTP ${res.status}`,
      errorCode: errBody?.error?.code,
    }
  }

  const data = await res.json() as { messages?: Array<{ id: string }> }
  return { success: true, messageId: data.messages?.[0]?.id }
}
