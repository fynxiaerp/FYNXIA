import 'server-only'
import forge from 'node-forge'

export interface CertificateMetadata {
  subject_cn: string        // Common Name (razão social / dentista)
  cnpj: string | null       // From OID 2.16.76.1.3.3 (ICP-Brasil CNPJ) — null if not present
  cpf: string | null        // From OID 2.16.76.1.3.1 (ICP-Brasil CPF) — null if not present
  not_before: Date
  not_after: Date
  thumbprint_sha1: string   // Hex string (SHA-1 of DER-encoded cert)
  serial_number: string
  issuer_cn: string
}

/**
 * Extracts certificate metadata from a PKCS#12 (.pfx) buffer.
 *
 * ICP-Brasil A1 specific:
 *  - CNPJ OID: 2.16.76.1.3.3 (may appear in Subject attributes or SAN otherName)
 *  - CPF  OID: 2.16.76.1.3.1 (same fallback)
 *
 * Returns null for cnpj/cpf if the OIDs are not present in the certificate
 * (e.g. synthetic test certs, or CAs that embed them differently).
 *
 * Throws a friendly Portuguese error on parse failure or wrong password.
 *
 * @param pfxBuffer  Raw bytes of the .pfx file (Buffer or Uint8Array)
 * @param password   Password protecting the PKCS#12 container
 */
export function extractPfxMetadata(pfxBuffer: Buffer, password: string): CertificateMetadata {
  let pfx: forge.pkcs12.Pkcs12Pfx

  try {
    // 1. Convert Buffer → forge binary string → ASN.1 → PKCS12
    const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer))
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)
  } catch {
    throw new Error('Certificado inválido ou senha incorreta.')
  }

  // 2. Extract certificate bag
  // forge.pki.oids.certBag is typed string|undefined; use a known literal fallback.
  // The actual OID for certBag is well-known: 1.2.840.113549.1.12.10.1.3
  const CERT_BAG_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
  let cert: forge.pki.Certificate
  try {
    const certBags = pfx.getBags({ bagType: CERT_BAG_OID })
    const certBag = certBags[CERT_BAG_OID]?.[0]
    if (!certBag?.cert) {
      throw new Error('Nenhum certificado encontrado no arquivo PFX.')
    }
    cert = certBag.cert
  } catch (err) {
    if (err instanceof Error && err.message.includes('PFX')) throw err
    throw new Error('Certificado inválido ou senha incorreta.')
  }

  // 3. Common Name + Issuer CN
  const subject_cn: string = (cert.subject.getField('CN') as { value: string } | null)?.value ?? ''
  const issuer_cn: string = (cert.issuer.getField('CN') as { value: string } | null)?.value ?? ''

  // 4. ICP-Brasil OIDs: try Subject attributes first, then SAN otherName (Pitfall 4)
  const OID_CNPJ = '2.16.76.1.3.3'
  const OID_CPF  = '2.16.76.1.3.1'

  let cnpj: string | null = null
  let cpf: string | null = null

  // 4a. Subject attributes
  for (const attr of cert.subject.attributes) {
    if (attr.type === OID_CNPJ) cnpj = String(attr.value)
    if (attr.type === OID_CPF)  cpf  = String(attr.value)
  }

  // 4b. Fallback: iterate cert.extensions looking for SAN otherName entries
  if (cnpj === null || cpf === null) {
    for (const ext of cert.extensions ?? []) {
      // Subject Alternative Name extension id: 2.5.29.17
      if (ext.name === 'subjectAltName' && Array.isArray(ext.altNames)) {
        for (const altName of ext.altNames as Array<{ type: number; oid?: string; value?: string }>) {
          // type 0 = otherName
          if (altName.type === 0) {
            if (altName.oid === OID_CNPJ && cnpj === null) cnpj = altName.value ?? null
            if (altName.oid === OID_CPF  && cpf  === null) cpf  = altName.value ?? null
          }
        }
      }
    }
  }

  // 5. SHA-1 thumbprint over DER-encoded certificate
  // node-forge: use forge.pki.certificateToAsn1(cert), NOT cert.toAsn1() (not a method on cert objects)
  const md = forge.md.sha1.create()
  md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
  const thumbprint_sha1 = md.digest().toHex()

  return {
    subject_cn,
    cnpj,
    cpf,
    not_before: cert.validity.notBefore,
    not_after:  cert.validity.notAfter,
    thumbprint_sha1,
    serial_number: cert.serialNumber,
    issuer_cn,
  }
}
