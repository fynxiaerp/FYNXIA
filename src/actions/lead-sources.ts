'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { leadSourceSchema } from '@/lib/validators/crc'

/**
 * Lead source catalog CRUD (CRC-01, D-03)
 *
 * Fixed, manageable list — never free text. Seeded on clinic creation
 * (seed_lead_sources_on_clinic trigger, 7 default rows). Admin/superadmin
 * can add new sources; deactivation (soft-delete) is the only removal path
 * ("Desative-a em vez de excluir" — a source may already be referenced by
 * leads, so hard delete is never offered).
 *
 * SECURITY:
 *   1. assertNotReadOnly() — rejects auditor/dpo/socio at action layer
 *   2. ADMIN_ROLES gate — only admin/superadmin manage the catalog
 *   3. clinic_id always set from actor.tenant_id (never from client input)
 *   4. RLS (lead_sources_write) enforces tenant isolation as DB backstop
 */

// ─── Helper: get authenticated actor ────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
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
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { error: 'Usuário não encontrado' }
  }

  return { actor }
}

// Admin-only for source catalog management (source list feeds ROI/conversion
// aggregation and must stay standardized — not the broader CRC WRITER_ROLES).
const ADMIN_ROLES = ['admin', 'superadmin'] as const

export type LeadSourceRow = {
  id: string
  name: string
  is_default: boolean
  ativo: boolean
}

// ─── listLeadSources ────────────────────────────────────────────────────────
// Returns all sources (including inactive) for admin management. Callers that
// populate the lead-creation Select must filter by `ativo` themselves.

export async function listLeadSources(): Promise<{
  success: boolean
  sources?: LeadSourceRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lead_sources')
    .select('id, name, is_default, ativo')
    .order('is_default', { ascending: false })
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, sources: data ?? [] }
}

// ─── createLeadSource ───────────────────────────────────────────────────────
// D-03: admin can add new origins to the fixed catalog.

export async function createLeadSource(rawInput: unknown): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  await assertNotReadOnly()

  const parsed = leadSourceSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(ADMIN_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: inserted, error: insertError } = await supabase
    .from('lead_sources')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      is_default: false,
      ativo: true,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    // 23505 = unique_violation (idx_lead_sources_name — lower(name) já existe no tenant)
    if (insertError?.code === '23505') {
      return { success: false, error: 'Origem já existe' }
    }
    return { success: false, error: insertError?.message ?? 'Erro ao criar origem' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.lead_source.created',
    details: { lead_source_id: inserted.id, name: data.name },
  })

  revalidatePath('/clinica/crc')

  return { success: true, id: inserted.id }
}

// ─── toggleLeadSourceActive ─────────────────────────────────────────────────
// D-03: soft-delete path — "Desative-a em vez de excluir". Never hard-delete
// a source, since leads may already reference it.

export async function toggleLeadSourceActive(
  id: string,
  ativo: boolean
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(ADMIN_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('lead_sources')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (error) {
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'crc.lead_source.toggled',
    details: { lead_source_id: id, ativo },
  })

  revalidatePath('/clinica/crc')

  return { success: true }
}
