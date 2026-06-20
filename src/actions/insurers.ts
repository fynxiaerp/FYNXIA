'use server'
import 'server-only'
/**
 * src/actions/insurers.ts — Operadora de Convênio CRUD (CONV-01, D-26)
 *
 * listInsurers    — clinic-scoped list of insurers
 * createInsurer   — insert under tenant (admin/financeiro only)
 * updateInsurer   — update fields under tenant
 * deactivateInsurer — soft-deactivate (ativo=false)
 *
 * Security:
 *   T-15-25: write gated by role (admin/financeiro per D-18); RLS backstops.
 *   T-15-06: insurerSchema length-bounds cnpj/registroAns + status enum.
 *   No NEXT_PUBLIC_ references.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 * Requirements: CONV-01
 */

import { createClient } from '@/lib/supabase/server'
import { insurerSchema } from '@/lib/validators/insurer'
import type { InsurerInput } from '@/lib/validators/insurer'
import { revalidatePath } from 'next/cache'

// ─── Actor helper ─────────────────────────────────────────────────────────────

type Actor = { id: string; tenant_id: string; role: string }

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Não autenticado' }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) return { error: 'Usuário não encontrado' }
  return { actor }
}

const WRITE_ROLES = ['admin', 'superadmin', 'financeiro'] as const

// ─── listInsurers ─────────────────────────────────────────────────────────────

export async function listInsurers(filters?: {
  status?: string
  ativo?: boolean
}): Promise<{
  success: boolean
  insurers?: Array<{
    id: string
    name: string
    cnpj: string | null
    registro_ans: string | null
    tiss_version: string
    prazo_pagamento_dias: number
    status: string
    ativo: boolean
    contato_email: string | null
    contato_phone: string | null
    connector_id: string | null
    created_at: string
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('insurers')
    .select('id, name, cnpj, registro_ans, tiss_version, prazo_pagamento_dias, status, ativo, contato_email, contato_phone, connector_id, created_at')
    .order('name')

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  return { success: true, insurers: data ?? [] }
}

// ─── createInsurer ────────────────────────────────────────────────────────────

export async function createInsurer(input: InsurerInput): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  const parsed = insurerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as typeof WRITE_ROLES[number])) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('insurers')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      cnpj: data.cnpj ?? null,
      registro_ans: data.registroAns ?? null,
      tiss_version: data.tissVersion,
      prazo_pagamento_dias: data.prazoPagamentoDias,
      contato_email: data.contatoEmail || null,
      contato_phone: data.contatoPhone ?? null,
      connector_id: data.connectorId ?? null,
      status: data.status,
      ativo: true,
    })
    .select('id')
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Erro ao criar operadora' }

  revalidatePath('/clinica/financeiro/faturamento/operadoras')
  return { success: true, id: row.id }
}

// ─── updateInsurer ────────────────────────────────────────────────────────────

export async function updateInsurer(
  id: string,
  input: Partial<InsurerInput>,
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as typeof WRITE_ROLES[number])) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  // Build partial update from provided fields only
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates['name'] = input.name
  if (input.cnpj !== undefined) updates['cnpj'] = input.cnpj ?? null
  if (input.registroAns !== undefined) updates['registro_ans'] = input.registroAns ?? null
  if (input.tissVersion !== undefined) updates['tiss_version'] = input.tissVersion
  if (input.prazoPagamentoDias !== undefined) updates['prazo_pagamento_dias'] = input.prazoPagamentoDias
  if (input.contatoEmail !== undefined) updates['contato_email'] = input.contatoEmail || null
  if (input.contatoPhone !== undefined) updates['contato_phone'] = input.contatoPhone ?? null
  if (input.connectorId !== undefined) updates['connector_id'] = input.connectorId ?? null
  if (input.status !== undefined) updates['status'] = input.status

  if (Object.keys(updates).length === 0) {
    return { success: true } // nothing to update
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('insurers')
    .update(updates)
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clinica/financeiro/faturamento/operadoras')
  return { success: true }
}

// ─── deactivateInsurer ────────────────────────────────────────────────────────

export async function deactivateInsurer(id: string): Promise<{
  success: boolean
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!WRITE_ROLES.includes(actor.role as typeof WRITE_ROLES[number])) {
    return { success: false, error: 'Permissão insuficiente' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('insurers')
    .update({ ativo: false, status: 'inativo' })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clinica/financeiro/faturamento/operadoras')
  return { success: true }
}
