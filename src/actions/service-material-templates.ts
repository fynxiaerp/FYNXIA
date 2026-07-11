'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { serviceMaterialTemplateSchema, type ServiceMaterialTemplateInput } from '@/lib/validators/product'

/**
 * Server Actions: templates de consumo por serviço — Phase 17 Plan 05 (D-07)
 *
 * CRUD da aba "Materiais utilizados" do ServiceForm (/config/servicos). Admin
 * associa produto + qtd padrão ao serviço uma única vez; a qtd é reajustável
 * pelo dentista no momento do atendimento (D-22 — fora do escopo deste plano).
 *
 * Requirements: EST-02
 */

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
// restricted to admin/superadmin only, mirrors service_material_templates_admin_write RLS.

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateRow = {
  id: string
  product_id: string
  product_name: string
  unidade_medida: string
  qtd_padrao: number
}

// ─── listServiceMaterials ─────────────────────────────────────────────────────
// D-07: lista os materiais configurados para um serviço (aba "Materiais utilizados").

export async function listServiceMaterials(
  serviceId: string
): Promise<{ success: boolean; error?: string; data?: TemplateRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_material_templates')
    .select('id, product_id, qtd_padrao, products(name, unidade_medida)')
    .eq('service_id', serviceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  const result: TemplateRow[] = (data ?? []).map(
    (row: {
      id: string
      product_id: string
      qtd_padrao: number
      products: { name: string; unidade_medida: string } | { name: string; unidade_medida: string }[] | null
    }) => {
      const product = row.products ? (Array.isArray(row.products) ? row.products[0] : row.products) : null
      return {
        id: row.id,
        product_id: row.product_id,
        product_name: product?.name ?? '',
        unidade_medida: product?.unidade_medida ?? '',
        qtd_padrao: row.qtd_padrao,
      }
    }
  )

  return { success: true, data: result }
}

// ─── addServiceMaterial ───────────────────────────────────────────────────────
// D-07: admin associa produto + qtd padrão ao serviço via ServiceForm.
// UNIQUE(service_id, product_id) já no schema — em conflito retorna erro amigável.

export async function addServiceMaterial(
  input: ServiceMaterialTemplateInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const safeParsed = serviceMaterialTemplateSchema.safeParse(input)
  if (!safeParsed.success) {
    const firstError = safeParsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const parsed = safeParsed.data

  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('service_material_templates')
    .insert({
      clinic_id: actor.tenant_id,
      service_id: parsed.service_id,
      product_id: parsed.product_id,
      qtd_padrao: parsed.qtd_padrao,
    })
    .select('id')
    .single()

  if (error || !row) {
    if (error?.code === '23505') {
      return { success: false, error: 'Material já configurado para este serviço' }
    }
    return { success: false, error: error?.message ?? 'Erro ao adicionar material' }
  }

  revalidatePath('/config/servicos')

  return { success: true, id: row.id }
}

// ─── removeServiceMaterial ─────────────────────────────────────────────────────
// Soft delete — preserva histórico (deleted_at), mirrors deactivateProduct pattern.

export async function removeServiceMaterial(id: string): Promise<{ success: boolean; error?: string }> {
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
    .from('service_material_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/config/servicos')

  return { success: true }
}
