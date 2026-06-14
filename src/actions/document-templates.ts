'use server'
/**
 * Document Templates Server Actions — Phase 8 (DOC-01)
 *
 * CRUD for document_templates: clinic-scoped, admin/superadmin/ti write, all staff read.
 * Templates contain {{variable}} placeholders filled at document generation time.
 *
 * SECURITY:
 *   1. assertNotReadOnly()    — blocks auditor/dpo/socio (x-read-only header)
 *   2. Role gate              — admin/superadmin/ti only for mutating operations
 *   3. Zod validation         — name/category/content validated before insert/update
 *   4. get_my_tenant_id() RLS — database-level tenant isolation (createClient)
 *   5. detectVariables()      — variable list kept in sync on save
 *   6. logBusinessEvent       — audit trail without secrets
 *
 * Phase: 08-documentos-assinatura-icp-brasil
 */

import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { detectVariables } from '@/lib/documents/template-engine'
import { documentTemplateSchema } from '@/lib/validators/document-template'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string
  category: string
  content: string
}

export interface UpdateTemplateInput {
  id: string
  name?: string
  category?: string
  content?: string
  is_active?: boolean
}

export interface TemplateListItem {
  id: string
  name: string
  category: string
  content: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new document template for the caller's clinic.
 * Requires admin/superadmin/ti role.
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Read-only gate — blocks auditor/dpo/socio at action layer
  await assertNotReadOnly()

  // 2. Auth + role gate — admin/superadmin/ti only
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 3. Validate via schema (name/category/content)
  const parsed = documentTemplateSchema.safeParse({
    name: input.name,
    category: input.category || 'outro',
    content: input.content,
    is_active: true,
  })

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? 'Dados inválidos'
    return { success: false, error: firstError }
  }

  // 4. Detect variables from content
  const variables = detectVariables(parsed.data.content)

  // 5. Insert into document_templates (RLS: clinic_id = get_my_tenant_id())
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      content: parsed.data.content,
      variables,
      is_active: parsed.data.is_active,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: 'Erro ao criar modelo de documento' }
  }

  // 6. Audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'document_template.created',
    details: {
      template_id: data.id,
      name: parsed.data.name,
      category: parsed.data.category,
      variable_count: variables.length,
    },
  })

  return { success: true, id: data.id }
}

/**
 * Updates an existing document template.
 * Requires admin/superadmin/ti role.
 */
export async function updateTemplate(
  input: UpdateTemplateInput
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate
  await assertNotReadOnly()

  // 2. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 3. Build partial update, validate changed fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) {
    const nameResult = documentTemplateSchema.shape.name.safeParse(input.name)
    if (!nameResult.success) {
      return { success: false, error: nameResult.error.errors[0]?.message ?? 'Nome inválido' }
    }
    updates.name = nameResult.data.trim()
  }

  if (input.category !== undefined) {
    const catResult = documentTemplateSchema.shape.category.safeParse(input.category || 'outro')
    if (!catResult.success) {
      return { success: false, error: catResult.error.errors[0]?.message ?? 'Categoria inválida' }
    }
    updates.category = catResult.data
  }

  if (input.content !== undefined) {
    const contentResult = documentTemplateSchema.shape.content.safeParse(input.content)
    if (!contentResult.success) {
      return { success: false, error: contentResult.error.errors[0]?.message ?? 'Conteúdo inválido' }
    }
    updates.content = contentResult.data
    updates.variables = detectVariables(contentResult.data)
  }

  if (input.is_active !== undefined) {
    updates.is_active = input.is_active
  }

  // 4. Update (RLS: clinic_id = get_my_tenant_id())
  const supabase = await createClient()
  const { error } = await supabase
    .from('document_templates')
    .update(updates)
    .eq('id', input.id)
    .is('deleted_at', null)

  if (error) {
    return { success: false, error: 'Erro ao atualizar modelo de documento' }
  }

  // 5. Audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'document_template.updated',
    details: {
      template_id: input.id,
      changed_fields: Object.keys(updates).filter((k) => k !== 'updated_at'),
    },
  })

  return { success: true }
}

/**
 * Soft-deletes a document template (sets deleted_at).
 * Requires admin/superadmin/ti role.
 */
export async function deleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Read-only gate
  await assertNotReadOnly()

  // 2. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!['admin', 'superadmin', 'ti'].includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // 3. Soft delete (RLS: clinic_id = get_my_tenant_id())
  const supabase = await createClient()
  const { error } = await supabase
    .from('document_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    return { success: false, error: 'Erro ao excluir modelo de documento' }
  }

  // 4. Audit log
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'document_template.deleted',
    details: { template_id: id },
  })

  return { success: true }
}

/**
 * Lists all active (non-deleted) templates for the caller's clinic (via RLS).
 * Uses createClient() so RLS (get_my_tenant_id()) enforces tenant isolation.
 */
export async function listTemplates(
  category?: string
): Promise<{ success: boolean; data?: TemplateListItem[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('document_templates')
    .select('id, name, category, content, variables, is_active, created_at, updated_at')
    .is('deleted_at', null)
    .order('name')

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: 'Erro ao listar modelos de documento' }
  }

  return { success: true, data: (data ?? []) as TemplateListItem[] }
}
