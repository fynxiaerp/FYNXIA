import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ENCRYPTION_KEY must be a 64-char hex string (32 bytes) stored in Vercel env vars.
// Never use NEXT_PUBLIC_ prefix — server-only (pitfall C-2 pattern).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited hex string: "iv:authTag:ciphertext"
 * GCM mode provides both confidentiality AND integrity (via auth tag).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // GCM standard: 96-bit IV
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag() // GCM authentication tag for integrity

  // Format: iv:authTag:ciphertext — all hex-encoded, colon-delimited
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a string produced by encrypt().
 * Verifies the GCM auth tag — throws if ciphertext was tampered with.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  const ivHex = parts[0]
  const authTagHex = parts[1]
  const encryptedHex = parts[2]

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format — expected iv:authTag:ciphertext')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8'
  )
}

/**
 * Encrypts a JSON-serializable object (e.g., users.sensitive_data).
 */
export function encryptJSON(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data))
}

/**
 * Decrypts and parses a JSON object produced by encryptJSON().
 */
export function decryptJSON<T>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T
}
