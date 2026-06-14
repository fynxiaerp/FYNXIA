/**
 * Validator: certificate upload
 *
 * SYS-02 / Plan 07-06:
 * - certificateSchema validates the form fields for ICP-Brasil A1 .pfx upload.
 * - file: must be present, MIME or extension must be .pfx or .p12, size ≤ 5 MB.
 * - password: non-empty.
 *
 * Note: File objects can't be easily validated with Zod in all environments.
 * We validate via a plain object shape that the Server Action receives from FormData.
 */
import { z } from 'zod'

/** 5 MB in bytes */
export const MAX_CERT_SIZE_BYTES = 5 * 1024 * 1024

export const ALLOWED_CERT_TYPES = [
  'application/x-pkcs12',
  'application/pkcs12',
  // Browsers often send .pfx as these types too
  'application/octet-stream',
] as const

export const ALLOWED_CERT_EXTENSIONS = ['.pfx', '.p12'] as const

/**
 * certificateSchema — validates the uploadable certificate fields.
 *
 * Used in the Server Action to reject oversized or wrong-type files before
 * forwarding to storage. The File object from FormData is validated separately
 * (extension + size) in the action because Zod can't easily inspect File/Blob
 * objects portably across Node.js versions.
 *
 * This schema validates the extracted fields:
 *   - filename: must end with .pfx or .p12 (case-insensitive)
 *   - sizeBytes: must be ≤ 5 MB
 *   - password: non-empty
 */
export const certificateSchema = z.object({
  filename: z
    .string()
    .min(1, 'Nome do arquivo é obrigatório')
    .refine(
      (name) =>
        ALLOWED_CERT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
      { message: 'Somente arquivos .pfx ou .p12 são aceitos' }
    ),
  sizeBytes: z
    .number()
    .int()
    .positive('Arquivo inválido')
    .max(MAX_CERT_SIZE_BYTES, `O arquivo deve ter no máximo 5 MB`),
  password: z.string().min(1, 'A senha do certificado é obrigatória'),
})

export type CertificateInput = z.infer<typeof certificateSchema>
