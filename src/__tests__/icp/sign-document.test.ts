/**
 * ICP-Brasil document signing — crypto round-trip test (GREEN from Wave 0)
 *
 * This test exercises node-forge + the Phase 7 test-cert.pfx fixture directly.
 * It does NOT import src/lib/icp/sign-document.ts (Plan 02 target) — it PINS
 * the exact signing algorithm that Plan 02 must reproduce.
 *
 * Result: GREEN from first run. Locks down:
 *   - PKCS#12 load sequence (mirrors pfx-metadata.ts exactly)
 *   - SHA-256 consistency between Node crypto and forge
 *   - RSA sign produces exactly 344 base64 chars (2048-bit key)
 *   - Verify with fresh md2 + cert public key returns true
 *   - Thumbprint via forge.pki.certificateToAsn1 is 40-char hex
 *
 * Plan 02 MUST produce matching output for the same inputs.
 *
 * Phase: 08-documentos-assinatura-icp-brasil / Plan 01 (Wave 0 RED scaffold)
 * DOC-02: RSA sign + verify contract
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import forge from 'node-forge'
import { createHash } from 'crypto'

const FIXTURE_PATH = resolve(process.cwd(), 'src/__tests__/icp/fixtures/test-cert.pfx')
const FIXTURE_PASSWORD = 'test1234'

// ─── Helper: load PFX and extract cert + private key ─────────────────────────
// Mirrors pfx-metadata.ts pattern exactly (Phase 7 verified sequence).

function loadPfx(pfxBuf: Buffer, password: string) {
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuf))
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  // OID fallbacks as used in pfx-metadata.ts (node-forge 1.4.0)
  const CERT_BAG_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
  const KEY_BAG_OID  = forge.pki.oids.pkcs8ShroudedKeyBag ?? '1.2.840.113549.1.12.10.1.2'

  const cert = pfx.getBags({ bagType: CERT_BAG_OID })[CERT_BAG_OID]?.[0]?.cert
  const privateKey = pfx.getBags({ bagType: KEY_BAG_OID })[KEY_BAG_OID]?.[0]?.key

  if (!cert || !privateKey) {
    throw new Error('cert or privateKey not found in .pfx')
  }

  return { cert, privateKey: privateKey as forge.pki.rsa.PrivateKey }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ICP sign→verify round-trip (DOC-02 algorithm lock)', () => {
  it('signs PDF bytes and verifies with cert public key (GREEN — algorithm contract)', () => {
    const pfxBuf = readFileSync(FIXTURE_PATH)
    const { cert, privateKey } = loadPfx(pfxBuf, FIXTURE_PASSWORD)

    const fakePdf = Buffer.from('%PDF-1.4 fake content')

    // 1. SHA-256 via Node crypto (stored in document_versions.content_hash)
    const sha256Hex = createHash('sha256').update(fakePdf).digest('hex')
    expect(sha256Hex).toHaveLength(64)

    // 2. Sign: md.update with binary representation — Pitfall 3 (forge needs binary string)
    const md = forge.md.sha256.create()
    md.update(fakePdf.toString('binary'), 'raw')
    const sig = privateKey.sign(md)
    const sigB64 = forge.util.encode64(sig)

    // 2048-bit RSA → 256 bytes → 344 base64 chars (standard encoding: ceil(256/3)*4 = 344)
    expect(sigB64).toHaveLength(344)

    // 3. Verify with FRESH md2 — Pitfall 2: md is consumed after sign; must reconstruct
    const md2 = forge.md.sha256.create()
    md2.update(fakePdf.toString('binary'), 'raw')
    const verified = cert.publicKey.verify(md2.digest().bytes(), sig)
    expect(verified).toBe(true)

    // 4. Cert thumbprint — Pitfall 4: use certificateToAsn1, NOT cert.toAsn1()
    const mdSha1 = forge.md.sha1.create()
    mdSha1.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
    const thumbprint = mdSha1.digest().toHex()
    expect(thumbprint).toMatch(/^[0-9a-f]{40}$/)
  })

  it('SHA-256 from Node crypto matches forge SHA-256 for the same Buffer', () => {
    const pfxBuf = readFileSync(FIXTURE_PATH)
    const { } = loadPfx(pfxBuf, FIXTURE_PASSWORD) // ensure fixture loads cleanly

    const fakePdf = Buffer.from('%PDF-1.4 fake content')

    // Node crypto SHA-256
    const nodeSha256 = createHash('sha256').update(fakePdf).digest('hex')

    // forge SHA-256 via binary string (Pitfall 3 — must use .toString('binary') + 'raw')
    const forgeMd = forge.md.sha256.create()
    forgeMd.update(fakePdf.toString('binary'), 'raw')
    const forgeSha256 = forgeMd.digest().toHex()

    expect(nodeSha256).toBe(forgeSha256)
    expect(nodeSha256).toHaveLength(64)
  })
})
