/**
 * Validator: teleconsultation session + SOAP record (TEL-01, TEL-02)
 *
 * Phase 12:
 * - teleconsultationSchema: form validation for creating a teleconsultation session.
 *   external_link is validated as a URL (z.string().url()) — Meet/Zoom/Jitsi link (D-03).
 *   consent_given is a boolean flag captured from the form; the authoritative
 *   consent_given_at and consent_ip are set server-side in Plan 04's createTeleconsultation
 *   action from request headers — they are NOT part of this client-side schema.
 * - soapSchema: form validation for SOAP structured notes (TEL-02).
 *   All four SOAP columns (subjective/objective/assessment/plan) are optional text
 *   so clinicians can save partial notes.
 *
 * No default values on any field — follows D-133/D-158 decision:
 * RHF v7 + @hookform/resolvers v5 reject schemas with Zod default() due to
 * input/output type mismatch. Form defaultValues supply the initial values.
 *
 * Safe to import in both server and client contexts (no 'use server' directive).
 */
import { z } from 'zod'

// ─── teleconsultationSchema (TEL-01) ─────────────────────────────────────────

/**
 * Validates the input for creating a teleconsultation session.
 *
 * Fields:
 *   patient_id      — required UUID of the patient
 *   appointment_id  — optional UUID linking to an existing appointment
 *   professional_id — optional UUID of the professional conducting the session
 *   external_link   — validated URL (Meet/Zoom/Jitsi) — D-03: video = external link only
 *   consent_given   — CFO regulatory consent boolean (TEL-01); server sets consent_given_at + consent_ip
 *   notes           — optional session notes
 *
 * LGPD: consent_given_at and consent_ip are server-side only (Plan 04) — not exposed here.
 * Max 2000 chars for external_link matches TEXT column intent; URL() validates format.
 */
export const teleconsultationSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),
  external_link: z.string().url().max(2000),
  consent_given: z.boolean(),
  notes: z.string().max(2000).optional(),
})

export type TeleconsultationInput = z.infer<typeof teleconsultationSchema>

// ─── soapSchema (TEL-02) ─────────────────────────────────────────────────────

/**
 * Validates the input for creating a SOAP structured clinical note.
 *
 * SOAP columns (all optional — clinicians may save partial notes):
 *   soap_subjective  — S: queixa principal, sintomas relatados pelo paciente
 *   soap_objective   — O: exame clínico, achados objetivos
 *   soap_assessment  — A: avaliação/diagnóstico
 *   soap_plan        — P: plano de tratamento/conduta
 *
 * Links:
 *   patient_id          — required: identifies the patient
 *   appointment_id      — optional: links to existing atendimento
 *   teleconsultation_id — optional: links to an existing teleconsultation session (TEL-02)
 *
 * NOTE: soap_records is a NEW table separate from medical_records (free-text) and
 * dental_records (FDI odontogram) — Pitfall 5. dentist_id is set server-side from
 * the authenticated actor in Plan 04's createSoapRecord action.
 */
export const soapSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  teleconsultation_id: z.string().uuid().optional(),
  soap_subjective: z.string().max(4000).optional(),
  soap_objective: z.string().max(4000).optional(),
  soap_assessment: z.string().max(4000).optional(),
  soap_plan: z.string().max(4000).optional(),
})

export type SoapInput = z.infer<typeof soapSchema>
