'use server'
/**
 * Document Templates Server Actions — Phase 8 (DOC-01)
 *
 * CRUD for document_templates: clinic-scoped, admin-only write, all staff read.
 * Templates contain {{variable}} placeholders filled at document generation time.
 *
 * SECURITY:
 *   1. assertNotReadOnly() — blocks auditor/dpo/socio (x-read-only header)
 *   2. Role gate — admin/superadmin/ti only for mutating operations
 *   3. get_my_tenant_id() RLS — database-level tenant isolation
 *   4. detectVariables() — variable list kept in sync on save
 *
 * Phase: 08-documentos-assinatura-icp-brasil
 */

import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { detectVariables } from '@/lib/documents/template-engine'
import type { DocumentContext } from '@/lib/documents/document-types'

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
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new document template for the caller's clinic.
 * Requires admin/superadmin/ti role.
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  assertNotReadOnly()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const variables = detectVariables(input.content)

  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      name: input.name.trim(),
      category: input.category,
      content: input.content,
      variables,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: 'Erro ao criar modelo de documento' }
  }

  return { success: true, id: data.id }
}

/**
 * Updates an existing document template.
 * Requires admin/superadmin/ti role (enforced by RLS + assertNotReadOnly).
 */
export async function updateTemplate(
  input: UpdateTemplateInput
): Promise<{ success: boolean; error?: string }> {
  assertNotReadOnly()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.category !== undefined) updates.category = input.category
  if (input.content !== undefined) {
    updates.content = input.content
    updates.variables = detectVariables(input.content)
  }
  if (input.is_active !== undefined) updates.is_active = input.is_active

  const { error } = await supabase
    .from('document_templates')
    .update(updates)
    .eq('id', input.id)

  if (error) {
    return { success: false, error: 'Erro ao atualizar modelo de documento' }
  }

  return { success: true }
}

/**
 * Soft-deletes a document template (sets deleted_at).
 * Requires admin/superadmin/ti role.
 */
export async function deleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  assertNotReadOnly()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { error } = await supabase
    .from('document_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: 'Erro ao excluir modelo de documento' }
  }

  return { success: true }
}

/**
 * Lists all active templates for the caller's clinic (via RLS).
 */
export async function listTemplates(
  category?: string
): Promise<{ success: boolean; data?: TemplateListItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  let query = supabase
    .from('document_templates')
    .select('id, name, category, variables, is_active, created_at, updated_at')
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
