'use server'
/**
 * Clinical Documents Server Actions — Phase 12 (RX-01/RX-02/RX-03)
 *
 * issueClinicDocument: validate Zod → decrypt patient allergies → checkMedicationAllergy
 *                      (non-blocking) → next_doc_number RPC → encrypt content_json →
 *                      insert draft clinical_documents row.
 * signClinicDocument:  render typed PDF → REUSE Phase 8 signPdfBuffer (never modified) →
 *                      upload to clinical-documents-pdf bucket → atomic .is('signature',null)
 *                      flip to signed (immutable; no content update after signed).
 * listClinicDocuments: RLS-scoped read, ordered by created_at desc (never returns storage_path).
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks read-only roles at action boundary
 *   2. Role gate — admin/superadmin/dentist only
 *   3. Patient allergy decrypt INSIDE this action — plaintext never reaches client
 *   4. content_json AES-256-GCM encrypted at rest
 *   5. .is('signature', null) atomic race guard (T-12-17: re-sign prevention)
 *   6. storage_path NEVER returned to client (T-12-21)
 *   7. allergyAlert reasons contain non-identifying strings only (T-12-19)
 *   8. Phase 8 sign-document.ts is IMPORTED, never modified
 *
 * Phase: 12-receitu-rio-teleodontologia
 */

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { encrypt, decrypt } from '@/lib/crypto'
import { signPdfBuffer } from '@/lib/icp/sign-document'
import { ReceituarioPDF } from '@/components/pdf/ReceituarioPDF'
import { AtestadoPDF } from '@/components/pdf/AtestadoPDF'
import { ExamePDF } from '@/components/pdf/ExamePDF'
import { logBusinessEvent } from '@/lib/audit'
import { checkMedicationAllergy } from '@/lib/clinical/allergy-check'
import { formatDocNumber } from '@/lib/clinical/doc-number'
import { clinicalDocumentSchema } from '@/lib/validators/clinical-document'
import type { ClinicalDocumentInput } from '@/lib/validators/clinical-document'

// ─── getActor helper (mirrors src/actions/documents.ts exactly) ───────────────

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

// ─── issueClinicDocument ──────────────────────────────────────────────────────

/**
 * Validates, allergy-checks, numbers, encrypts, and inserts a clinical document draft.
 *
 * RX-01: atomic sequential doc_number via next_doc_number() Postgres RPC
 * RX-02: patient allergies decrypted server-side → checkMedicationAllergy (non-blocking)
 * RX-03: portal_visible flag for patient portal access
 *
 * T-12-16: allergy check is server-side only; client cannot override it.
 * T-12-19: content_json AES-encrypted; allergyAlert returns reason strings only (no PII).
 */
export async function issueClinicDocument(input: ClinicalDocumentInput): Promise<{
  success: boolean
  documentId?: string
  docNumber?: string
  allergyAlert?: { reasons: string[] }
  error?: string
}> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // Role gate: only clinical professionals may emit clinical documents
  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para emitir documentos clínicos' }
  }

  // Zod validation
  const parseResult = clinicalDocumentSchema.safeParse(input)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return {
      success: false,
      error: firstError?.message ?? 'Dados inválidos para emissão do documento',
    }
  }
  const validated = parseResult.data

  // Doc-type conditional requiredness (enforced here, not in Zod — D-133 flat schema)
  if (
    (validated.doc_type === 'receita_simples' ||
      validated.doc_type === 'receita_controle_especial') &&
    (!validated.medications || validated.medications.length === 0)
  ) {
    return { success: false, error: 'Receituário requer ao menos um medicamento' }
  }
  if (validated.doc_type === 'atestado' && !validated.atestado_motivo) {
    return { success: false, error: 'Atestado requer o campo motivo' }
  }
  if (validated.doc_type === 'solicitacao_exame' && !validated.exame_solicitacao) {
    return { success: false, error: 'Solicitação de exame requer a descrição dos exames' }
  }

  const admin = createAdminClient()

  // ── RX-02: Allergy check (receita types only) ────────────────────────────
  let allergyAlert: { reasons: string[] } | undefined

  if (
    validated.doc_type === 'receita_simples' ||
    validated.doc_type === 'receita_controle_especial'
  ) {
    // Fetch patient allergies (AES-encrypted) — admin bypasses RLS REVOKE on allergies column
    const { data: patient } = await admin
      .from('patients')
      .select('allergies')
      .eq('id', validated.patient_id)
      .eq('tenant_id', actor.tenant_id) // patients uses tenant_id, not clinic_id
      .is('deleted_at', null)
      .single()

    // Pitfall 2: only decrypt if non-null and non-empty
    const allergiesPlain =
      patient?.allergies && patient.allergies.length > 0
        ? decrypt(patient.allergies)
        : null

    // Fetch latest anamnese for medication/anesthetic allergy flags
    const { data: latestAnamnese } = await admin
      .from('anamneses')
      .select('responses')
      .eq('patient_id', validated.patient_id)
      .eq('tenant_id', actor.tenant_id) // explicit tenant scope on admin-client read (RLS bypassed)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const responses = latestAnamnese?.responses as
      | Record<string, boolean | string>
      | null
      | undefined
    const anamnesisFlags = {
      alergia_medicamento: !!responses?.alergia_medicamento,
      alergia_anestesia: !!responses?.alergia_anestesia,
    }

    // Check each medication line
    const allReasons: string[] = []
    for (const med of validated.medications ?? []) {
      // Fetch medication metadata (therapeutic_class + allergen_tags) from medications table.
      // A tampered/foreign medication_id must NOT silently fall through to empty allergen tags —
      // that would neuter the tag match (WR-03). Treat a lookup miss as a hard error.
      const { data: medRow, error: medErr } = await admin
        .from('medications')
        .select('therapeutic_class, allergen_tags')
        .eq('id', med.medication_id)
        .eq('active', true)
        .single()

      if (medErr || !medRow) {
        return { success: false, error: 'Medicamento inválido ou inativo' }
      }

      const result = checkMedicationAllergy({
        medicationName: med.medication_name,
        therapeuticClass: medRow.therapeutic_class ?? '',
        allergenTags: (medRow.allergen_tags as string[] | null) ?? [],
        patientAllergiesPlaintext: allergiesPlain,
        anamnesisFlags,
      })

      if (result.hasAlert) {
        allReasons.push(...result.reasons)
      }
    }

    // D-02: NON-BLOCKING — allergyAlert is returned alongside success, not an abort
    if (allReasons.length > 0) {
      allergyAlert = { reasons: allReasons }
    }
  }

  // ── RX-01: Atomic sequential numbering via Postgres RPC ──────────────────
  const supabase = await createClient()
  const { data: seqData, error: rpcError } = await supabase.rpc('next_doc_number', {
    p_clinic_id: actor.tenant_id,
    p_doc_type: validated.doc_type,
  })

  if (rpcError || seqData === null || seqData === undefined) {
    return { success: false, error: 'Erro ao gerar número do documento' }
  }

  const seq = Number(seqData)
  const year = new Date().getFullYear()
  const docNumber = formatDocNumber(validated.doc_type, seq, year)

  // ── Resolve professional_id ───────────────────────────────────────────────
  let professionalId = validated.professional_id ?? null
  if (!professionalId) {
    const { data: prof } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', actor.id)
      .eq('clinic_id', actor.tenant_id)
      .is('deleted_at', null)
      .maybeSingle()
    professionalId = prof?.id ?? null
  }

  // ── Build content_json per doc_type ──────────────────────────────────────
  type ContentJson = {
    medications?: { medication_name: string; posologia: string; quantidade?: string }[]
    observacoes?: string
    atestado_motivo?: string
    atestado_dias?: number
    exame_solicitacao?: string
  }

  let contentJson: ContentJson = {}
  if (
    validated.doc_type === 'receita_simples' ||
    validated.doc_type === 'receita_controle_especial'
  ) {
    contentJson = {
      medications: (validated.medications ?? []).map((m) => ({
        medication_name: m.medication_name,
        posologia: m.posologia,
        quantidade: m.quantidade,
      })),
      observacoes: validated.observacoes,
    }
  } else if (validated.doc_type === 'atestado') {
    contentJson = {
      atestado_motivo: validated.atestado_motivo,
      atestado_dias: validated.atestado_dias,
      observacoes: validated.observacoes,
    }
  } else if (validated.doc_type === 'solicitacao_exame') {
    contentJson = {
      exame_solicitacao: validated.exame_solicitacao,
      observacoes: validated.observacoes,
    }
  }

  // Pitfall 7: encrypt content_json at rest (T-12-19)
  const encryptedContent = encrypt(JSON.stringify(contentJson))

  // ── Insert draft clinical_documents row ───────────────────────────────────
  const { data: docRow, error: insertError } = await supabase
    .from('clinical_documents')
    .insert({
      clinic_id: actor.tenant_id,
      patient_id: validated.patient_id,
      appointment_id: validated.appointment_id ?? null,
      professional_id: professionalId,
      doc_type: validated.doc_type,
      doc_number: docNumber,
      content_json: encryptedContent,
      status: 'draft',
      portal_visible: validated.portal_visible ?? false,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !docRow) {
    return { success: false, error: 'Erro ao criar documento clínico' }
  }

  const documentId = (docRow as { id: string }).id

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'clinical_document.issued',
    details: {
      document_id: documentId,
      doc_type: validated.doc_type,
      doc_number: docNumber,
    },
  })

  return { success: true, documentId, docNumber, allergyAlert }
}

// ─── signClinicDocument ───────────────────────────────────────────────────────

/**
 * Signs a draft clinical document using the clinic's ICP-Brasil certificate.
 *
 * Mirrors signDocument (Phase 8) exactly, but on clinical_documents table.
 * Atomic .is('signature', null) guard prevents re-signing (T-12-17).
 * After signing, the document is immutable — no content updates allowed.
 *
 * RX-03: reuses Phase 8 signPdfBuffer without modification.
 */
export async function signClinicDocument(documentId: string): Promise<{
  success: boolean
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

  if (!['admin', 'superadmin', 'dentist'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para assinar documentos clínicos' }
  }

  const admin = createAdminClient()

  // 1. Fetch the clinical_documents row via admin (bypasses REVOKE on storage_path/cert_pem)
  const { data: row, error: rowError } = await admin
    .from('clinical_documents')
    .select(
      'id, content_json, doc_type, professional_id, patient_id, status, signature, created_at, clinic_id, doc_number'
    )
    .eq('id', documentId)
    .single()

  if (rowError || !row) {
    return { success: false, error: 'Documento clínico não encontrado' }
  }

  const typedRow = row as {
    id: string
    content_json: string
    doc_type: string
    professional_id: string | null
    patient_id: string
    status: string
    signature: string | null
    created_at: string
    clinic_id: string
    doc_number: string
  }

  // Already-signed guards (T-12-17)
  if (typedRow.signature) {
    return { success: false, error: 'Este documento já está assinado' }
  }
  if (typedRow.status === 'signed') {
    return { success: false, error: 'Este documento já está assinado' }
  }

  // Cross-tenant guard
  if (typedRow.clinic_id !== actor.tenant_id) {
    return { success: false, error: 'Acesso negado' }
  }

  // 2. Fetch clinic certificate (admin — cert secrets never via RLS)
  const { data: cert, error: certError } = await admin
    .from('certificates')
    .select('storage_path, cert_password_enc, subject_cn, thumbprint_sha1, not_after')
    .eq('clinic_id', typedRow.clinic_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (certError || !cert) {
    return { success: false, error: 'Certificado ICP-Brasil não encontrado para esta clínica' }
  }

  // 3. Fetch clinic name
  const clinicName =
    (
      await admin
        .from('clinics')
        .select('name')
        .eq('id', typedRow.clinic_id)
        .single()
    ).data?.name ?? 'Clínica'

  // 4. Fetch professional name + CRO
  let professionalName = actor.full_name ?? 'Profissional'
  let professionalCro = ''
  if (typedRow.professional_id) {
    const { data: profRow } = await admin
      .from('professionals')
      .select('full_name, cro, cro_uf')
      .eq('id', typedRow.professional_id)
      .single()
    if (profRow) {
      professionalName = profRow.full_name ?? professionalName
      professionalCro = profRow.cro_uf
        ? `${profRow.cro}/${profRow.cro_uf}`
        : (profRow.cro ?? '')
    }
  }

  // 5. Fetch patient name
  const { data: patientRow } = await admin
    .from('patients')
    .select('full_name')
    .eq('id', typedRow.patient_id)
    .single()
  const patientName = patientRow?.full_name ?? 'Paciente'

  // 6. Decrypt content_json (Pitfall 2 + T-12-19)
  const contentJson = JSON.parse(decrypt(typedRow.content_json)) as {
    medications?: { medication_name: string; posologia: string; quantidade?: string }[]
    observacoes?: string
    atestado_motivo?: string
    atestado_dias?: number
    exame_solicitacao?: string
  }

  // 7. Deterministic generatedAt = row.created_at (Pitfall 1 — same bytes every retry)
  const generatedAt = typedRow.created_at
  const docNumber = typedRow.doc_number

  // 8. Pick PDF component by doc_type and render the FINAL bytes
  // Cast via ReactElement<DocumentProps> — renderToBuffer requires this type;
  // our components all return <Document> which satisfies DocumentProps at runtime.
  let pdfBuffer: Buffer

  if (
    typedRow.doc_type === 'receita_simples' ||
    typedRow.doc_type === 'receita_controle_especial'
  ) {
    const el = createElement(ReceituarioPDF, {
      clinicName,
      professionalName,
      professionalCro,
      patientName,
      isControleEspecial: typedRow.doc_type === 'receita_controle_especial',
      medications: contentJson.medications ?? [],
      observacoes: contentJson.observacoes,
      documentNumber: docNumber,
      generatedAt,
    }) as unknown as ReactElement<DocumentProps>
    pdfBuffer = await renderToBuffer(el)
  } else if (typedRow.doc_type === 'atestado') {
    const el = createElement(AtestadoPDF, {
      clinicName,
      professionalName,
      professionalCro,
      patientName,
      motivo: contentJson.atestado_motivo ?? '',
      dias: contentJson.atestado_dias,
      documentNumber: docNumber,
      generatedAt,
    }) as unknown as ReactElement<DocumentProps>
    pdfBuffer = await renderToBuffer(el)
  } else if (typedRow.doc_type === 'solicitacao_exame') {
    const el = createElement(ExamePDF, {
      clinicName,
      professionalName,
      professionalCro,
      patientName,
      solicitacao: contentJson.exame_solicitacao ?? '',
      documentNumber: docNumber,
      generatedAt,
    }) as unknown as ReactElement<DocumentProps>
    pdfBuffer = await renderToBuffer(el)
  } else {
    return { success: false, error: 'Tipo de documento clínico desconhecido' }
  }

  // 9. Sign the FINAL PDF bytes (Phase 8 engine — never modified)
  const sigResult = await signPdfBuffer(
    pdfBuffer,
    cert.storage_path,
    cert.cert_password_enc
  )

  // 10. Upload to clinical-documents-pdf private bucket (T-12-21)
  const storagePath = `${typedRow.clinic_id}/${documentId}.pdf`
  const { error: uploadError } = await admin.storage
    .from('clinical-documents-pdf')
    .upload(storagePath, new Uint8Array(pdfBuffer), {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return {
      success: false,
      error: `Erro ao armazenar PDF assinado: ${uploadError.message}`,
    }
  }

  // 11. Atomic update: .is('signature', null) — if another concurrent request already signed,
  //     this matches 0 rows → roll back uploaded PDF and abort (T-12-17)
  const { data: updateRows, error: updateError } = await admin
    .from('clinical_documents')
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
      status: 'signed',
    } as never)
    .eq('id', documentId)
    .is('signature', null) // atomic guard: only update if still unsigned
    .select('id')

  if (updateError || !updateRows || (updateRows as unknown[]).length === 0) {
    // Roll back: remove the uploaded PDF to avoid orphaned storage objects
    await admin.storage.from('clinical-documents-pdf').remove([storagePath])
    return {
      success: false,
      error: updateError
        ? 'Erro ao registrar assinatura'
        : 'Este documento já foi assinado por outra requisição simultânea',
    }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'clinical_document.signed',
    details: {
      document_id: documentId,
      thumbprint: sigResult.certThumbprintSha1,
      signed_at: sigResult.signedAt,
    },
  })

  return {
    success: true,
    signerCn: sigResult.certSubjectCn,
    signedAt: sigResult.signedAt,
    thumbprint: sigResult.certThumbprintSha1,
  }
}

// ─── listClinicDocuments ──────────────────────────────────────────────────────

/**
 * Lists clinical documents for the actor's clinic (display metadata only).
 * NEVER returns storage_path or cert_pem (T-12-21 REVOKE protection).
 */
export async function listClinicDocuments(patientId?: string): Promise<{
  success: boolean
  data?: {
    id: string
    doc_type: string
    doc_number: string
    status: string
    portal_visible: boolean
    patient_id: string
    professional_id: string | null
    created_at: string
    signed_at: string | null
    signer_cn: string | null
  }[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  // RLS enforces tenant isolation; explicit clinic_id filter as defence-in-depth
  let query = supabase
    .from('clinical_documents')
    .select(
      'id, doc_type, doc_number, status, portal_visible, patient_id, professional_id, created_at, signed_at, signer_cn'
    )
    .order('created_at', { ascending: false })

  if (patientId) {
    query = query.eq('patient_id', patientId) as typeof query
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: 'Erro ao listar documentos clínicos' }
  }

  return { success: true, data: (data ?? []) as typeof data }
}
