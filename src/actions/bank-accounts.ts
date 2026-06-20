'use server'
// src/actions/bank-accounts.ts
// FCAD-01: Server Actions for bank_accounts cadastro management.
// T-14-10: Admin write gate — role IN ('admin','superadmin') on every mutation.

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { isMoney2dp } from '@/lib/validators/charge'

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

// ─── BankAccountRow ───────────────────────────────────────────────────────────

export interface BankAccountRow {
  id: string
  name: string
  banco: string | null
  agencia: string | null
  conta: string | null
  saldo_inicial: number
  ativo: boolean
}

// ─── listBankAccounts ─────────────────────────────────────────────────────────

export async function listBankAccounts(): Promise<{
  success: boolean
  accounts?: BankAccountRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, name, banco, agencia, conta, saldo_inicial, ativo')
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, accounts: (data ?? []) as BankAccountRow[] }
}

// ─── createBankAccount ────────────────────────────────────────────────────────
// T-14-10: admin/superadmin gate
// saldo_inicial validated via isMoney2dp (NUMERIC(12,2) invariant — CLAUDE.md)

const createBankAccountSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  banco: z.string().max(100).optional().nullable(),
  agencia: z.string().max(20).optional().nullable(),
  conta: z.string().max(30).optional().nullable(),
  saldoInicial: z
    .number()
    .refine(isMoney2dp, { message: 'Saldo inicial deve ter no máximo 2 casas decimais' }),
})

export async function createBankAccount(input: {
  name: string
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  saldoInicial: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = createBankAccountSchema.safeParse(input)
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
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar contas correntes' }
  }

  const supabase = await createClient()
  const { data: inserted, error: insertError } = await supabase
    .from('bank_accounts')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      banco: data.banco ?? null,
      agencia: data.agencia ?? null,
      conta: data.conta ?? null,
      saldo_inicial: data.saldoInicial,
      ativo: true,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar conta corrente' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'bank_account.created',
    details: { id: inserted.id, name: data.name },
  })

  return { success: true, id: inserted.id }
}

// ─── updateBankAccount ────────────────────────────────────────────────────────

const updateBankAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  banco: z.string().max(100).optional().nullable(),
  agencia: z.string().max(20).optional().nullable(),
  conta: z.string().max(30).optional().nullable(),
  saldoInicial: z
    .number()
    .refine(isMoney2dp, { message: 'Saldo inicial deve ter no máximo 2 casas decimais' })
    .optional(),
  ativo: z.boolean().optional(),
})

export async function updateBankAccount(input: {
  id: string
  name?: string
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  saldoInicial?: number
  ativo?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const parsed = updateBankAccountSchema.safeParse(input)
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
    return { success: false, error: 'Permissão insuficiente — apenas administradores podem gerenciar contas correntes' }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) patch.name = data.name
  if (data.banco !== undefined) patch.banco = data.banco
  if (data.agencia !== undefined) patch.agencia = data.agencia
  if (data.conta !== undefined) patch.conta = data.conta
  if (data.saldoInicial !== undefined) patch.saldo_inicial = data.saldoInicial
  if (data.ativo !== undefined) patch.ativo = data.ativo

  const supabase = await createClient()
  const { error } = await supabase
    .from('bank_accounts')
    .update(patch)
    .eq('id', data.id)

  if (error) {
    return { success: false, error: error.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'bank_account.updated',
    details: { id: data.id, patch },
  })

  return { success: true }
}
