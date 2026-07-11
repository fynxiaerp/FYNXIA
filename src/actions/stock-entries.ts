'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { stockEntrySchema, type StockEntryInput } from '@/lib/validators/product'

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

// ─── Role gate ───────────────────────────────────────────────────────────────
// D-18: writers restricted to admin/superadmin, mirrors stock_entries_admin_write RLS policy.

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type StockEntryRow = {
  id: string
  product_id: string
  product_name: string
  supplier_id: string | null
  supplier_name: string | null
  numero_lote: string | null
  data_validade: string | null
  qtd: number
  custo_unitario: number
  custo_medio_apos: number
  nota_fiscal: string | null
  created_by_name: string | null
  created_at: string
}

// ─── createStockEntry ──────────────────────────────────────────────────────────
// D-10: entrada manual de estoque — cria lote (product_batches) + recalcula custo
// médio móvel (D-02) + registra a entrada (stock_entries). unit_id vem separado do
// payload validado por stockEntrySchema (D-23: entrada é sempre por unidade).

export async function createStockEntry(
  input: StockEntryInput & { unit_id: string }
): Promise<{ success: boolean; error?: string; id?: string }> {
  // 1. Auth + role gate
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const { unit_id, ...rest } = input
  if (!unit_id) {
    return { success: false, error: 'Unidade obrigatória' }
  }

  // 1b. Validate (stockEntrySchema.parse) — categoria_produto drives conditional rules
  const parsed = stockEntrySchema.safeParse(rest)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  // 2. Entrada atômica via RPC (WR-04): lote + entrada + custo médio móvel numa
  //    única transação, com SELECT ... FOR UPDATE no produto para serializar
  //    entradas concorrentes (evita lost update do custo médio e lote órfão).
  //    O custo médio (D-02) é calculado dentro do RPC sobre o saldo já travado.
  const { data: entryId, error: rpcError } = await supabase.rpc('create_stock_entry', {
    p_clinic_id: actor.tenant_id,
    p_unit_id: unit_id,
    p_product_id: data.product_id,
    p_numero_lote: data.numero_lote,
    p_numero_anvisa: data.numero_anvisa_lote ?? null,
    p_data_validade: data.data_validade ?? null,
    p_qtd: data.qtd,
    p_custo_unitario: data.custo_unitario,
    p_supplier_id: data.supplier_id ?? null,
    p_nota_fiscal: data.nota_fiscal ?? null,
    p_created_by: actor.id,
  })

  if (rpcError) {
    return { success: false, error: rpcError.message }
  }

  revalidatePath('/clinica/estoque/entradas')
  revalidatePath('/clinica/estoque/produtos')

  return { success: true, id: entryId as string }
}

// ─── listStockEntries ───────────────────────────────────────────────────────────

export async function listStockEntries(opts?: {
  productId?: string
  from?: string
  to?: string
}): Promise<{ success: boolean; error?: string; data?: StockEntryRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('stock_entries')
    .select(
      `id, product_id, supplier_id, qtd, custo_unitario, custo_medio_apos, nota_fiscal, created_at,
       products(name),
       suppliers(name),
       product_batches(numero_lote, data_validade),
       users(full_name)`
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (opts?.productId) {
    query = query.eq('product_id', opts.productId)
  }
  if (opts?.from) {
    query = query.gte('created_at', opts.from)
  }
  if (opts?.to) {
    query = query.lte('created_at', opts.to)
  }

  const { data: rows, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const result: StockEntryRow[] = (rows ?? []).map((row: {
    id: string
    product_id: string
    supplier_id: string | null
    qtd: number
    custo_unitario: number
    custo_medio_apos: number
    nota_fiscal: string | null
    created_at: string
    products: { name: string } | { name: string }[] | null
    suppliers: { name: string } | { name: string }[] | null
    product_batches: { numero_lote: string; data_validade: string | null } | { numero_lote: string; data_validade: string | null }[] | null
    users: { full_name: string } | { full_name: string }[] | null
  }) => {
    const product = row.products ? (Array.isArray(row.products) ? row.products[0] : row.products) : null
    const supplier = row.suppliers ? (Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers) : null
    const batch = row.product_batches
      ? Array.isArray(row.product_batches)
        ? row.product_batches[0]
        : row.product_batches
      : null
    const createdBy = row.users ? (Array.isArray(row.users) ? row.users[0] : row.users) : null

    return {
      id: row.id,
      product_id: row.product_id,
      product_name: product?.name ?? '',
      supplier_id: row.supplier_id,
      supplier_name: supplier?.name ?? null,
      numero_lote: batch?.numero_lote ?? null,
      data_validade: batch?.data_validade ?? null,
      qtd: row.qtd,
      custo_unitario: row.custo_unitario,
      custo_medio_apos: row.custo_medio_apos,
      nota_fiscal: row.nota_fiscal,
      created_by_name: createdBy?.full_name ?? null,
      created_at: row.created_at,
    }
  })

  return { success: true, data: result }
}
