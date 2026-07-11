'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { productSchema, type ProductInput } from '@/lib/validators/product'
import type { Database } from '@/types/database.types'

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
// D-18: role 'operacional' not confirmed in role enum (Pitfall 8 RESEARCH) — writers
// restricted to admin/superadmin only, mirrors products_admin_write RLS policy.

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = Database['public']['Tables']['products']['Row']

export type ProductStatus = 'normal' | 'baixo' | 'critico' | 'negativo'

export type ProductWithSaldo = ProductRow & {
  saldo: number
  status: ProductStatus
}

// ─── Status derivation ────────────────────────────────────────────────────────
// negativo: saldo < 0
// critico: saldo <= 0 (não negativo) OU saldo <= estoque_minimo * 0.5
// baixo: saldo <= estoque_minimo
// normal: caso contrário

function deriveProductStatus(saldo: number, estoqueMinimo: number): ProductStatus {
  if (saldo < 0) return 'negativo'
  if (saldo <= estoqueMinimo * 0.5) return 'critico'
  if (saldo <= estoqueMinimo) return 'baixo'
  return 'normal'
}

const STATUS_ORDER: Record<ProductStatus, number> = {
  negativo: 0,
  critico: 1,
  baixo: 2,
  normal: 3,
}

// ─── createProduct ────────────────────────────────────────────────────────────
// EST-01: cadastro de produto — categoria, unidade, estoque mínimo/máximo, fornecedor preferido

export async function createProduct(
  input: ProductInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const parsed = productSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('products')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      sku: data.sku ?? null,
      category: data.category,
      unidade_medida: data.unidade_medida,
      estoque_minimo: data.estoque_minimo,
      estoque_maximo: data.estoque_maximo ?? null,
      preferred_supplier_id: data.preferred_supplier_id ?? null,
      numero_anvisa: data.numero_anvisa_produto ?? null,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Erro ao criar produto' }
  }

  revalidatePath('/clinica/estoque/produtos')

  return { success: true, id: row.id }
}

// ─── updateProduct ────────────────────────────────────────────────────────────
// productSchema uses .superRefine() (ZodEffects) — no .partial() available. Merge
// current row + partial input, then validate the FULL merged object through
// productSchema so the implante→ANVISA superRefine rule still applies on update.

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('products')
    .select('name, sku, category, unidade_medida, estoque_minimo, estoque_maximo, preferred_supplier_id, numero_anvisa')
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)
    .single()

  if (fetchError || !current) {
    return { success: false, error: 'Produto não encontrado' }
  }

  const merged: ProductInput = {
    name: input.name ?? current.name,
    sku: input.sku !== undefined ? input.sku : current.sku,
    category: (input.category ?? current.category) as ProductInput['category'],
    unidade_medida: (input.unidade_medida ?? current.unidade_medida) as ProductInput['unidade_medida'],
    estoque_minimo: input.estoque_minimo ?? current.estoque_minimo,
    estoque_maximo: input.estoque_maximo !== undefined ? input.estoque_maximo : current.estoque_maximo,
    preferred_supplier_id:
      input.preferred_supplier_id !== undefined ? input.preferred_supplier_id : current.preferred_supplier_id,
    numero_anvisa_produto:
      input.numero_anvisa_produto !== undefined ? input.numero_anvisa_produto : current.numero_anvisa,
  }

  const parsed = productSchema.safeParse(merged)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const { error } = await supabase
    .from('products')
    .update({
      name: data.name,
      sku: data.sku ?? null,
      category: data.category,
      unidade_medida: data.unidade_medida,
      estoque_minimo: data.estoque_minimo,
      estoque_maximo: data.estoque_maximo ?? null,
      preferred_supplier_id: data.preferred_supplier_id ?? null,
      numero_anvisa: data.numero_anvisa_produto ?? null,
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/estoque/produtos')

  return { success: true }
}

// ─── listProducts ─────────────────────────────────────────────────────────────
// Saldo por unidade = SUM(product_batches.saldo_disponivel) filtrado por product_id + unit_id.
// Sem opts.unitId, saldo não pode ser calculado por unidade (D-23) — retorna 0/status 'normal'.

export async function listProducts(opts?: {
  unitId?: string
  categoria?: string
  status?: string
  q?: string
}): Promise<{ success: boolean; error?: string; data?: ProductWithSaldo[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (opts?.categoria) {
    query = query.eq('category', opts.categoria)
  }
  if (opts?.q) {
    const term = opts.q.replace(/[%,]/g, '')
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  }

  const { data: products, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = products ?? []

  // Saldo por unidade (D-23) — apenas se unitId fornecido
  const saldoByProduct = new Map<string, number>()
  if (opts?.unitId && rows.length > 0) {
    const productIds = rows.map((p) => p.id)
    const { data: batches, error: batchesError } = await supabase
      .from('product_batches')
      .select('product_id, saldo_disponivel')
      .in('product_id', productIds)
      .eq('unit_id', opts.unitId)
      .is('deleted_at', null)

    if (batchesError) {
      return { success: false, error: batchesError.message }
    }

    for (const b of batches ?? []) {
      saldoByProduct.set(b.product_id, (saldoByProduct.get(b.product_id) ?? 0) + b.saldo_disponivel)
    }
  }

  let result: ProductWithSaldo[] = rows.map((p) => {
    const saldo = opts?.unitId ? (saldoByProduct.get(p.id) ?? 0) : 0
    const status = deriveProductStatus(saldo, p.estoque_minimo)
    return { ...p, saldo, status }
  })

  if (opts?.status) {
    result = result.filter((p) => p.status === opts.status)
  }

  // Ordenar por criticidade, depois nome
  result.sort((a, b) => {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })

  return { success: true, data: result }
}

// ─── deactivateProduct ─────────────────────────────────────────────────────────
// Soft delete (LGPD D-133 pattern) — ativo=false + deleted_at=now()

export async function deactivateProduct(id: string): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update({ ativo: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/estoque/produtos')

  return { success: true }
}
