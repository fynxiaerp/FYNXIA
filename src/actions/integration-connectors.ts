'use server'
/**
 * Integration Connector Server Actions — INT-01 / Phase 9 Plan 02
 *
 * Provides CRUD operations for integration_connectors rows.
 * Mirrors the certificate.ts pattern exactly:
 *   1. assertNotReadOnly()   — blocks auditor/dpo/socio
 *   2. role gate             — admin/superadmin/ti only
 *   3. Zod validation        — connectorFormSchema.safeParse before any DB write
 *   4. encrypt(credential)   — AES-256-GCM before insert (NEVER store plaintext)
 *   5. createAdminClient()   — service role for writes (bypasses RLS + column REVOKE)
 *   6. logBusinessEvent      — audit log WITHOUT credential or ciphertext (T-09-04)
 *   7. ConnectorPublic type  — Omit<ConnectorRow,'credential_enc'> + credential_masked
 *
 * SECURITY:
 *   T-09-03: credential_enc is revoked from authenticated/anon (migration 000600).
 *            createAdminClient bypasses REVOKE — used server-side only for decryption.
 *   T-09-04: logBusinessEvent receives only {type, status} — no secret, no ciphertext.
 *   T-09-05: every query is scoped to actor.tenant_id (cross-tenant isolation).
 *   T-09-06: assertNotReadOnly() + role gate ['admin','superadmin','ti'] on mutations.
 *   T-09-07: Zod v3 safeParse rejects malformed credential/config before DB write.
 *   T-09-08: AES-256-GCM auth tag (crypto.ts decrypt throws on tamper).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt } from '@/lib/crypto'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { connectorFormSchema, connectorUpdateSchema } from '@/lib/validators/connector'
import { maskCredential } from '@/lib/integrations/mask'
import type { ConnectorRow } from '@/lib/integrations/types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Public connector type — excludes credential_enc at compile time.
 * credential_enc MUST NOT reach the client (T-09-03 defense-in-depth).
 * credential_masked is the only credential-related field returned to the client.
 */
export type ConnectorPublic = Omit<ConnectorRow, 'credential_enc'> & {
  credential_masked: string | null
}

type Actor = {
  id: string
  tenant_id: string
  role: string
}

// ─── Helper: getActor ─────────────────────────────────────────────────────────

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

// ─── Helper: toPublic ─────────────────────────────────────────────────────────

/**
 * Strips credential_enc from a row and adds credential_masked.
 * plaintext is the decrypted credential — only the masked tail is returned to the client.
 */
function toPublic(
  row: ConnectorRow,
  plaintextOrNull: string | null
): ConnectorPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { credential_enc: _enc, ...publicData } = row
  return {
    ...publicData,
    credential_masked: plaintextOrNull ? maskCredential(plaintextOrNull) : null,
  }
}

// ─── createConnector ──────────────────────────────────────────────────────────

export async function createConnector(
  formData: FormData
): Promise<{ success: boolean; error?: string; connector?: ConnectorPublic }> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer (T-09-06)
  await assertNotReadOnly()

  // 2. Parse form fields
  const parsed = connectorFormSchema.safeParse({
    type: formData.get('type'),
    credential: formData.get('credential'),
    config: (() => {
      const raw = formData.get('config')
      if (!raw || typeof raw !== 'string') return undefined
      try { return JSON.parse(raw) } catch { return undefined }
    })(),
    status: formData.get('status') ?? 'disabled',
  })

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Dados inválidos'
    return { success: false, error: firstError }
  }

  const { type, credential, config, status } = parsed.data

  // 3. Auth + role gate — admin/superadmin/ti only (T-09-06)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. AES-256-GCM encrypt the credential BEFORE insert — never store plaintext (T-09-03)
  const credentialEnc = encrypt(credential)

  // 5. Insert via admin client (bypasses RLS + column REVOKE — server-side only)
  const adminClient = createAdminClient()
  const { data: inserted, error: insertError } = await adminClient
    .from('integration_connectors')
    .insert({
      clinic_id: actor.tenant_id,
      type,
      config: config ?? {},
      credential_enc: credentialEnc,
      status,
    })
    .select('id, clinic_id, type, config, status, created_at, updated_at, credential_enc')
    .single()

  if (insertError || !inserted) {
    return {
      success: false,
      error: insertError?.message ?? 'Erro ao salvar conector',
    }
  }

  // 6. Audit log — NO credential, NO ciphertext (T-09-04)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'connector.created',
    details: { type, status },
  })

  // 7. Return ConnectorPublic (Omit<> + masked tail) — never credential_enc (T-09-03)
  return {
    success: true,
    connector: toPublic(inserted as ConnectorRow, credential),
  }
}

// ─── listConnectors ───────────────────────────────────────────────────────────

export async function listConnectors(): Promise<{
  success: boolean
  connectors?: ConnectorPublic[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // Use admin client: REVOKE blocks credential_enc for authenticated/anon clients (T-09-03).
  // We select credential_enc here so we can derive the masked tail server-side — NEVER returned.
  const adminClient = createAdminClient()
  const { data: rows, error } = await adminClient
    .from('integration_connectors')
    .select('id, clinic_id, type, config, status, created_at, updated_at, credential_enc, deleted_at')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)    // WR-02: exclude soft-deleted connectors
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  // Map each row to ConnectorPublic — decrypt credential only to derive the masked tail.
  const connectors: ConnectorPublic[] = (rows ?? []).map((row) => {
    let plaintextTail: string | null = null
    if (row.credential_enc) {
      try {
        plaintextTail = decrypt(row.credential_enc)
      } catch {
        // Tampered or corrupt ciphertext — return null masked value rather than exposing error
        plaintextTail = null
      }
    }
    return toPublic(row as ConnectorRow, plaintextTail)
  })

  return { success: true, connectors }
}

// ─── updateConnector ──────────────────────────────────────────────────────────

export async function updateConnector(
  formData: FormData
): Promise<{ success: boolean; error?: string; connector?: ConnectorPublic }> {
  // 1. Read-only gate (T-09-06)
  await assertNotReadOnly()

  // 2. Parse form fields — credential is optional on update
  const parsed = connectorUpdateSchema.safeParse({
    id: formData.get('id'),
    type: formData.get('type'),
    credential: formData.get('credential') ?? undefined,
    config: (() => {
      const raw = formData.get('config')
      if (!raw || typeof raw !== 'string') return undefined
      try { return JSON.parse(raw) } catch { return undefined }
    })(),
    status: formData.get('status') ?? 'disabled',
  })

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Dados inválidos'
    return { success: false, error: firstError }
  }

  const { id, type, credential, config, status } = parsed.data

  // 3. Auth + role gate (T-09-06)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. Build update payload — re-encrypt only if a new credential is provided (T-09-03)
  const updatePayload: Record<string, unknown> = {
    type,
    config: config ?? {},
    status,
    updated_at: new Date().toISOString(),
  }

  let newPlaintext: string | null = null
  if (credential && credential.length > 0) {
    updatePayload.credential_enc = encrypt(credential)
    newPlaintext = credential
  }

  // 5. Update via admin client, tenant-scoped (T-09-05)
  const adminClient = createAdminClient()
  const { data: updated, error: updateError } = await adminClient
    .from('integration_connectors')
    .update(updatePayload)
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)
    .select('id, clinic_id, type, config, status, created_at, updated_at, credential_enc')
    .single()

  if (updateError || !updated) {
    return {
      success: false,
      error: updateError?.message ?? 'Conector não encontrado ou sem permissão',
    }
  }

  // 6. Audit log (T-09-04)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'connector.updated',
    details: { type, status, credentialRotated: !!newPlaintext },
  })

  // 7. Return ConnectorPublic — if credential was not rotated, derive masked tail from DB
  if (!newPlaintext && updated.credential_enc) {
    try {
      newPlaintext = decrypt(updated.credential_enc)
    } catch {
      newPlaintext = null
    }
  }

  return {
    success: true,
    connector: toPublic(updated as ConnectorRow, newPlaintext),
  }
}

// ─── deleteConnector ──────────────────────────────────────────────────────────

export async function deleteConnector(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate (T-09-06)
  await assertNotReadOnly()

  // 2. Auth + role gate (T-09-06)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 3. Soft-delete via admin client, tenant-scoped (T-09-05).
  //    WR-02: LGPD convention requires deleted_at rather than hard DELETE so that
  //    integration_events.connector_id FK is preserved for audit trail continuity.
  //    .is('deleted_at', null) makes the operation idempotent (cannot soft-delete twice).
  const adminClient = createAdminClient()
  const { error: deleteError } = await adminClient
    .from('integration_connectors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // 4. Audit log (T-09-04)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'connector.deleted',
    details: { id },
  })

  return { success: true }
}
