'use server'
// src/actions/categories.ts
// FCAD-01: Server Actions for financial_categories → chart_of_accounts mapping.
// T-14-11: updateCategoryAccount validates accountId is same-tenant LEAF account matching type.
// T-14-10: Admin write gate on updateCategoryAccount.

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'

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

// ─── CategoryWithAccount ──────────────────────────────────────────────────────

export interface CategoryWithAccount {
  id: string
  name: string
  type: string | null
  account_id: string | null
  account_name: string | null
  account_code: string | null
}

// ─── listCategoriesWithAccounts ───────────────────────────────────────────────
// JOIN financial_categories → chart_of_accounts on account_id.
// Array-or-object guard on join result (mirrors listTransactions/listCostCenters pattern).

export async function listCategoriesWithAccounts(): Promise<{
  success: boolean
  categories?: CategoryWithAccount[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_categories')
    .select('id, name, type, account_id, chart_of_accounts(name, code)')
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  const categories: CategoryWithAccount[] = (data ?? []).map((row: {
    id: string
    name: string
    type: string | null
    account_id: string | null
    chart_of_accounts: { name: string; code: string } | { name: string; code: string }[] | null
  }) => {
    const acctJoin = row.chart_of_accounts
    const acctData = acctJoin
      ? (Array.isArray(acctJoin) ? acctJoin[0] : acctJoin) ?? null
      : null
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      account_id: row.account_id,
      account_name: acctData?.name ?? null,
      account_code: acctData?.code ?? null,
    }
  })

  return { success: true, categories }
}

// ─── updateCategoryAccount ────────────────────────────────────────────────────
// T-14-10: admin/superadmin gate
// T-14-11: Validate accountId is:
//   1. A LEAF account (type IN ('receita','despesa') — not 'grupo')
//   2. Same-tenant clinic (RLS already blocks cross-tenant reads, but we return a friendly error)
//   3. accountId null → allowed (unmap)

const updateCategoryAccountSchema = z.object({
  categoryId: z.string().uuid('ID da categoria inválido'),
  accountId: z.string().uuid('ID da conta contábil inválido').nullable(),
})

export async function updateCategoryAccount(input: {
  categoryId: string
  accountId: string | null
}): Promise<{ success: boolean; error?: string }> {
  const parsed = updateCategoryAccountSchema.safeParse(input)
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
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem mapear categorias a contas contábeis' }
  }

  const supabase = await createClient()

  if (data.accountId !== null) {
    // Fetch the target account — RLS ensures it belongs to the authenticated tenant,
    // but we also explicitly confirm clinic_id = actor.tenant_id (T-14-11 defense-in-depth)
    const { data: account, error: accountError } = await supabase
      .from('chart_of_accounts')
      .select('id, type, clinic_id')
      .eq('id', data.accountId)
      .single()

    if (accountError || !account) {
      return { success: false, error: 'Conta contábil não encontrada' }
    }

    // T-14-11: cross-tenant check (defense-in-depth — RLS already blocks, but return friendly error)
    if (account.clinic_id !== actor.tenant_id) {
      return { success: false, error: 'Conta contábil não pertence a esta clínica' }
    }

    // T-14-11: LEAF type check — categories may only map to leaf accounts (receita or despesa)
    if (account.type === 'grupo') {
      return { success: false, error: 'Somente contas folha (receita/despesa) podem ser associadas a categorias — contas do tipo grupo não são permitidas' }
    }
  }

  const { error: updateError } = await supabase
    .from('financial_categories')
    .update({ account_id: data.accountId })
    .eq('id', data.categoryId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'category_account.mapped',
    details: { category_id: data.categoryId, account_id: data.accountId },
  })

  return { success: true }
}
