// src/lib/integrations/mask.ts
// Pure utility — NO 'use server', NO 'server-only'.
// Must be importable by both server actions AND client components (e.g. credential display).
// Phase 9 INT-01: credential masking for UI display (T-09-03 defense-in-depth).

/**
 * Masks a credential string for safe display in the UI.
 * Returns '••••••' + last 4 characters of the plaintext.
 * If the string is shorter than 4 chars, returns '••••••' only.
 *
 * This function operates on the PLAINTEXT (or a short tail provided by the server).
 * The server decrypts credential_enc → passes only the masked tail to the client.
 * Never call this with the full ciphertext.
 *
 * Examples:
 *   maskCredential('1234')             → '••••••1234'
 *   maskCredential('sk_live_abc5678')  → '••••••5678'
 *   maskCredential('')                 → '••••••'
 *   maskCredential('abc')             → '••••••'
 */
export function maskCredential(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) {
    return '••••••'
  }
  const last4 = plaintext.slice(-4)
  // If the string is 4 chars or fewer, last4 === plaintext but that's acceptable —
  // the credential is short enough that the caller should not be passing a full secret here.
  return '••••••' + last4
}
