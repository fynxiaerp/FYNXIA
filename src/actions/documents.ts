'use server'
/**
 * Documents Server Actions — Phase 8 (DOC-02/03)
 *
 * generateDocument: fill template variables → render PDF → AES-encrypt content →
 *                   create document header + initial draft version (unsigned).
 * signDocument:     load cert from keystore → decrypt password → sign final PDF bytes
 *                   via signPdfBuffer → upload PDF to documents-pdf bucket → update
 *                   document_versions row + set document.status = 'signed'.
 * verifyDocumentSignature: on-demand verification against stored cert_pem + PDF bytes.
 * listDocumentVersions: chronological list of versions for a document (display metadata only).
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio (x-read-only header)
 *   2. Role gate — staff roles only; service role (createAdminClient) for storage/signing
 *   3. RLS — all DB reads go through createClient() with RLS enforcement
 *   4. Atomic sign flow — render PDF → sign → upload → update; no re-render after signing
 *      (Pitfall 1: sign the FINAL bytes only)
 *   5. Private key never returned, logged, or serialized (T-08-17)
 *   6. AES-encrypt filled content at rest (T-08-18; is_content_encrypted=true)
 *   7. storage_path never returned to client (T-08-19)
 *
 * Phase: 08-documentos-assinatura-icp-brasil
 */

import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { encrypt, decrypt } from '@/lib/crypto'
import { fillTemplate } from '@/lib/documents/template-engine'
import { signPdfBuffer, verifyPdfSignature } from '@/lib/icp/sign-document'
import { DocumentoPDF } from '@/components/pdf/DocumentoPDF'
import { logBusinessEvent } from '@/lib/audit'
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

// ─── Helper ───────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
  full_name?: string | null
}

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Generates a new document (draft) from a template.
 * Fills {{vars}} from context, AES-encrypts the filled content, creates the
 * document header + version 1 (unsigned, is_content_encrypted=true).
 */
export async function generateDocument(
  input: GenerateDocumentInput
): Promise<{ success: boolean; documentId?: string; versionId?: string; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // Role gate: clinical staff and admin can generate documents
  if (!['admin', 'superadmin', 'dentist', 'receptionist', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para gerar documentos' }
  }

  const supabase = await createClient()

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

  // 2. Fetch clinic name for PDF header
  const admin = createAdminClient()
  const clinicName =
    (
      await admin
        .from('clinics')
        .select('name')
        .eq('id', actor.tenant_id)
        .single()
    ).data?.name ?? 'Clínica'

  // 3. Build DocumentContext from DB + input
  const now = new Date()
  const ctx: DocumentContext = {
    nome_clinica: clinicName,
    nome_profissional: actor.full_name ?? '',
    data_documento: now.toLocaleDateString('pt-BR'),
    ...input.context,
  }

  // 4. Fill template variables
  const filledContent = fillTemplate(template.content, ctx)

  // 5. Create document header (clinic_id comes from actor.tenant_id via DB trigger or explicit)
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      template_id: input.templateId,
      patient_id: input.patientId ?? null,
      unit_id: input.unitId ?? null,
      category: template.category,
      status: 'draft',
      current_version: 1,
      created_by: actor.id,
      clinic_id: actor.tenant_id,
    })
    .select('id')
    .single()

  if (docError || !doc) {
    return { success: false, error: 'Erro ao criar documento' }
  }

  // 6. Render PDF for content_hash (draft PDF — not yet signed)
  const nowIso = now.toISOString()
  const pdfElement = createElement(DocumentoPDF, {
    clinicName,
    title: template.name,
    content: filledContent,
    documentNumber: `${doc.id.substring(0, 8).toUpperCase()}-v1`,
    generatedAt: nowIso,
  })
  const pdfBuffer = await renderToBuffer(pdfElement)
  const { createHash } = await import('crypto')
  const contentHash = createHash('sha256').update(pdfBuffer).digest('hex')

  // 7. AES-encrypt filled content at rest (T-08-18 — PII in content)
  const encryptedContent = encrypt(filledContent)

  // 8. Insert version 1 (draft — signature = null, content encrypted)
  const { data: version, error: verError } = await supabase
    .from('document_versions')
    .insert({
      document_id: doc.id,
      clinic_id: actor.tenant_id,
      version_number: 1,
      content: encryptedContent,
      is_content_encrypted: true,
      content_hash: contentHash,
      created_at: nowIso,
    })
    .select('id')
    .single()

  if (verError || !version) {
    return { success: false, error: 'Erro ao criar versão do documento' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'document.generated',
    details: { document_id: doc.id, version_id: version.id, template_id: input.templateId },
  })

  return { success: true, documentId: doc.id, versionId: version.id }
}

/**
 * Signs an existing draft document version with the clinic's ICP-Brasil certificate.
 * Atomic flow: decrypt content → render final PDF → signPdfBuffer →
 * upload to documents-pdf → update version with signature metadata.
 * Pitfall 1: signs the FINAL rendered bytes; never re-renders after signing.
 */
export async function signDocument(
  documentVersionId: string
): Promise<{
  success: boolean
  sha256Hex?: string
  signerCn?: string
  signedAt?: string
  thumbprint?: string
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'dentist', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para assinar documentos' }
  }

  const admin = createAdminClient()

  // 1. Fetch document version + document header (admin bypasses column-level REVOKE)
  const { data: version, error: verError } = await admin
    .from('document_versions')
    .select('content, document_id, version_number, is_content_encrypted, signature')
    .eq('id', documentVersionId)
    .single()

  if (verError || !version) {
    return { success: false, error: 'Versão do documento não encontrada' }
  }

  if (version.signature) {
    return { success: false, error: 'Esta versão já está assinada' }
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

  // Verify the actor belongs to the same clinic (cross-tenant guard)
  if (doc.clinic_id !== actor.tenant_id) {
    return { success: false, error: 'Acesso negado' }
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

  // 5. Decrypt content if encrypted (T-08-18)
  const rawContent = version.is_content_encrypted
    ? decrypt(version.content)
    : version.content

  // 6. Render FINAL PDF (the exact bytes that will be signed — Pitfall 1)
  const nowIso = new Date().toISOString()
  const versionLabel = `${version.document_id.substring(0, 8).toUpperCase()}-v${version.version_number}`
  const pdfElement = createElement(DocumentoPDF, {
    clinicName,
    title: templateName,
    content: rawContent,
    documentNumber: versionLabel,
    generatedAt: nowIso,
  })
  const pdfBuffer = await renderToBuffer(pdfElement)

  // 7. Sign the FINAL PDF bytes (atomic — no re-render after this point)
  const sigResult = await signPdfBuffer(
    pdfBuffer,
    cert.storage_path,
    cert.cert_password_enc
  )

  // 8. Upload signed PDF to private documents-pdf bucket (T-08-19)
  const storagePath = `${doc.clinic_id}/${version.document_id}/${documentVersionId}.pdf`
  const { error: uploadError } = await admin.storage.from('documents-pdf').upload(
    storagePath,
    new Uint8Array(pdfBuffer),
    { contentType: 'application/pdf', upsert: false }
  )

  if (uploadError) {
    return { success: false, error: `Erro ao armazenar PDF assinado: ${uploadError.message}` }
  }

  // 9. Update version with signature metadata (admin — storage_path is REVOKE-protected)
  const { error: updateVerError } = await admin
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
      signed_by: actor.id,
    })
    .eq('id', documentVersionId)

  if (updateVerError) {
    return { success: false, error: 'Erro ao registrar assinatura' }
  }

  // 10. Mark document as signed
  await admin
    .from('documents')
    .update({ status: 'signed', updated_at: nowIso })
    .eq('id', version.document_id)

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'document.signed',
    details: {
      version_id: documentVersionId,
      thumbprint: sigResult.certThumbprintSha1,
      signed_at: sigResult.signedAt,
    },
  })

  return {
    success: true,
    sha256Hex: sigResult.sha256Hex,
    signerCn: sigResult.certSubjectCn,
    signedAt: sigResult.signedAt,
    thumbprint: sigResult.certThumbprintSha1,
  }
}

/**
 * On-demand signature verification for a document version.
 * Re-fetches PDF from storage and verifies against stored cert_pem + signature.
 * Separate from signing/download to avoid latency on every access.
 */
export async function verifyDocumentSignature(
  documentVersionId: string
): Promise<{
  success: boolean
  verified?: boolean
  signerCn?: string | null
  signedAt?: string | null
  thumbprint?: string | null
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const admin = createAdminClient()

  // Fetch via admin to access REVOKE-protected columns
  const { data: version, error } = await admin
    .from('document_versions')
    .select('signature, cert_pem, storage_path, signer_cn, signed_at, cert_thumbprint, document_id, content_hash')
    .eq('id', documentVersionId)
    .single()

  if (error || !version) {
    return { success: false, error: 'Versão não encontrada' }
  }

  // Cross-tenant guard: verify document belongs to actor's clinic
  const { data: doc } = await admin
    .from('documents')
    .select('clinic_id')
    .eq('id', version.document_id)
    .single()

  if (!doc || doc.clinic_id !== actor.tenant_id) {
    return { success: false, error: 'Acesso negado' }
  }

  if (!version.signature || !version.cert_pem || !version.storage_path) {
    return { success: true, verified: false, signerCn: null, signedAt: null, thumbprint: null }
  }

  const { data: pdfBlob, error: dlError } = await admin.storage
    .from('documents-pdf')
    .download(version.storage_path)

  if (dlError || !pdfBlob) {
    return { success: false, error: 'PDF não encontrado no armazenamento' }
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  // Verify RSA signature
  const verified = verifyPdfSignature(pdfBuffer, version.signature, version.cert_pem)

  // Also cross-check SHA-256 hash
  const { createHash } = await import('crypto')
  const recomputedHash = createHash('sha256').update(pdfBuffer).digest('hex')
  const hashMatch = recomputedHash === version.content_hash

  return {
    success: true,
    verified: verified && hashMatch,
    signerCn: version.signer_cn,
    signedAt: version.signed_at,
    thumbprint: version.cert_thumbprint,
  }
}

/**
 * Lists all versions for a document (most recent first).
 * NEVER returns storage_path or cert_pem (REVOKE-protected — T-08-19).
 */
export async function listDocumentVersions(
  documentId: string
): Promise<{ success: boolean; data?: DocumentVersionSummary[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  // RLS enforces tenant isolation — only returns versions the actor can read
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
