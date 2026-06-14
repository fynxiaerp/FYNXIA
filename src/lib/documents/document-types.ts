/**
 * Document engine shared types and constants.
 *
 * Extracted into a NON-'use server' module because 'use server' files can only
 * export async functions (Next.js constraint — Pitfall 5 from 08-RESEARCH.md).
 * Pattern established in Phase 7: src/lib/ai-agent-config-types.ts.
 *
 * Imported by Server Actions (document-templates.ts, documents.ts), the signing
 * library (sign-document.ts), and client components.
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-01, DOC-02, DOC-03)
 */

// ─── Document context (variable substitution) ─────────────────────────────────
// Used by fillTemplate() in template-engine.ts. Keys match the {{variable}} names
// embedded in template content. Index signature allows custom per-template variables.

export type DocumentContext = {
  nome_paciente?: string       // patients.full_name
  cpf_paciente?: string        // patients.cpf (PII — encrypt in transit)
  data_nascimento?: string     // patients.date_of_birth formatted pt-BR (dd/MM/yyyy)
  nome_clinica?: string        // clinics.name
  cnpj_clinica?: string        // clinics.cnpj
  nome_profissional?: string   // users.full_name (actor)
  cro_profissional?: string    // users.cro (Phase 11; blank if absent)
  data_documento?: string      // new Date() at generation time, pt-BR (dd/MM/yyyy)
  numero_documento?: string    // sequential, zero-padded (document instance sequence)
  unidade?: string             // units.name from actor's unit (Phase 7)
  [key: string]: string | undefined  // custom per-template variables
}

// ─── Document categories ──────────────────────────────────────────────────────
// Canonical set for the MVP. Category is stored as TEXT in DB so extensions are
// possible without a migration.

export const DEFAULT_DOCUMENT_CATEGORIES = [
  'declaracao',
  'contrato',
  'autorizacao',
  'outro',
] as const

export type DocumentCategory = (typeof DEFAULT_DOCUMENT_CATEGORIES)[number] | string

// ─── Document status ───────────────────────────────────────────────────────────
// Mirrors CHECK constraint in document_tables migration.
// 'draft' → editable (new versions allowed); 'signed' → immutable (D-03).

export type DocumentStatus = 'draft' | 'signed'

// ─── Signature result (from signPdfBuffer in sign-document.ts) ────────────────
// All fields are stored in document_versions (except private key material — never stored).
// certPem is stored for offline offline verification (A2 assumption).

export interface SignatureResult {
  sha256Hex: string            // SHA-256 of final PDF bytes (hex, 64 chars)
  signatureB64: string         // RSA-2048 signature of SHA-256 digest (base64, 344 chars)
  signedAt: string             // ISO 8601 server timestamp
  certSubjectCn: string        // cert.subject.CN — signer display name
  certThumbprintSha1: string   // 40-char hex SHA-1 thumbprint
  certNotAfter: string         // ISO 8601 cert validity expiry at signing time
  certPem: string              // PEM of signing cert (for offline verification)
}
