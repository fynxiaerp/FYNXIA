// src/lib/whatsapp/inbound-types.ts
// TypeScript types for Meta WhatsApp Cloud API inbound webhook payloads (AI-02).
//
// Confidence: MEDIUM — payload shape derived from hookdeck.com guide cross-referenced
// with Meta webhook documentation structure. The button_reply variant may arrive as
// type 'button' OR type 'interactive' depending on the template interaction type.
// The webhook handler supports BOTH (T-5-webhook-S defence in depth).
//
// Sources:
//   - https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices
//   - https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

// ─── Top-level envelope ───────────────────────────────────────────────────────

export interface WhatsAppInboundPayload {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      field: 'messages'
      value: {
        messaging_product: 'whatsapp'
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        /** Present when the event carries user messages (text, button, interactive). */
        messages?: WhatsAppInboundMessage[]
        /** Present when the event is a status update (sent/delivered/read/failed). */
        statuses?: WhatsAppStatusUpdate[]
      }
    }>
  }>
}

// ─── Inbound message union ────────────────────────────────────────────────────

/**
 * A user message received via WhatsApp. Three variants are relevant to AI-02:
 *
 * 1. `text` — free-text reply; classified by LLM (safe fallback: ambiguous).
 * 2. `button` — quick-reply button tap on a non-interactive template; the
 *    `button.payload` field carries the registered payload string (e.g.
 *    "CONFIRM_APPOINTMENT_<uuid>").
 * 3. `interactive` (button_reply) — interactive template button tap; the
 *    `interactive.button_reply.id` field carries the registered payload string.
 *
 * Both button variants are handled by `buttonPayloadToStatus` in whatsapp-intent.ts.
 */
export type WhatsAppInboundMessage =
  | {
      id: string
      from: string
      timestamp: string
      type: 'text'
      text: { body: string }
    }
  | {
      id: string
      from: string
      timestamp: string
      type: 'button'
      button: {
        text: string    // button label shown to user
        payload: string // payload registered with the template (e.g. "CONFIRM_APPOINTMENT_<id>")
      }
    }
  | {
      id: string
      from: string
      timestamp: string
      type: 'interactive'
      interactive: {
        type: 'button_reply'
        button_reply: {
          id: string    // payload registered with the interactive template
          title: string // button label shown to user
        }
      }
    }

// ─── Status update ────────────────────────────────────────────────────────────

/** A delivery/read status update for a previously sent outbound message. */
export interface WhatsAppStatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  recipient_id: string
  timestamp: string
  errors?: Array<{ code: number; title: string }>
}
