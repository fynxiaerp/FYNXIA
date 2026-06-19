'use server'
/**
 * Server Actions: Laboratório de Prótese (LAB-01, LAB-02)
 *
 * createLab / updateLab:     Admin/dentist-gated CRUD for prosthetic_labs supplier records.
 * createLabOrder:            Creates an OS protética (lab_orders); if cost is postable and
 *                            actor is COST_ROLES, also posts the despesa (same path as
 *                            setLabOrderCost).
 * setLabOrderCost (LAB-02):  Admin/superadmin-gated. Inserts a 'despesa' row into
 *                            financial_transactions (tenant_id-scoped, type='despesa') and
 *                            backfills lab_orders.financial_transaction_id.
 *                            Double-post guard: refuses if financial_transaction_id already set.
 * updateLabOrderStatus:      Moves OS through enviado→prova→concluido.
 * listLabOrders / listLabs:  Tenant-scoped reads.
 *
 * Guards on every mutation:
 *   1. assertNotReadOnly() — blocks read-only roles at action boundary (T-13-14)
 *   2. Role gate: ORDER_ROLES (admin/superadmin/dentist) or COST_ROLES (admin/superadmin)
 *   3. Tenant scope: clinic_id = actor.tenant_id on lab_orders/prosthetic_labs;
 *                   tenant_id = actor.tenant_id on financial_transactions (T-13-17)
 *   4. logBusinessEvent (IDs only — LGPD) (T-13-18)
 *
 * CRITICAL — financial_transactions uses tenant_id, NOT clinic_id (per migration
 * 20260606000100_financial_tables.sql). lab_orders + prosthetic_labs use clinic_id.
 *
 * COST_ROLES = ['admin','superadmin'] matches the financial_transactions write RLS
 * (admin-only write policy). Dentists can create/update orders but not post financials.
 *
 * Turbopack 'use server' constraint: every export at module level must be async.
 * No re-exports, no non-async exports.
 *
 * Pre-push type cast: Phase 13 tables not yet in database.types.ts (Plan 05 pushes).
 * Uses `supabase as unknown as SupabaseClient<any>` to keep tsc --noEmit clean.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 04
 * Requirements: LAB-01, LAB-02
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { assertNotReadOnly } from '@/lib/auth/guards'
import { logBusinessEvent } from '@/lib/audit'
import { isCostPostable, buildLabExpenseDescription } from '@/lib/protese/lab-cost'
import {
  labSchema,
  labOrderSchema,
  type LabInput,
  type LabOrderInput,
} from '@/lib/validators/lab-order'

// ─── Roles ────────────────────────────────────────────────────────────────────

/** Lab order CRUD: admin, superadmin, dentist */
const ORDER_ROLES = ['admin', 'superadmin', 'dentist']

/** Financial posting: admin + superadmin only — matches financial_transactions write RLS */
const COST_ROLES = ['admin', 'superadmin']

// ─── Actor helper (mirrors resources.ts exactly) ──────────────────────────────

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

// ─── Internal: post lab expense to financial_transactions ─────────────────────
/**
 * Shared by createLabOrder (when cost is postable at creation) and setLabOrderCost.
 * Inserts a 'despesa' row in financial_transactions (tenant_id-scoped, T-13-17) and
 * backfills lab_orders.financial_transaction_id (LAB-02).
 *
 * Returns the financial_transaction id on success.
 */
async function postLabExpense(
  db: SupabaseClient<any>,
  actor: Actor,
  orderId: string,
  cost: number,
  labName: string,
  prosthesisType: string,
  orderNumber: string
): Promise<{ financialTransactionId: string } | { error: string }> {
  // Optionally resolve a lab/prótese despesa category for the tenant
  // (D-04: reuse existing or leave null — never create categories here)
  const { data: categoryRow } = await db
    .from('financial_categories')
    .select('id')
    .eq('tenant_id', actor.tenant_id)
    .eq('type', 'despesa')
    .ilike('name', '%laborat%')
    .limit(1)
    .maybeSingle()

  const categoryId: string | null = categoryRow?.id ?? null

  // Insert despesa into financial_transactions (tenant_id — NOT clinic_id, per schema)
  const description = buildLabExpenseDescription({ labName, prosthesisType, orderNumber })
  const transactionDate = new Date().toISOString().slice(0, 10)

  const { data: txn, error: txnError } = await db
    .from('financial_transactions')
    .insert({
      tenant_id: actor.tenant_id,
      category_id: categoryId,
      type: 'despesa',
      amount: cost,
      description,
      transaction_date: transactionDate,
      posted_by: actor.id,
    })
    .select('id')
    .single()

  if (txnError || !txn) {
    return { error: txnError?.message ?? 'Erro ao lançar despesa no financeiro' }
  }

  // Backfill lab_orders.financial_transaction_id (LAB-02)
  const { error: updateError } = await db
    .from('lab_orders')
    .update({
      cost,
      financial_transaction_id: txn.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'lab.order.cost.posted',
    details: {
      lab_order_id: orderId,
      financial_transaction_id: txn.id,
      amount: cost,
    },
  })

  return { financialTransactionId: txn.id }
}

// ─── createLab ────────────────────────────────────────────────────────────────
/**
 * LAB-01: Registers a new prosthetic lab supplier.
 * T-13-17: clinic_id = actor.tenant_id on insert.
 */
export async function createLab(
  input: LabInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await assertNotReadOnly()

  const parsed = labSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!ORDER_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para cadastrar laboratório' }
  }

  const { nome, cnpj, contato_nome, telefone, email, notes } = parsed.data

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data: lab, error: insertError } = await db
    .from('prosthetic_labs')
    .insert({
      clinic_id: actor.tenant_id,
      nome,
      cnpj: cnpj ?? null,
      contato_nome: contato_nome ?? null,
      telefone: telefone ?? null,
      email: email ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (insertError || !lab) {
    return { success: false, error: insertError?.message ?? 'Erro ao cadastrar laboratório' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'lab.created',
    details: { lab_id: lab.id },
  })

  return { success: true, id: lab.id }
}

// ─── updateLab ────────────────────────────────────────────────────────────────
/**
 * LAB-01: Updates an existing prosthetic lab supplier record.
 * T-13-17: .eq('clinic_id', actor.tenant_id) on update.
 */
export async function updateLab(
  id: string,
  input: LabInput
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const parsed = labSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!ORDER_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para editar laboratório' }
  }

  const { nome, cnpj, contato_nome, telefone, email, notes } = parsed.data

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { error: updateError } = await db
    .from('prosthetic_labs')
    .update({
      nome,
      cnpj: cnpj ?? null,
      contato_nome: contato_nome ?? null,
      telefone: telefone ?? null,
      email: email ?? null,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'lab.updated',
    details: { lab_id: id },
  })

  return { success: true }
}

// ─── createLabOrder ───────────────────────────────────────────────────────────
/**
 * LAB-01: Creates a new OS protética (lab order).
 * If cost is postable at creation and actor has COST_ROLES, also posts the
 * financial despesa (LAB-02) immediately — same logic path as setLabOrderCost.
 *
 * T-13-17: clinic_id = actor.tenant_id on insert.
 */
export async function createLabOrder(
  input: LabOrderInput
): Promise<{ success: boolean; id?: string; financialTransactionId?: string; error?: string }> {
  await assertNotReadOnly()

  const parsed = labOrderSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!ORDER_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para criar ordem de serviço' }
  }

  const {
    lab_id,
    patient_id,
    appointment_id,
    unit_id,
    prosthesis_type,
    order_number,
    due_date,
    status,
    stages,
    cost,
    notes,
  } = parsed.data

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data: order, error: insertError } = await db
    .from('lab_orders')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unit_id ?? null,
      lab_id,
      patient_id,
      appointment_id: appointment_id ?? null,
      order_number: order_number ?? null,
      prosthesis_type,
      due_date: due_date ?? null,
      stages: stages ?? [],
      status,
      cost: cost ?? null,
      notes: notes ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (insertError || !order) {
    return { success: false, error: insertError?.message ?? 'Erro ao criar ordem de serviço' }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'lab.order.created',
    details: { lab_order_id: order.id, lab_id, patient_id },
  })

  // If cost is postable at creation and actor has financial posting rights, post despesa
  let financialTransactionId: string | undefined
  if (isCostPostable(cost ?? null) && COST_ROLES.includes(actor.role)) {
    // Fetch lab name for the expense description
    const { data: labRow } = await db
      .from('prosthetic_labs')
      .select('nome')
      .eq('id', lab_id)
      .eq('clinic_id', actor.tenant_id)
      .single()

    const labName = labRow?.nome ?? 'Laboratório'

    const postResult = await postLabExpense(
      db,
      actor,
      order.id,
      cost!,
      labName,
      prosthesis_type,
      order_number ?? order.id
    )

    if ('error' in postResult) {
      // OS was created; cost posting failed — return success with warning
      return { success: true, id: order.id, error: postResult.error }
    }

    financialTransactionId = postResult.financialTransactionId
  }

  return { success: true, id: order.id, financialTransactionId }
}

// ─── setLabOrderCost ──────────────────────────────────────────────────────────
/**
 * LAB-02: Posts a despesa to financial_transactions for the given lab order cost.
 *
 * Role-gated to COST_ROLES (admin/superadmin) — matches financial_transactions write RLS.
 * isCostPostable guard: refuses zero/null/negative costs.
 * Double-post guard (T-13-15): re-fetches the order; if financial_transaction_id already
 * set, returns 'já lançado' error without creating a duplicate despesa.
 *
 * Inserts financial_transactions with tenant_id (NOT clinic_id — per financial schema).
 * Backfills lab_orders.financial_transaction_id.
 *
 * T-13-17: tenant_id = actor.tenant_id on financial_transactions insert.
 */
export async function setLabOrderCost(
  orderId: string,
  cost: number
): Promise<{ success: boolean; financialTransactionId?: string; error?: string }> {
  await assertNotReadOnly()

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!COST_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para lançar custo no financeiro' }
  }

  if (!isCostPostable(cost)) {
    return { success: false, error: 'Custo deve ser maior que zero' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  // Double-post guard (T-13-15): re-fetch the order to check idempotency
  const { data: order, error: fetchError } = await db
    .from('lab_orders')
    .select('id, lab_id, prosthesis_type, order_number, financial_transaction_id')
    .eq('id', orderId)
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !order) {
    return { success: false, error: 'Ordem de serviço não encontrada' }
  }

  // Idempotency: refuse if already posted (T-13-15 — no double despesa)
  if (order.financial_transaction_id) {
    return {
      success: false,
      error: 'Custo já lançado no financeiro para esta OS',
    }
  }

  // Fetch lab name for the expense description
  const { data: labRow } = await db
    .from('prosthetic_labs')
    .select('nome')
    .eq('id', order.lab_id)
    .eq('clinic_id', actor.tenant_id)
    .single()

  const labName = labRow?.nome ?? 'Laboratório'

  const postResult = await postLabExpense(
    db,
    actor,
    orderId,
    cost,
    labName,
    order.prosthesis_type,
    order.order_number ?? orderId
  )

  if ('error' in postResult) {
    return { success: false, error: postResult.error }
  }

  return { success: true, financialTransactionId: postResult.financialTransactionId }
}

// ─── updateLabOrderStatus ─────────────────────────────────────────────────────
/**
 * LAB-01: Moves an OS through enviado → prova → concluido.
 * T-13-17: .eq('clinic_id', actor.tenant_id) on update.
 */
export async function updateLabOrderStatus(
  orderId: string,
  status: 'enviado' | 'prova' | 'concluido'
): Promise<{ success: boolean; error?: string }> {
  await assertNotReadOnly()

  const validStatuses = ['enviado', 'prova', 'concluido']
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Status inválido para ordem de serviço' }
  }

  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  if (!ORDER_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para atualizar status da OS' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { error: updateError } = await db
    .from('lab_orders')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('clinic_id', actor.tenant_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'lab.order.status.updated',
    details: { lab_order_id: orderId, status },
  })

  return { success: true }
}

// ─── listLabOrders ────────────────────────────────────────────────────────────
/**
 * Lists all non-deleted lab orders for the actor's clinic.
 * Read-only: no assertNotReadOnly().
 */
export async function listLabOrders(): Promise<{
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data, error } = await db
    .from('lab_orders')
    .select(
      'id, lab_id, patient_id, appointment_id, unit_id, order_number, prosthesis_type, due_date, stages, status, cost, financial_transaction_id, notes, created_at, created_by'
    )
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: 'Erro ao listar ordens de serviço' }
  }

  return { success: true, data: (data ?? []) as Record<string, unknown>[] }
}

// ─── listLabs ─────────────────────────────────────────────────────────────────
/**
 * Lists all non-deleted prosthetic labs for the actor's clinic.
 * Read-only: no assertNotReadOnly().
 */
export async function listLabs(): Promise<{
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}> {
  const result = await getActor()
  if ('error' in result) return { success: false, error: result.error }
  const { actor } = result

  const supabase = await createClient()
  const db = supabase as unknown as SupabaseClient<any>

  const { data, error } = await db
    .from('prosthetic_labs')
    .select('id, nome, cnpj, contato_nome, telefone, email, notes, created_at')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('nome', { ascending: true })

  if (error) {
    return { success: false, error: 'Erro ao listar laboratórios' }
  }

  return { success: true, data: (data ?? []) as Record<string, unknown>[] }
}
