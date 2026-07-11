'use server'
import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Verbatim copy from src/actions/suppliers.ts (getActor pattern)

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

export type AlertRow = {
  id: string
  tipo: string
  product_id: string
  product_name: string
  unit_id: string
  batch_id: string | null
  created_at: string
}

// ─── listActiveAlerts ────────────────────────────────────────────────────────
// EST-03 (D-17): leitura de alertas não resolvidos para o banner/dashboard.
// RLS stock_alerts_tenant_read escopa por clinic_id automaticamente (createClient).

export async function listActiveAlerts(
  unitId?: string
): Promise<{ success: boolean; error?: string; data?: AlertRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('stock_alerts')
    .select('id, tipo, product_id, unit_id, batch_id, created_at, products(name)')
    .eq('resolvido', false)
    .order('created_at', { ascending: false })

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const rows: AlertRow[] = (data ?? []).map((row) => {
    const product = row.products as unknown as { name: string } | null
    return {
      id: row.id,
      tipo: row.tipo,
      product_id: row.product_id,
      product_name: product?.name ?? '',
      unit_id: row.unit_id,
      batch_id: row.batch_id,
      created_at: row.created_at,
    }
  })

  return { success: true, data: rows }
}

// ─── getAlertCounts ──────────────────────────────────────────────────────────
// minimo/validade: contagem de stock_alerts não resolvidos por tipo.
// negativo: contagem de combinações produto+unidade com saldo agregado < 0
// (SUM product_batches.saldo_disponivel agrupado por product_id+unit_id).

export async function getAlertCounts(
  unitId?: string
): Promise<{ minimo: number; validade: number; negativo: number }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { minimo: 0, validade: 0, negativo: 0 }
  }

  const supabase = await createClient()

  let alertsQuery = supabase
    .from('stock_alerts')
    .select('tipo')
    .eq('resolvido', false)

  if (unitId) {
    alertsQuery = alertsQuery.eq('unit_id', unitId)
  }

  const { data: alerts, error: alertsError } = await alertsQuery

  let minimo = 0
  let validade = 0
  if (!alertsError) {
    for (const a of alerts ?? []) {
      if (a.tipo === 'minimo') minimo++
      else if (a.tipo === 'validade') validade++
    }
  }

  let batchesQuery = supabase
    .from('product_batches')
    .select('product_id, unit_id, saldo_disponivel')
    .is('deleted_at', null)

  if (unitId) {
    batchesQuery = batchesQuery.eq('unit_id', unitId)
  }

  const { data: batches, error: batchesError } = await batchesQuery

  let negativo = 0
  if (!batchesError) {
    const saldoByProductUnit = new Map<string, number>()
    for (const b of batches ?? []) {
      const key = `${b.product_id}:${b.unit_id}`
      saldoByProductUnit.set(key, (saldoByProductUnit.get(key) ?? 0) + b.saldo_disponivel)
    }
    for (const saldo of saldoByProductUnit.values()) {
      if (saldo < 0) negativo++
    }
  }

  return { minimo, validade, negativo }
}
