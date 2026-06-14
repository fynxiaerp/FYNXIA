import 'server-only'
/**
 * ICP-Brasil document signing library.
 *
 * signPdfBuffer: loads the .pfx from the private 'icp-certificates' bucket via
 * service role, decrypts the password in memory, extracts the private key, and
 * signs the SHA-256 digest of the final PDF bytes using RSA direct signing
 * (node-forge, same API pinned by sign-document.test.ts in Plan 01).
 *
 * verifyPdfSignature: verifies a stored base64 RSA signature against the PDF
 * bytes using the stored cert PEM. Uses a fresh MessageDigest object (Pitfall 2).
 *
 * SECURITY (T-08-03):
 *   - import 'server-only' prevents accidental client bundle inclusion.
 *   - Private key is loaded in RAM only; never serialized, returned, or logged.
 *   - certPasswordEnc is decrypted in-process via src/lib/crypto.ts (AES-256-GCM).
 *   - The .pfx bytes are fetched via createAdminClient() (service role); never a public URL.
 *
 * ALGORITHM (must match sign-document.test.ts — DO NOT change without updating tests):
 *   sha256Hex   = createHash('sha256').update(pdfBuffer).digest('hex')
 *   md.update(pdfBuffer.toString('binary'), 'raw')
 *   signatureB64 = forge.util.encode64(privateKey.sign(md))   // 344 chars for 2048-bit RSA
 *   verify: fresh md2; (cert.publicKey as rsa.PublicKey).verify(md2.digest().bytes(), decoded)
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-02)
 */

import { createHash } from 'crypto'
import forge from 'node-forge'
import { decrypt } from '@/lib/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SignatureResult } from '@/lib/documents/document-types'

// ─── OID constants (same fallbacks as pfx-metadata.ts / Plan 01 test) ─────────
const CERT_BAG_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
const KEY_BAG_OID  = forge.pki.oids.pkcs8ShroudedKeyBag ?? '1.2.840.113549.1.12.10.1.2'

/**
 * Signs the final PDF Buffer using the ICP-Brasil certificate stored in the
 * private 'icp-certificates' bucket.
 *
 * @param pdfBuffer       Final rendered PDF bytes (renderToBuffer output). MUST
 *                        be the exact bytes uploaded to Storage — Pitfall 1 (sign
 *                        the frozen final PDF, never a re-render).
 * @param certStoragePath Path inside the 'icp-certificates' bucket (from certificates row).
 * @param certPasswordEnc AES-256-GCM encrypted password string (from certificates row).
 * @returns               SignatureResult with hash, signature, cert identity fields.
 */
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  certStoragePath: string,
  certPasswordEnc: string
): Promise<SignatureResult> {
  // 1. Decrypt certificate password in-process (plaintext never persisted — T-08-03)
  const password = decrypt(certPasswordEnc)

  // 2. Download .pfx bytes from private bucket via service role
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('icp-certificates')
    .download(certStoragePath)
  if (error || !data) {
    throw new Error('Certificado não encontrado no keystore')
  }
  const pfxBuffer = Buffer.from(await data.arrayBuffer())

  // 3. Load PKCS#12 — same sequence as pfx-metadata.ts (Phase 7 verified pattern)
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer))
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  // 4. Extract certificate + private key bags (OID fallbacks from pfx-metadata.ts)
  const cert = pfx.getBags({ bagType: CERT_BAG_OID })[CERT_BAG_OID]?.[0]?.cert
  const privateKey = pfx.getBags({ bagType: KEY_BAG_OID })[KEY_BAG_OID]?.[0]?.key
  if (!cert || !privateKey) {
    throw new Error('Chave privada ou certificado não encontrado no .pfx')
  }

  // 5. SHA-256 of PDF bytes via Node crypto (consistent with forge — Pitfall 3 verified)
  const sha256Hex = createHash('sha256').update(pdfBuffer).digest('hex')

  // 6. RSA sign: forge needs a binary string representation of the Buffer (Pitfall 3)
  const md = forge.md.sha256.create()
  md.update(pdfBuffer.toString('binary'), 'raw')
  const signature = (privateKey as forge.pki.rsa.PrivateKey).sign(md)
  const signatureB64 = forge.util.encode64(signature)

  // 7. Cert identity fields (for storage in document_versions)
  const certSubjectCn =
    (cert.subject.getField('CN') as { value: string } | null)?.value ?? ''

  // SHA-1 thumbprint via certificateToAsn1 — Pitfall 4: cert.toAsn1() does not exist
  const mdSha1 = forge.md.sha1.create()
  mdSha1.update(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  )
  const certThumbprintSha1 = mdSha1.digest().toHex()

  const certPem = forge.pki.certificateToPem(cert)

  return {
    sha256Hex,
    signatureB64,
    signedAt: new Date().toISOString(),
    certSubjectCn,
    certThumbprintSha1,
    certNotAfter: cert.validity.notAfter.toISOString(),
    certPem,
  }
}

/**
 * Verifies a stored RSA base64 signature against PDF bytes.
 * Uses a FRESH MessageDigest object — Pitfall 2: md is consumed after sign();
 * a second call to md.digest() on the same object returns wrong bytes.
 *
 * IN-01: Returns a discriminated result so callers can distinguish a genuine
 * invalid signature (valid=false, no error) from an unexpected forge exception
 * (valid=false, error set). This prevents misleading "invalid signature" UI
 * when the failure is actually a malformed certPem or an internal forge error.
 *
 * @param pdfBuffer    Original PDF bytes (from Storage or re-render of same content).
 * @param signatureB64 RSA signature (base64, 344 chars for 2048-bit RSA).
 * @param certPem      PEM of the signing certificate (stored in document_versions.cert_pem).
 * @returns            { valid: boolean; error?: string }
 */
export function verifyPdfSignature(
  pdfBuffer: Buffer,
  signatureB64: string,
  certPem: string
): { valid: boolean; error?: string } {
  try {
    const sig = forge.util.decode64(signatureB64)
    const cert = forge.pki.certificateFromPem(certPem)
    // Fresh md2 — Pitfall 2: never reuse the md from signing
    const md2 = forge.md.sha256.create()
    md2.update(pdfBuffer.toString('binary'), 'raw')
    const valid = (cert.publicKey as forge.pki.rsa.PublicKey).verify(md2.digest().bytes(), sig)
    return { valid }
  } catch (err) {
    // Log unexpected forge errors so operators can diagnose malformed certs or inputs.
    // Do NOT re-throw — callers receive valid=false with a stable error message.
    console.error('[verifyPdfSignature] forge error:', err)
    return { valid: false, error: 'Erro interno na verificação criptográfica' }
  }
}
