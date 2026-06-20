'use server'
// src/actions/chart-of-accounts.ts
// FCAD-01: Server Actions for chart_of_accounts cadastro management.
// T-14-10: Admin write gate — role IN ('admin','superadmin') on every mutation.
// T-14-12: Cycle/depth guard — reject parent depth >= 2 (max 3 levels).
// T-14-11: Not applicable here (cross-tenant is blocked by RLS; deleteAccount checks linked txns).

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { buildTree, nextChildCode } from '@/lib/financeiro/chart-tree'
import type { AccountNode } from '@/lib/financeiro/chart-tree'

// ─── Helper: get authenticated actor ─────────────────────────────────────────

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

const WRITE_ROLES = ['admin', 'superadmin'] as const

// ─── listAccountsTree ────────────────────────────────────────────────────────
// Fetches all accounts for the tenant's clinic, computes depth from code dots,
// builds and returns the nested AccountNode tree.
// (Pitfall 4: CTE recursive not supported via Supabase JS SDK — fetch flat + buildTree)

export async function listAccountsTree(): Promise<{
  success: boolean
  tree?: AccountNode[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, parent_id, code, name, type, ativo')
    .order('code')

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    // depth = number of dots in code (e.g. '1.1.1' has 2 dots → depth 2)
    depth: (row.code.match(/\./g) ?? []).length,
  }))

  return { success: true, tree: buildTree(rows) }
}

// ─── createAccount ───────────────────────────────────────────────────────────
// T-14-10: admin/superadmin gate
// T-14-12: cycle/depth guard — parentDepth >= 2 → reject
// Unique code via (clinic_id, code) index → catch 23505

const createAccountSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  type: z.enum(['grupo', 'receita', 'despesa'], {
    errorMap: () => ({ message: 'Tipo deve ser grupo, receita ou despesa' }),
  }),
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function createAccount(input: {
  name: string
  type: 'grupo' | 'receita' | 'despesa'
  parentId?: string | null
  code?: string | null
  ativo?: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Validate
  const parsed = createAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // 2. Auth + role gate (T-14-10)
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar o plano de contas' }
  }

  const supabase = await createClient()

  let parentCode: string | null = null
  let computedCode = data.code ?? null

  if (data.parentId) {
    // Fetch parent to validate depth and get code
    const { data: parent, error: parentError } = await supabase
      .from('chart_of_accounts')
      .select('id, code, clinic_id')
      .eq('id', data.parentId)
      .single()

    if (parentError || !parent) {
      return { success: false, error: 'Conta pai não encontrada' }
    }

    // T-14-12: Depth guard — parent depth >= 2 means child would be depth 3 (max 3 levels: 0,1,2)
    const parentDepth = (parent.code.match(/\./g) ?? []).length
    if (parentDepth >= 2) {
      return {
        success: false,
        error: 'Profundidade máxima do plano de contas é 3 níveis',
      }
    }

    parentCode = parent.code

    // Auto-compute code if not supplied
    if (!computedCode) {
      // Count existing children of this parent
      const { count } = await supabase
        .from('chart_of_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', data.parentId)

      computedCode = nextChildCode(parentCode, count ?? 0)
    }
  } else if (!computedCode) {
    // Root-level: count existing roots
    const { count } = await supabase
      .from('chart_of_accounts')
      .select('id', { count: 'exact', head: true })
      .is('parent_id', null)

    computedCode = nextChildCode(null, count ?? 0)
  }

  // 3. INSERT
  const { data: inserted, error: insertError } = await supabase
    .from('chart_of_accounts')
    .insert({
      clinic_id: actor.tenant_id,
      parent_id: data.parentId ?? null,
      code: computedCode!,
      name: data.name,
      type: data.type,
      ativo: data.ativo ?? true,
    })
    .select('id')
    .single()

  if (insertError) {
    // 23505 = unique_violation (clinic_id, code) unique index
    if (insertError.code === '23505') {
      return { success: false, error: 'Código de conta já existe' }
    }
    return { success: false, error: insertError.message }
  }

  if (!inserted) {
    return { success: false, error: 'Erro ao criar conta' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'chart_account.created',
    details: { id: inserted.id, code: computedCode, name: data.name, type: data.type },
  })

  return { success: true, id: inserted.id }
}

// ─── updateAccount ───────────────────────────────────────────────────────────
// Immutable: type and parent_id — changing these would break the tree structure.
// Mutable: name, ativo, code (rename/re-code by admin).

const updateAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  ativo: z.boolean().optional(),
  code: z.string().optional(),
})

export async function updateAccount(input: {
  id: string
  name?: string
  ativo?: boolean
  code?: string
}): Promise<{ success: boolean; error?: string }> {
  const parsed = updateAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar o plano de contas' }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) patch.name = data.name
  if (data.ativo !== undefined) patch.ativo = data.ativo
  if (data.code !== undefined) patch.code = data.code

  const supabase = await createClient()
  const { error } = await supabase
    .from('chart_of_accounts')
    .update(patch)
    .eq('id', data.id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Código de conta já existe' }
    }
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'chart_account.updated',
    details: { id: data.id, patch },
  })

  return { success: true }
}

// ─── deactivateAccount ───────────────────────────────────────────────────────
// Convenience wrapper — updateAccount with ativo: false.

export async function deactivateAccount(id: string): Promise<{ success: boolean; error?: string }> {
  return updateAccount({ id, ativo: false })
}

// ─── deleteAccount ───────────────────────────────────────────────────────────
// Pre-check: if any financial_transactions reference this account → return friendly UI-SPEC message.
// (Pitfall 3: never expose Postgres 23503 to the user)
// T-14-12: ON DELETE RESTRICT on chart_of_accounts.parent_id also prevents deleting parents with children.

export async function deleteAccount(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    return { success: false, error: 'ID inválido' }
  }

  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as 'admin' | 'superadmin')) {
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar o plano de contas' }
  }

  const supabase = await createClient()

  // Pre-check for linked transactions (Pitfall 3 — UI-SPEC exact string)
  const { data: linkedTx } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('account_id', id)
    .limit(1)

  if (linkedTx && linkedTx.length > 0) {
    return {
      success: false,
      error: 'Não é possível excluir — conta possui lançamentos vinculados. Desative a conta para ocultá-la dos seletores.',
    }
  }

  const { error } = await supabase
    .from('chart_of_accounts')
    .delete()
    .eq('id', id)

  if (error) {
    // Catch 23503 from children or other FK references (backstop after pre-check)
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Não é possível excluir — conta possui lançamentos vinculados. Desative a conta para ocultá-la dos seletores.',
      }
    }
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'chart_account.deleted',
    details: { id },
  })

  return { success: true }
}
