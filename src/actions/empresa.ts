'use server'
/**
 * Empresa (rede) Server Actions
 *
 * SYS-01 / Plan 07-05:
 * - getEmpresa: read the clinic (rede) record for the authenticated tenant
 * - saveEmpresa: update clinic record (name, cnpj, regime_tributario, phone, address)
 *   — admin/superadmin only; read-only roles blocked by assertNotReadOnly()
 *
 * SECURITY:
 *   1. assertNotReadOnly() — rejects auditor/dpo/socio at action layer (x-read-only header)
 *   2. role gate — only 'admin' | 'superadmin' may mutate
 *   3. tenant scoping — updates filtered by actor.tenant_id (never trusts client-supplied id)
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { empresaSchema } from '@/lib/validators/empresa'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── getEmpresa ───────────────────────────────────────────────────────────────

export async function getEmpresa(): Promise<{
  success: boolean
  empresa?: {
    id: string
    name: string
    cnpj: string | null
    regime_tributario: string | null
    phone: string | null
    address: string | null
    slug: string
  }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clinics')
    .select('id, name, cnpj, regime_tributario, phone, address, slug')
    .eq('id', actor.tenant_id)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Empresa não encontrada' }
  }

  return { success: true, empresa: data }
}

// ─── saveEmpresa ──────────────────────────────────────────────────────────────

export type EmpresaActionInput = z.infer<typeof empresaSchema>

export async function saveEmpresa(input: EmpresaActionInput): Promise<{
  success: boolean
  error?: string
}> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer
  await assertNotReadOnly()

  // 2. Validate input
  const parsed = empresaSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 3. Auth + role gate — admin/superadmin only
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 4. Persist — tenant-scoped update (actor.tenant_id from session, never from input)
  const supabase = await createClient()
  const rawDoc = data.cnpj_or_cpf.replace(/\D/g, '')

  const { error: updateError } = await supabase
    .from('clinics')
    .update({
      name: data.name,
      cnpj: rawDoc,
      regime_tributario: data.regime_tributario,
      phone: data.phone ?? null,
      address: data.address ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 5. Audit log (non-PII fields only — document number is metadata, not health data)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'empresa.saved',
    details: {
      name: data.name,
      regime_tributario: data.regime_tributario,
    },
  })

  return { success: true }
}
