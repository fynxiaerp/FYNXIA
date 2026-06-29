'use server'
import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Helper: get authenticated actor ────────────────────────────────────────
// Verbatim copy from src/actions/receivables.ts (getActor pattern)

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
// D-23: writers for Contas a Pagar = admin + superadmin only

const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── supplierSchema ──────────────────────────────────────────────────────────
// Inline Zod v3 schema — no .default() (D-133)

const supplierSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),

  tipo: z.enum(['laboratorio', 'material', 'servico', 'autonomo', 'pj', 'outro'], {
    errorMap: () => ({ message: 'Tipo de fornecedor inválido' }),
  }),

  cnpjCpf: z.string().max(20).optional().nullable(),

  pixKey: z.string().max(100).optional().nullable(),

  banco: z.string().max(100).optional().nullable(),

  agencia: z.string().max(20).optional().nullable(),

  conta: z.string().max(30).optional().nullable(),

  vinculo: z
    .enum(['clt', 'pj', 'autonomo'], {
      errorMap: () => ({ message: 'Vínculo inválido' }),
    })
    .optional()
    .nullable(),

  professionalId: z.string().uuid('ID do profissional inválido').optional().nullable(),

  labId: z.string().uuid('ID do laboratório inválido').optional().nullable(),

  ativo: z.boolean().optional().nullable(),
})

export type SupplierInput = z.infer<typeof supplierSchema>

// ─── listSuppliers ───────────────────────────────────────────────────────────
// Returns active (non-deleted) suppliers scoped to the authenticated tenant via RLS.

export async function listSuppliers(
  filters?: { tipo?: string | null; ativo?: boolean | null }
): Promise<{
  success: boolean
  suppliers?: {
    id: string
    name: string
    tipo: string
    cnpj_cpf: string | null
    vinculo: string | null
    professional_id: string | null
    lab_id: string | null
    ativo: boolean | null
  }[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('suppliers')
    .select('id, name, tipo, cnpj_cpf, vinculo, professional_id, lab_id, ativo')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo)
  }
  if (filters?.ativo !== undefined && filters.ativo !== null) {
    query = query.eq('ativo', filters.ativo)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, suppliers: data ?? [] }
}

// ─── createSupplier ──────────────────────────────────────────────────────────
// D-01: insert into public.suppliers; clinic_id always from actor.tenant_id (T-16-21)

export async function createSupplier(input: SupplierInput): Promise<{
  success: boolean
  supplierId?: string
  error?: string
}> {
  // 1. Auth
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  // 2. Role gate (T-16-22)
  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  // 3. Validate
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  // 4. Insert — clinic_id from actor.tenant_id (never from input)
  const { data: row, error: insertError } = await supabase
    .from('suppliers')
    .insert({
      clinic_id: actor.tenant_id,
      name: data.name,
      tipo: data.tipo,
      cnpj_cpf: data.cnpjCpf ?? null,
      pix_key: data.pixKey ?? null,
      banco: data.banco ?? null,
      agencia: data.agencia ?? null,
      conta: data.conta ?? null,
      vinculo: data.vinculo ?? null,
      professional_id: data.professionalId ?? null,
      lab_id: data.labId ?? null,
      ativo: data.ativo ?? true,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar fornecedor' }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')
  revalidatePath('/clinica/financeiro/fornecedores')

  return { success: true, supplierId: row.id }
}

// ─── updateSupplier ──────────────────────────────────────────────────────────

export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para esta operação' }
  }

  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  const { error } = await supabase
    .from('suppliers')
    .update({
      name: data.name,
      tipo: data.tipo,
      cnpj_cpf: data.cnpjCpf ?? null,
      pix_key: data.pixKey ?? null,
      banco: data.banco ?? null,
      agencia: data.agencia ?? null,
      conta: data.conta ?? null,
      vinculo: data.vinculo ?? null,
      ativo: data.ativo ?? true,
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')
  revalidatePath('/clinica/financeiro/fornecedores')

  return { success: true }
}

// ─── deactivateSupplier ──────────────────────────────────────────────────────
// Soft deactivation — keeps row for fiscal trail

export async function deactivateSupplier(
  id: string
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

  const { error } = await supabase
    .from('suppliers')
    .update({ ativo: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')
  revalidatePath('/clinica/financeiro/fornecedores')

  return { success: true }
}

// ─── linkProfessionalSupplier ────────────────────────────────────────────────
// D-01: bidirectional link — updates suppliers.professional_id AND professionals.supplier_id

export async function linkProfessionalSupplier(
  professionalId: string,
  supplierId: string
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

  // Update suppliers.professional_id (tenant-scoped via RLS)
  const { error: supplierError } = await supabase
    .from('suppliers')
    .update({ professional_id: professionalId })
    .eq('id', supplierId)

  if (supplierError) {
    return { success: false, error: supplierError.message }
  }

  // Update professionals.supplier_id (bidirectional D-01)
  const { error: professionalError } = await supabase
    .from('professionals')
    .update({ supplier_id: supplierId })
    .eq('id', professionalId)

  if (professionalError) {
    return { success: false, error: professionalError.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')

  return { success: true }
}

// ─── linkLabSupplier ─────────────────────────────────────────────────────────
// D-01: link lab to supplier — updates suppliers.lab_id

export async function linkLabSupplier(
  labId: string,
  supplierId: string
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

  const { error } = await supabase
    .from('suppliers')
    .update({ lab_id: labId })
    .eq('id', supplierId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/clinica/financeiro/contas-a-pagar')

  return { success: true }
}
