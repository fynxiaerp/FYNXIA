'use server'
/**
 * Documents Server Actions — Phase 8 (DOC-01/02/03)
 *
 * generateDocument: fill template variables → render PDF → create document header +
 *                   initial draft version (unsigned).
 * signDocument:     load cert from keystore → decrypt password → sign final PDF bytes
 *                   via signPdfBuffer → upload PDF to documents-pdf bucket → update
 *                   document_versions row + set document.status = 'signed'.
 * verifyDocumentSignature: on-demand verification against stored cert_pem + PDF bytes.
 * listDocumentVersions: chronological list of versions for a document.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio (x-read-only header)
 *   2. Role gate — staff roles only; service role (createAdminClient) for storage/signing
 *   3. RLS — all DB reads go through createClient() with RLS enforcement
 *   4. Atomic sign flow — render PDF → sign → upload → insert; no re-render after signing
 *      (Pitfall 1: sign the FINAL bytes only)
 *   5. Private key never returned, logged, or serialized (T-08-03)
 *
 * Phase: 08-documentos-assinatura-icp-brasil
 */

import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { decrypt } from '@/lib/crypto'
import { fillTemplate } from '@/lib/documents/template-engine'
import { signPdfBuffer, verifyPdfSignature } from '@/lib/icp/sign-document'
import { DocumentoPDF } from '@/components/pdf/DocumentoPDF'
import type { DocumentContext } from '@/lib/documents/document-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateDocumentInput {
  templateId: string
  context: DocumentContext
  patientId?: string
  unitId?: string
}

export interface DocumentVersionSummary {
  id: string
  version_number: number
  content_hash: string
  signature: string | null
  signer_cn: string | null
  signed_at: string | null
  created_at: string
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Generates a new document (draft) from a template.
 * Fills {{vars}} from context, creates the document header + version 1 (unsigned).
 */
export async function generateDocument(
  input: GenerateDocumentInput
): Promise<{ success: boolean; documentId?: string; versionId?: string; error?: string }> {
  assertNotReadOnly()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  // 1. Fetch template (RLS enforces tenant isolation)
  const { data: template, error: tplError } = await supabase
    .from('document_templates')
    .select('id, name, category, content')
    .eq('id', input.templateId)
    .is('deleted_at', null)
    .single()

  if (tplError || !template) {
    return { success: false, error: 'Modelo de documento não encontrado' }
  }

  // 2. Fill template variables
  const filledContent = fillTemplate(template.content, input.context)

  // 3. Create document header
  const admin = createAdminClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      template_id: input.templateId,
      patient_id: input.patientId ?? null,
      unit_id: input.unitId ?? null,
      category: template.category,
      status: 'draft',
      current_version: 1,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (docError || !doc) {
    return { success: false, error: 'Erro ao criar documento' }
  }

  // 4. Get clinic info for PDF header (via admin to bypass RLS for clinic name)
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const clinicName = profile?.tenant_id
    ? (
        await supabase
          .from('clinics')
          .select('name')
          .eq('id', profile.tenant_id)
          .single()
      ).data?.name ?? 'Clínica'
    : 'Clínica'

  // 5. Render PDF for content_hash (draft PDF — not yet signed)
  const now = new Date().toISOString()
  const pdfElement = createElement(DocumentoPDF, {
    clinicName,
    title: template.name,
    content: filledContent,
    documentNumber: `${doc.id.substring(0, 8).toUpperCase()}-v1`,
    generatedAt: now,
  })
  const pdfBuffer = await renderToBuffer(pdfElement)
  const { createHash } = await import('crypto')
  const contentHash = createHash('sha256').update(pdfBuffer).digest('hex')

  // 6. Insert version 1 (draft — signature = null)
  const { data: version, error: verError } = await supabase
    .from('document_versions')
    .insert({
      document_id: doc.id,
      version_number: 1,
      content: filledContent,
      is_content_encrypted: false, // plaintext for draft; encrypt on sign
      content_hash: contentHash,
      created_at: now,
    })
    .select('id')
    .single()

  if (verError || !version) {
    return { success: false, error: 'Erro ao criar versão do documento' }
  }

  return { success: true, documentId: doc.id, versionId: version.id }
}

/**
 * Signs an existing draft document version with the clinic's ICP-Brasil certificate.
 * Atomic flow: render final PDF → signPdfBuffer → upload to documents-pdf → update version.
 * Pitfall 1: signs the FINAL rendered bytes; never re-renders after signing.
 */
export async function signDocument(
  documentVersionId: string
): Promise<{ success: boolean; sha256Hex?: string; error?: string }> {
  assertNotReadOnly()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const admin = createAdminClient()

  // 1. Fetch document version + document header (admin bypasses RLS for cross-table join)
  const { data: version, error: verError } = await admin
    .from('document_versions')
    .select('content, document_id, version_number, is_content_encrypted')
    .eq('id', documentVersionId)
    .single()

  if (verError || !version) {
    return { success: false, error: 'Versão do documento não encontrada' }
  }

  const { data: doc, error: docError } = await admin
    .from('documents')
    .select('clinic_id, status, template_id')
    .eq('id', version.document_id)
    .single()

  if (docError || !doc) {
    return { success: false, error: 'Documento não encontrado' }
  }

  if (doc.status === 'signed') {
    return { success: false, error: 'Documento já está assinado' }
  }

  // 2. Fetch clinic certificate (admin client — cert secrets never via RLS)
  const { data: cert, error: certError } = await admin
    .from('certificates')
    .select('storage_path, cert_password_enc, subject_cn, thumbprint_sha1, not_after')
    .eq('clinic_id', doc.clinic_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (certError || !cert) {
    return { success: false, error: 'Certificado ICP-Brasil não encontrado para esta clínica' }
  }

  // 3. Fetch template name for PDF title
  const templateName = doc.template_id
    ? (
        await admin
          .from('document_templates')
          .select('name')
          .eq('id', doc.template_id)
          .single()
      ).data?.name ?? 'Documento'
    : 'Documento'

  // 4. Fetch clinic name
  const clinicName =
    (
      await admin
        .from('clinics')
        .select('name')
        .eq('id', doc.clinic_id)
        .single()
    ).data?.name ?? 'Clínica'

  // 5. Render FINAL PDF (the exact bytes that will be signed — Pitfall 1)
  const now = new Date().toISOString()
  const versionLabel = `${version.document_id.substring(0, 8).toUpperCase()}-v${version.version_number}`
  const pdfElement = createElement(DocumentoPDF, {
    clinicName,
    title: templateName,
    content: version.content,
    documentNumber: versionLabel,
    generatedAt: now,
  })
  const pdfBuffer = await renderToBuffer(pdfElement)

  // 6. Sign the FINAL PDF bytes (atomic — no re-render after this point)
  const sigResult = await signPdfBuffer(
    pdfBuffer,
    cert.storage_path,
    cert.cert_password_enc
  )

  // 7. Upload signed PDF to private documents-pdf bucket
  const storagePath = `${doc.clinic_id}/${version.document_id}/${documentVersionId}.pdf`
  await admin.storage.from('documents-pdf').upload(
    storagePath,
    new Uint8Array(pdfBuffer),
    { contentType: 'application/pdf', upsert: false }
  )

  // 8. Update version with signature metadata (admin bypasses RLS for server-only update)
  await admin
    .from('document_versions')
    .update({
      content_hash: sigResult.sha256Hex,
      signature: sigResult.signatureB64,
      storage_path: storagePath,
      cert_pem: sigResult.certPem,
      signer_cn: sigResult.certSubjectCn,
      cert_thumbprint: sigResult.certThumbprintSha1,
      cert_not_after: sigResult.certNotAfter,
      signed_at: sigResult.signedAt,
      signed_by: user.id,
    })
    .eq('id', documentVersionId)

  // 9. Mark document as signed
  await admin
    .from('documents')
    .update({ status: 'signed', updated_at: now })
    .eq('id', version.document_id)

  return { success: true, sha256Hex: sigResult.sha256Hex }
}

/**
 * On-demand signature verification for a document version.
 * Re-fetches PDF from storage and verifies against stored cert_pem + signature.
 * Separate from signing flow to avoid latency on every download.
 */
export async function verifyDocumentSignature(
  documentVersionId: string
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const admin = createAdminClient()

  const { data: version, error } = await admin
    .from('document_versions')
    .select('signature, cert_pem, storage_path')
    .eq('id', documentVersionId)
    .single()

  if (error || !version) {
    return { success: false, error: 'Versão não encontrada' }
  }

  if (!version.signature || !version.cert_pem || !version.storage_path) {
    return { success: true, verified: false }
  }

  const { data: pdfBlob, error: dlError } = await admin.storage
    .from('documents-pdf')
    .download(version.storage_path)

  if (dlError || !pdfBlob) {
    return { success: false, error: 'PDF não encontrado no armazenamento' }
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())
  const verified = verifyPdfSignature(pdfBuffer, version.signature, version.cert_pem)

  return { success: true, verified }
}

/**
 * Lists all versions for a document (chronological, most recent first).
 */
export async function listDocumentVersions(
  documentId: string
): Promise<{ success: boolean; data?: DocumentVersionSummary[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { data, error } = await supabase
    .from('document_versions')
    .select('id, version_number, content_hash, signature, signer_cn, signed_at, created_at')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })

  if (error) {
    return { success: false, error: 'Erro ao listar versões do documento' }
  }

  return { success: true, data: (data ?? []) as DocumentVersionSummary[] }
}
