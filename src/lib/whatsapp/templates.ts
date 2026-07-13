// src/lib/whatsapp/templates.ts
// WhatsApp template name constants + component builders for FYNXIA utility templates.
//
// IMPORTANT — UTILITY CATEGORY:
//   Both templates are registered in Meta Business Manager as category=UTILITY.
//   Utility templates must use transactional language only (appointment/billing keywords).
//   Do NOT add promotional wording (e.g. "promoção", "desconto", "aproveite") — Meta
//   auto-reclassifies to marketing (higher cost, opt-in required) since April 2025.
//
// Template copy is registered/approved in Meta; the API resolves {{1}}, {{2}}, etc.
// server-side. Code only supplies parameter values — never the template body text.
import 'server-only'

import type { WhatsAppComponent } from './client'

// ─── Template name constants ──────────────────────────────────────────────────

/** Utility template: appointment reminder 24h before (with quick-reply buttons). */
export const TEMPLATE_APPOINTMENT_REMINDER = 'fynxia_lembrete_consulta'

/** Utility template: collection reminder with Asaas payment link. */
export const TEMPLATE_COLLECTION = 'fynxia_cobranca'

/**
 * Utility template: appointment confirmation request (AI-02 send side).
 *
 * META TEMPLATE NAME CHOICE:
 *   We reuse the same approved quick-reply template as the reminder
 *   ('fynxia_lembrete_consulta') OR register a dedicated confirmation template.
 *   The key difference from buildAppointmentReminderComponents is that the button
 *   payloads include the appointmentId so the inbound webhook (AI-02) can route
 *   the patient's reply back to the correct appointment row.
 *
 *   If a separate template is registered, update this constant to its Meta name.
 *   Using the same template name is valid when the Meta dashboard has the same
 *   quick-reply body and both button payloads use dynamic values.
 */
export const TEMPLATE_APPOINTMENT_CONFIRMATION = TEMPLATE_APPOINTMENT_REMINDER

/** WhatsApp language code for Brazilian Portuguese. */
export const WHATSAPP_LANGUAGE = 'pt_BR'

// ─── Component builders ───────────────────────────────────────────────────────

/**
 * Builds the components array for the appointment reminder template.
 *
 * Template body (registered in Meta):
 *   "Olá, {{1}}! Sua consulta está agendada para {{2}} às {{3}} com {{4}}.
 *    Deseja confirmar ou cancelar?"
 *
 * Buttons (quick_reply):
 *   index 0 — "Confirmar" (payload CONFIRM_APPOINTMENT)
 *   index 1 — "Cancelar"  (payload CANCEL_APPOINTMENT)
 *
 * Button interaction / webhook handling is deferred to Phase 5 (AI-02).
 */
export function buildAppointmentReminderComponents(params: {
  patientName: string
  date: string       // e.g. "15/06/2026"
  time: string       // e.g. "14:00"
  dentistName: string
}): WhatsAppComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.patientName },
        { type: 'text', text: params.date },
        { type: 'text', text: params.time },
        { type: 'text', text: params.dentistName },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 0,
      parameters: [{ type: 'payload', payload: 'CONFIRM_APPOINTMENT' }],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 1,
      parameters: [{ type: 'payload', payload: 'CANCEL_APPOINTMENT' }],
    },
  ]
}

/**
 * Builds the components array for the appointment confirmation template (AI-02 send side).
 *
 * IDENTICAL body parameters to buildAppointmentReminderComponents, but button payloads
 * include the appointmentId so the inbound webhook (route.ts) can route the patient's
 * reply back to the correct appointment row via buttonPayloadToStatus().
 *
 * Buttons (quick_reply):
 *   index 0 — "Confirmar" (payload CONFIRM_APPOINTMENT_<appointmentId>)
 *   index 1 — "Cancelar"  (payload CANCEL_APPOINTMENT_<appointmentId>)
 *
 * BACKWARD COMPAT: buildAppointmentReminderComponents (Phase 4 reminder cron) is
 * intentionally left unchanged — it uses static payloads and is not affected here.
 */
export function buildAppointmentConfirmationComponents(params: {
  patientName: string
  date: string        // e.g. "15/06/2026"
  time: string        // e.g. "14:00"
  dentistName: string
  appointmentId: string // UUID — embedded in button payloads for webhook routing
}): WhatsAppComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.patientName },
        { type: 'text', text: params.date },
        { type: 'text', text: params.time },
        { type: 'text', text: params.dentistName },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 0,
      parameters: [
        { type: 'payload', payload: `CONFIRM_APPOINTMENT_${params.appointmentId}` },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 1,
      parameters: [
        { type: 'payload', payload: `CANCEL_APPOINTMENT_${params.appointmentId}` },
      ],
    },
  ]
}

/**
 * Builds the components array for the collection reminder template.
 *
 * Template body (registered in Meta):
 *   "Olá, {{1}}. Você tem uma cobrança de {{2}} no valor de {{3}}
 *    com vencimento em {{4}}. Acesse para pagar: {{5}}"
 *
 * No interactive buttons — informational only.
 */
export function buildCollectionComponents(params: {
  patientName: string
  description: string   // e.g. "Tratamento Ortodôntico"
  amount: string        // formatted, e.g. "R$ 350,00"
  dueDate: string       // e.g. "15/06/2026"
  paymentLink: string   // Asaas invoice URL
}): WhatsAppComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.patientName },
        { type: 'text', text: params.description },
        { type: 'text', text: params.amount },
        { type: 'text', text: params.dueDate },
        { type: 'text', text: params.paymentLink },
      ],
    },
  ]
}

// ─── Phase 18 (CRC & Marketing) templates ─────────────────────────────────────
//
// IMPORTANT — CATEGORY MISMATCH FROM THE TEMPLATES ABOVE:
//   Unlike TEMPLATE_APPOINTMENT_REMINDER/TEMPLATE_COLLECTION (both UTILITY),
//   TEMPLATE_REACTIVATION below is registered as MARKETING category in Meta —
//   promotional wording ("aproveite", "volte", "desconto") is allowed and
//   expected here, but MARKETING-category sends REQUIRE the recipient to have
//   explicitly opted in (D-08/D-11 — gated on patient_consents.marketing_whatsapp
//   with revoked_at IS NULL). Sending to non-opted-in numbers risks Meta
//   number/quality-rating penalties. See 18-RESEARCH.md Pitfall 8.
//
//   TEMPLATE_NPS_INVITE stays UTILITY (transactional, post-service) — same
//   category logic as TEMPLATE_APPOINTMENT_REMINDER/TEMPLATE_COLLECTION above.

/** Marketing template: reactivation campaign for inactive patients (D-08/D-11). Category: MARKETING. */
export const TEMPLATE_REACTIVATION = 'fynxia_reativacao'

/** Utility template: post-appointment NPS survey invite (D-12/D-13). Category: UTILITY. */
export const TEMPLATE_NPS_INVITE = 'fynxia_pesquisa_nps'

/**
 * Builds the components array for the reactivation campaign template.
 *
 * Template body (registered in Meta, category=MARKETING):
 *   "Olá, {{1}}! Sentimos sua falta na {{2}}. Que tal agendar uma revisão?"
 *
 * patientName carries the LLM-personalized leading text (first name only,
 * per D-09 ZDR/LGPD constraints — mirrors buildCollectionComponents' patientName slot).
 * No interactive buttons — informational only.
 */
export function buildReactivationComponents(params: {
  patientName: string
  clinicName: string
}): WhatsAppComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.patientName },
        { type: 'text', text: params.clinicName },
      ],
    },
  ]
}

/**
 * Builds the components array for the NPS survey invite template.
 *
 * Template body (registered in Meta, category=UTILITY):
 *   "Olá, {{1}}! Como foi seu atendimento? Avalie em: {{2}}"
 *
 * npsLink is the public /nps/[patient-id]/[token] single-use survey URL (D-13).
 * No interactive buttons — informational only.
 */
export function buildNpsInviteComponents(params: {
  patientName: string
  npsLink: string
}): WhatsAppComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.patientName },
        { type: 'text', text: params.npsLink },
      ],
    },
  ]
}
