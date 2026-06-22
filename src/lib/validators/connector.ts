/**
 * Validator: integration connector form
 *
 * Phase 9 Plan 02 / INT-01:
 * - connectorFormSchema validates the form fields for registering/updating a connector.
 * - Zod v3 (project pins v3 — do NOT use Zod v4 API or .default() on fields that RHF supplies).
 * - status field: use z.enum without .default() to avoid @hookform/resolvers v5 input/output
 *   type mismatch (Phase 8 decision D-133). Let form defaultValues supply the 'disabled' default.
 */
import { z } from 'zod'

// ─── Connector type enum ──────────────────────────────────────────────────────

export const connectorTypeSchema = z.enum([
  'asaas',
  'whatsapp',
  'email',
  'nfse',
  'banco',
  'tiss',
  'reinf',
  'open_finance',
])

export type ConnectorTypeInput = z.infer<typeof connectorTypeSchema>

// ─── Connector form schema ────────────────────────────────────────────────────

export const connectorFormSchema = z.object({
  /** Connector type — determines which credential format is expected. */
  type: connectorTypeSchema,

  /**
   * Raw credential (API key, token, client secret).
   * Encrypted before being stored in credential_enc via src/lib/crypto.ts.
   * Required (min 1) so blank submissions are rejected (V5 ASVS input validation).
   * Max 2000 chars covers base64-encoded keys and long tokens.
   */
  credential: z.string().min(1, 'Credencial obrigatória').max(2000, 'Credencial muito longa'),

  /**
   * Non-sensitive configuration metadata (endpoint URLs, template IDs, phone numbers).
   * Stored in the config JSONB column — NEVER put secrets here.
   * Optional: defaults to empty on the DB side.
   */
  config: z.record(z.string(), z.unknown()).optional(),

  /**
   * Connector status. No .default() here to avoid resolvers v5 input/output type mismatch.
   * Form must supply defaultValues: { status: 'disabled' }.
   */
  status: z.enum(['enabled', 'disabled']),
})

export type ConnectorFormInput = z.infer<typeof connectorFormSchema>

// ─── Update schema (credential optional on update) ───────────────────────────

/**
 * On update, the credential is optional: if absent (empty string or missing),
 * the existing encrypted credential is preserved.
 * The action checks: if credential is provided and non-empty → re-encrypt; else leave as-is.
 */
export const connectorUpdateSchema = z.object({
  id: z.string().uuid('ID de conector inválido'),
  type: connectorTypeSchema,
  credential: z.string().max(2000, 'Credencial muito longa').optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['enabled', 'disabled']),
})

export type ConnectorUpdateInput = z.infer<typeof connectorUpdateSchema>
