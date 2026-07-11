'use server'
import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Verbatim copy from src/actions/suppliers.ts (getActor pattern) — read-only gate,
// tenant isolation itself is enforced by product_batches_tenant_read RLS policy.

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductBatchRow = {
  id: string
  numero_lote: string
  numero_anvisa: string | null
  data_validade: string | null
  qtd_inicial: number
  saldo_disponivel: number
  custo_unitario: number
}

// ─── listProductBatches ────────────────────────────────────────────────────────
// D-11: lotes ordenados FIFO (mais antigo primeiro) por produto + unidade.

export async function listProductBatches(
  productId: string,
  unitId: string
): Promise<{ success: boolean; error?: string; data?: ProductBatchRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('product_batches')
    .select('id, numero_lote, numero_anvisa, data_validade, qtd_inicial, saldo_disponivel, custo_unitario')
    .eq('product_id', productId)
    .eq('unit_id', unitId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}
