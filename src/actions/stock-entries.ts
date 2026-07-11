'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { stockEntrySchema, type StockEntryInput } from '@/lib/validators/product'
import { calcularCustoMedioMovel } from '@/lib/stock/custo-medio'

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
  qtd: number
  custo_unitario: number
  custo_medio_apos: number
  nota_fiscal: string | null
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

  // 2. Saldo atual da unidade = SUM(product_batches.saldo_disponivel) WHERE product_id AND unit_id
  const { data: batches, error: batchesError } = await supabase
    .from('product_batches')
    .select('saldo_disponivel')
    .eq('product_id', data.product_id)
    .eq('unit_id', unit_id)
    .is('deleted_at', null)

  if (batchesError) {
    return { success: false, error: batchesError.message }
  }

  const saldoAtual = (batches ?? []).reduce((sum, b) => sum + b.saldo_disponivel, 0)

  // Ler products.custo_medio atual
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('custo_medio')
    .eq('id', data.product_id)
    .single()

  if (productError || !product) {
    return { success: false, error: 'Produto não encontrado' }
  }

  const custoAnterior = product.custo_medio

  // 3. custo_medio_movel D-02
  const novoCustoMedio = calcularCustoMedioMovel(saldoAtual, custoAnterior, data.qtd, data.custo_unitario)

  // 4. Insert em product_batches (novo lote)
  const { data: batch, error: batchInsertError } = await supabase
    .from('product_batches')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id,
      product_id: data.product_id,
      numero_lote: data.numero_lote,
      numero_anvisa: data.numero_anvisa_lote ?? null,
      data_validade: data.data_validade ?? null,
      qtd_inicial: data.qtd,
      saldo_disponivel: data.qtd,
      custo_unitario: data.custo_unitario,
    })
    .select('id')
    .single()

  if (batchInsertError || !batch) {
    return { success: false, error: batchInsertError?.message ?? 'Erro ao criar lote' }
  }

  // 5. Insert em stock_entries
  const { data: entry, error: entryInsertError } = await supabase
    .from('stock_entries')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id,
      product_id: data.product_id,
      batch_id: batch.id,
      supplier_id: data.supplier_id ?? null,
      qtd: data.qtd,
      custo_unitario: data.custo_unitario,
      custo_medio_apos: novoCustoMedio,
      nota_fiscal: data.nota_fiscal ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (entryInsertError || !entry) {
    return { success: false, error: entryInsertError?.message ?? 'Erro ao registrar entrada' }
  }

  // 6. Update products.custo_medio (denormalizado network-level — D-02 comentário)
  const { error: updateError } = await supabase
    .from('products')
    .update({ custo_medio: novoCustoMedio })
    .eq('id', data.product_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/clinica/estoque/entradas')
  revalidatePath('/clinica/estoque/produtos')

  return { success: true, id: entry.id }
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
       suppliers(name)`
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
  }) => {
    const product = row.products ? (Array.isArray(row.products) ? row.products[0] : row.products) : null
    const supplier = row.suppliers ? (Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers) : null

    return {
      id: row.id,
      product_id: row.product_id,
      product_name: product?.name ?? '',
      supplier_id: row.supplier_id,
      supplier_name: supplier?.name ?? null,
      qtd: row.qtd,
      custo_unitario: row.custo_unitario,
      custo_medio_apos: row.custo_medio_apos,
      nota_fiscal: row.nota_fiscal,
      created_at: row.created_at,
    }
  })

  return { success: true, data: result }
}
