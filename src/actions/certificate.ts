'use server'
/**
 * Certificate Server Actions — SYS-02 / Plan 07-06
 *
 * uploadCertificate: validates .pfx upload, extracts metadata via node-forge,
 * rejects expired certs, uploads bytes to the private icp-certificates bucket
 * via service role, AES-encrypts the password, inserts metadata row.
 *
 * getCertificate: returns latest non-deleted certificate METADATA only.
 * Return type (CertificatePublic) explicitly EXCLUDES cert_password_enc and
 * storage_path at the TYPE LEVEL — compile-time guarantee secrets never reach client.
 *
 * SECURITY:
 *   1. assertNotReadOnly()  — blocks auditor/dpo/socio (x-read-only header)
 *   2. role gate            — admin/superadmin/ti only
 *   3. extractPfxMetadata() — parse + validate password server-side (node-forge)
 *   4. expiry check         — rejects not_after < now()
 *   5. service role upload  — bytes go to private bucket; never a public URL
 *   6. encrypt(password)    — AES-256-GCM before insert; plaintext never stored
 *   7. logBusinessEvent     — audit without secrets (no password, no path)
 *   8. CertificatePublic    — Omit<...> excludes cert_password_enc + storage_path
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractPfxMetadata } from '@/lib/icp/pfx-metadata'
import { encrypt } from '@/lib/crypto'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { certificateSchema } from '@/lib/validators/certificate'
import type { Database } from '@/types/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type CertRow = Database['public']['Tables']['certificates']['Row']

/**
 * Public certificate type — excludes secrets at compile time.
 * cert_password_enc and storage_path MUST NOT reach the client.
 * Phase 8 (DOC/signing) reads these server-side via the admin client only.
 */
export type CertificatePublic = Omit<CertRow, 'cert_password_enc' | 'storage_path'>

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// ─── uploadCertificate ────────────────────────────────────────────────────────

export async function uploadCertificate(
  formData: FormData
): Promise<{ success: boolean; error?: string; certificate?: CertificatePublic }> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer
  await assertNotReadOnly()

  // 2. Extract form fields
  const file = formData.get('file')
  const password = formData.get('password')

  if (!(file instanceof File)) {
    return { success: false, error: 'Arquivo não enviado' }
  }

  // 3. Validate via schema (filename, size, password)
  const parsed = certificateSchema.safeParse({
    filename: file.name,
    sizeBytes: file.size,
    password: typeof password === 'string' ? password : '',
  })

  if (!parsed.success) {
    const firstError = parsed.data === undefined
      ? parsed.error.errors[0]?.message
      : 'Dados inválidos'
    return { success: false, error: firstError ?? 'Dados inválidos' }
  }

  const { password: certPassword } = parsed.data

  // 4. Auth + role gate — admin/superadmin/ti only (cert upload is also a TI task)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 5. Read file bytes into Buffer
  const arrayBuffer = await file.arrayBuffer()
  const pfxBuffer = Buffer.from(arrayBuffer)

  // 6. Extract metadata via node-forge (throws on bad password / invalid file)
  let metadata: Awaited<ReturnType<typeof extractPfxMetadata>>
  try {
    metadata = extractPfxMetadata(pfxBuffer, certPassword)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Certificado inválido ou senha incorreta.'
    return { success: false, error: message }
  }

  // 7. Reject expired certificate
  if (metadata.not_after < new Date()) {
    return {
      success: false,
      error: `Certificado expirado (válido até ${metadata.not_after.toLocaleDateString('pt-BR')}).`,
    }
  }

  // 8. Upload .pfx bytes to private bucket via service role
  const adminClient = createAdminClient()
  const storagePath = `${actor.tenant_id}/${crypto.randomUUID()}.pfx`

  const { error: uploadError } = await adminClient.storage
    .from('icp-certificates')
    .upload(storagePath, pfxBuffer, {
      contentType: 'application/x-pkcs12',
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Erro ao armazenar certificado: ${uploadError.message}` }
  }

  // 9. AES-256-GCM encrypt the password BEFORE insert — never store plaintext
  const certPasswordEnc = encrypt(certPassword)

  // 10. Insert metadata row (service role for insert; RLS write policy is admin-only)
  const { data: inserted, error: insertError } = await adminClient
    .from('certificates')
    .insert({
      clinic_id: actor.tenant_id,
      subject_cn: metadata.subject_cn,
      cnpj: metadata.cnpj,
      cpf: metadata.cpf,
      issuer_cn: metadata.issuer_cn,
      serial_number: metadata.serial_number,
      not_before: metadata.not_before.toISOString(),
      not_after: metadata.not_after.toISOString(),
      thumbprint_sha1: metadata.thumbprint_sha1,
      storage_path: storagePath,
      cert_password_enc: certPasswordEnc,
      uploaded_by: actor.id,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    // Attempt to clean up the uploaded file on insert failure
    await adminClient.storage.from('icp-certificates').remove([storagePath])
    return { success: false, error: insertError?.message ?? 'Erro ao salvar metadados do certificado' }
  }

  // 11. Audit log — NO password, NO storage_path (security: no secrets in audit details)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'certificate.uploaded',
    details: {
      subject_cn: metadata.subject_cn,
      thumbprint_sha1: metadata.thumbprint_sha1,
      not_after: metadata.not_after.toISOString(),
    },
  })

  // 12. Return public metadata (Omit excludes secrets at type level)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cert_password_enc: _enc, storage_path: _path, ...publicData } = inserted
  return { success: true, certificate: publicData }
}

// ─── getCertificate ───────────────────────────────────────────────────────────

/**
 * Returns the latest non-deleted certificate metadata for the authenticated tenant.
 *
 * Return type CertificatePublic = Omit<CertRow, 'cert_password_enc' | 'storage_path'>
 * ensures secrets NEVER reach the client, enforced at compile time (INFO 9 / T-07-18).
 */
export async function getCertificate(): Promise<{
  success: boolean
  certificate?: CertificatePublic
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('certificates')
    .select(
      'id, clinic_id, subject_cn, cnpj, cpf, issuer_cn, serial_number, not_before, not_after, thumbprint_sha1, uploaded_by, created_at, deleted_at'
    )
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // PGRST116 = no rows found (normal state for tenants without a cert)
    if (error.code === 'PGRST116') {
      return { success: true, certificate: undefined }
    }
    return { success: false, error: error.message }
  }

  return { success: true, certificate: data }
}
