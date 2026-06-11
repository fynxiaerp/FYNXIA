// src/lib/whatsapp/verify-signature.ts
// Meta WhatsApp Cloud API webhook signature verifier (AI-02).
//
// SECURITY (T-5-webhook-S): All inbound POST requests from Meta carry an
// X-Hub-Signature-256 header of the form "sha256=<hex-digest>" computed with
// HMAC-SHA256 over the raw (unmodified) request body using the Meta App Secret.
// We verify this BEFORE JSON.parse to prevent spoofed webhook calls.
//
// IMPORTANT: rawBody must be the unmodified text from request.text() — calling
// request.json() first consumes the stream and HMAC will always fail (Pitfall 3).
import 'server-only'
import crypto from 'crypto'

/**
 * Verifies a Meta WhatsApp Cloud API webhook signature.
 *
 * @param rawBody      - The raw request body as a string (from request.text()).
 * @param signatureHeader - The X-Hub-Signature-256 header value (e.g. "sha256=abc...").
 * @param appSecret    - The Meta App Secret (WHATSAPP_APP_SECRET env var).
 * @returns true when the signature is valid; false on any mismatch, missing header,
 *          or format error. NEVER throws — all errors result in false.
 *
 * @example
 * const rawBody = await request.text()          // BEFORE JSON.parse
 * const sig = request.headers.get('x-hub-signature-256')
 * if (!verifyWhatsAppSignature(rawBody, sig, process.env.WHATSAPP_APP_SECRET ?? '')) {
 *   return new Response('Forbidden', { status: 403 })
 * }
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  // Reject missing or malformed header (must start with 'sha256=')
  if (!signatureHeader?.startsWith('sha256=')) return false

  const providedHash = signatureHeader.slice(7) // remove 'sha256=' prefix
  const computedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  try {
    // timingSafeEqual prevents timing-attack leakage of the computed hash.
    // Throws if buffers have different byte lengths — catch returns false.
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(providedHash, 'hex'),
    )
  } catch {
    // Length mismatch (truncated/padded hash) → reject
    return false
  }
}
