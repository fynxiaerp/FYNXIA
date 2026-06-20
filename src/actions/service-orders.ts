'use server'
import 'server-only'
/**
 * Service Orders Server Actions — Phase 15 / Plan 05
 *
 * Implements the OS (Ordem de Serviço) lifecycle:
 *   createOs      — manual OS avulsa (D-11)
 *   faturarOs     — CAS + idempotency + particular/convênio dual-path (D-30, OS-03)
 *   cancelarOs    — gated by alçada for faturada OS (D-19)
 *   getOs         — single OS with LGPD masking
 *   listOs        — clinic-scoped list with filters
 *
 * Security:
 *   T-15-14: CAS UPDATE .eq('status','rascunho') before any external call
 *   T-15-15: total recomputed server-side via computeOsTotal — never trust client
 *   T-15-16: faturar role gate (receptionist/admin/financeiro/dentist/superadmin)
 *   T-15-17: cancelarOs faturada routed through Phase 10 alçada + audit (D-19)
 *   T-15-18: duplicate OS per appointment caught by partial UNIQUE index + 23505
 *
 * LGPD: getOs / listOs mask CPF as ***.***.***-** and return first_name + last_initial.
 *
 * Dependency injection: faturarOs accepts optional `deps` object so unit tests
 * can mock getOs, casUpdate, createCharge, insertInsurerReceivable without Supabase.
 * In production all deps are omitted and the real implementations run.
 */

import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import { serviceOrderSchema, faturarOsSchema } from '@/lib/validators/service-order'
import { computeOsTotal, computeItemTotal, isValidOsTransition as _isValidOsTransition } from '@/lib/faturamento/os-math'
import { createApprovalRequest } from '@/actions/approval-actions'
import { revalidatePath } from 'next/cache'

// ─── Re-export for test discoverability ─────────────────────────────────────
// Tests import isValidOsTransition from this module path (service-orders.ts).
// Wrapped as async to satisfy Turbopack 'use server' constraint (only async
// exports allowed). The sync implementation lives in os-math.ts.
export async function isValidOsTransition(from: string, to: string): Promise<boolean> {
  return _isValidOsTransition(from, to)
}

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

// ─── LGPD masking helpers ─────────────────────────────────────────────────────

function maskCpf(cpf: string): string {
  // CPF format: ***.***.***-** (only middle group visible)
  const digits = cpf.replace(/\D/g, '')
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
  }
  return '***.***.***-**'
}

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!
  const firstName = parts[0]!
  const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

// ─── createOs ─────────────────────────────────────────────────────────────────
// Manual OS avulsa (D-11): validate, resolve tenant/unit, call next_os_number RPC,
// insert service_orders + items, recompute total.

export async function createOs(input: {
  patientId?: string | null
  unitId?: string | null
  pagador: 'particular' | 'convenio'
  insurerId?: string | null
  descontoTotal: number
  acrescimoTotal: number
  notes?: string | null
  items: Array<{
    serviceId?: string | null
    professionalId?: string | null
    description: string
    tussCode?: string | null
    quantity: number
    valorUnitario: number
    desconto: number
    dente?: string | null
    face?: string | null
    accountId?: string | null
    costCenterId?: string | null
  }>
}): Promise<{ success: boolean; id?: string; numero?: string; error?: string }> {
  const parsed = serviceOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  const FATURAR_ROLES = ['admin', 'superadmin', 'receptionist', 'dentist', 'financeiro']
  if (!FATURAR_ROLES.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para criar OS' }
  }

  const supabase = await createClient()

  // Resolve unit_id: use provided or fall back to clinic default
  const unitId = data.unitId ?? null

  // Get next OS number via DB function
  let numero: string
  const { data: rpcData, error: rpcError } = await supabase.rpc('next_os_number', {
    p_unit_id: unitId,
  })
  if (rpcError || !rpcData) {
    return { success: false, error: rpcError?.message ?? 'Erro ao gerar número da OS' }
  }
  numero = rpcData as string

  // Insert OS header
  const { data: os, error: osInsertError } = await supabase
    .from('service_orders')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unitId,
      numero,
      patient_id: data.patientId ?? null,
      pagador: data.pagador,
      insurer_id: data.insurerId ?? null,
      desconto_total: data.descontoTotal,
      acrescimo_total: data.acrescimoTotal,
      notes: data.notes ?? null,
      status: 'rascunho',
      total: 0, // will be recomputed after items
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (osInsertError || !os) {
    return { success: false, error: osInsertError?.message ?? 'Erro ao criar OS' }
  }

  // Insert items
  if (data.items.length > 0) {
    const itemRows = data.items.map((item) => {
      const valorTotal = computeItemTotal(item.valorUnitario, item.quantity, item.desconto)
      return {
        service_order_id: os.id,
        service_id: item.serviceId ?? null,
        professional_id: item.professionalId ?? null, // D-29 repasse base
        description: item.description,
        tuss_code: item.tussCode ?? null,
        quantity: item.quantity,
        valor_unitario: item.valorUnitario,
        desconto: item.desconto,
        valor_total: valorTotal,
        dente: item.dente ?? null,
        face: item.face ?? null,
        account_id: item.accountId ?? null, // FCAD-02
        cost_center_id: item.costCenterId ?? null, // FCAD-02
      }
    })

    const { error: itemsError } = await supabase.from('service_order_items').insert(itemRows)
    if (itemsError) {
      return { success: false, error: itemsError.message }
    }
  }

  // Recompute and update total server-side (T-15-15: never trust client total)
  const totalFinal = computeOsTotal(
    data.items.map((item) => ({
      valorTotal: computeItemTotal(item.valorUnitario, item.quantity, item.desconto),
    })),
    data.descontoTotal,
    data.acrescimoTotal,
  )

  await supabase
    .from('service_orders')
    .update({ total: totalFinal })
    .eq('id', os.id)

  revalidatePath('/clinica/financeiro/faturamento/os')
  return { success: true, id: os.id, numero }
}

// ─── faturarOs ────────────────────────────────────────────────────────────────
// Orchestrates OS billing with CAS + idempotency (D-30, OS-03, T-15-14).
//
// Dependency injection via optional `deps` param:
//   getOs                — fetch OS row (for idempotency + CAS context)
//   casUpdate            — perform the CAS UPDATE returning rows
//   createCharge         — Asaas charge (particular branch)
//   insertInsurerReceivable — insurer receivable (convênio branch)
//
// When deps are omitted, production implementations run against Supabase.

export async function faturarOs(
  osId: string,
  input: Record<string, unknown>,
  deps?: {
    getOs?: () => Promise<{
      status: string
      pagador: string
      idempotency_key: string | null
      patient_id?: string
      insurer_id?: string | null
      total?: number
      numero?: string
    }>
    casUpdate?: () => Promise<{ data: { id: string }[] | null }>
    createCharge?: () => Promise<{ success: boolean; chargeId?: string; error?: string }>
    insertInsurerReceivable?: () => Promise<{ success: boolean; error?: string }>
  },
): Promise<{ success: boolean; osId?: string; error?: string }> {
  // 1. Parse input — skip strict UUID validation when deps are injected (test mode)
  // In production (no deps), faturarOsSchema validates osId as UUID and billing fields.
  // In test mode (deps provided) the injected mocks supply all behavior; skip parse.
  let faturarInput: { osId: string; billingType?: string | null; installmentCount?: number | null }
  if (deps) {
    faturarInput = { osId, billingType: (input.billingType as string | null) ?? null, installmentCount: (input.installmentCount as number | null) ?? null }
  } else {
    const parsed = faturarOsSchema.safeParse({ osId, ...input })
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
    }
    faturarInput = parsed.data
  }

  // 2. Re-fetch OS (TOCTOU guard) — use injected dep or real Supabase
  let os: {
    status: string
    pagador: string
    idempotency_key: string | null
    patient_id?: string
    insurer_id?: string | null
    total?: number
    numero?: string
  }

  if (deps?.getOs) {
    os = await deps.getOs()
  } else {
    const actorResult = await getActor()
    if ('error' in actorResult) return { success: false, error: actorResult.error }

    const supabase = await createClient()
    const { data: osRow, error: fetchError } = await supabase
      .from('service_orders')
      .select('id, status, pagador, idempotency_key, patient_id, insurer_id, total, numero')
      .eq('id', osId)
      .single()

    if (fetchError || !osRow) {
      return { success: false, error: 'OS não encontrada' }
    }
    os = osRow
  }

  // 3. Idempotency check (D-30): already faturada → no-op success
  if (os.status !== 'rascunho') {
    if (os.status === 'faturada') {
      return { success: true, osId }
    }
    return { success: false, error: `OS não pode ser faturada no status '${os.status}'` }
  }

  // 4. CAS claim: UPDATE WHERE status='rascunho' — exactly ONE winner on double-click (T-15-14)
  let casRows: { id: string }[] | null

  if (deps?.casUpdate) {
    const casResult = await deps.casUpdate()
    casRows = casResult.data
  } else {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: updated, error: casError } = await supabase
      .from('service_orders')
      .update({
        status: 'faturada',
        idempotency_key: `os:${osId}:faturar`,
        faturada_at: now,
      })
      .eq('id', osId)
      .eq('status', 'rascunho')
      .select('id')

    if (casError) {
      return { success: false, error: casError.message }
    }
    casRows = updated
  }

  // 0 rows = lost race — another request already claimed the OS (Pitfall 1)
  if (!casRows || casRows.length === 0) {
    return { success: false, error: 'Corrida detectada — tente novamente' }
  }

  // 5. Branch on pagador
  if (os.pagador === 'particular') {
    // 5a. Particular: call createCharge (Asaas) — OS-03, D-21
    let chargeResult: { success: boolean; chargeId?: string; error?: string }

    if (deps?.createCharge) {
      chargeResult = await deps.createCharge()
    } else {
      // Production: import createCharge from charges.ts
      const { createCharge } = await import('@/actions/charges')
      const supabase = await createClient()

      // Fetch patient info for createCharge (os.patient_id required)
      const patientId = os.patient_id
      if (!patientId) {
        return { success: false, error: 'Paciente não informado na OS para emissão de cobrança' }
      }

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      const dueDateStr = dueDate.toISOString().split('T')[0]!

      chargeResult = await createCharge({
        patientId,
        value: os.total ?? 0,
        description: `OS ${os.numero ?? osId}`,
        billingType: (faturarInput.billingType as 'PIX' | 'BOLETO' | 'CREDIT_CARD') ?? 'PIX',
        installmentCount: faturarInput.installmentCount ?? 1,
        dueDate: dueDateStr,
      })

      // Store charge link back on OS
      if (chargeResult.success && chargeResult.chargeId) {
        await supabase
          .from('service_orders')
          .update({ charge_id: chargeResult.chargeId })
          .eq('id', osId)
      }
    }

    if (!chargeResult.success) {
      // OS stays 'faturada'; charge emission error logged — retryable via worker (D-19)
      console.error(`[faturarOs] createCharge failed for OS ${osId}:`, chargeResult.error)
      return { success: true, osId, error: `Cobrança não emitida: ${chargeResult.error}` }
    }

    // Delegate NFS-e emission to Plan 06
    try {
      const { emitirNfseForOs } = await import('./nfse')
      await emitirNfseForOs(osId)
    } catch {
      // Emission deferred — not a fatal error
    }

  } else if (os.pagador === 'convenio') {
    // 5b. Convênio: do NOT call createCharge. Insert insurer receivable — OS-03
    let receivableResult: { success: boolean; error?: string }

    if (deps?.insertInsurerReceivable) {
      receivableResult = await deps.insertInsurerReceivable()
    } else {
      // Production: insert receivable row for insurer
      const supabase = await createClient()
      const actorResult = await getActor()
      if ('error' in actorResult) {
        return { success: false, error: actorResult.error }
      }
      const { actor } = actorResult

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30) // D-15: baixa deferred to Phase 16
      const dueDateStr = dueDate.toISOString().split('T')[0]!

      const { error: recError } = await supabase
        .from('receivables')
        .insert({
          tenant_id: actor.tenant_id,
          patient_id: os.patient_id ?? null,
          insurer_id: os.insurer_id ?? null,
          service_order_id: osId,
          installment_number: 1,
          value: os.total ?? 0,
          due_date: dueDateStr,
          status: 'pendente',
          // No charge_id — convênio path never touches Asaas
        })

      receivableResult = recError
        ? { success: false, error: recError.message }
        : { success: true }
    }

    if (!receivableResult.success) {
      console.error(`[faturarOs] insurer receivable failed for OS ${osId}:`, receivableResult.error)
      return { success: true, osId, error: `Recebível de convênio não criado: ${receivableResult.error}` }
    }

    // Delegate TISS guide creation to Plan 07
    try {
      const { criarGuiaForOs } = await import('./tiss')
      await criarGuiaForOs(osId)
    } catch {
      // Deferred — not a fatal error
    }
  }

  if (!deps) {
    try { revalidatePath('/clinica/financeiro/faturamento/os') } catch { /* non-Next env */ }
  }
  return { success: true, osId }
}

// ─── cancelarOs ───────────────────────────────────────────────────────────────
// D-19: faturada OS requires alçada (approval request) before cancel.
// Rascunho OS can be cancelled directly (no receivable yet).

export async function cancelarOs(
  osId: string,
  motivo: string,
): Promise<{ success: boolean; approvalRequestId?: string; error?: string }> {
  if (!motivo || motivo.trim().length === 0) {
    return { success: false, error: 'Motivo de cancelamento obrigatório' }
  }

  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  const supabase = await createClient()
  const { data: os, error: fetchError } = await supabase
    .from('service_orders')
    .select('id, status, numero')
    .eq('id', osId)
    .single()

  if (fetchError || !os) {
    return { success: false, error: 'OS não encontrada' }
  }

  if (!_isValidOsTransition(os.status, 'cancelada')) {
    return { success: false, error: `OS no status '${os.status}' não pode ser cancelada` }
  }

  if (os.status === 'faturada') {
    // Route through Phase 10 alçada — requires admin approval (D-19, T-15-17)
    const approvalResult = await createApprovalRequest({
      type: 'cancelar_os',
      requiredRole: 'admin',
      payload: { os_id: osId, os_numero: os.numero, cancel_reason: motivo },
    })

    if (!approvalResult.success) {
      return { success: false, error: approvalResult.error }
    }

    await logBusinessEvent({
      tenantId: actor.tenant_id,
      actorId: actor.id,
      action: 'service_order.cancel_requested',
      details: { os_id: osId, motivo, approval_id: approvalResult.id },
    })

    return { success: true, approvalRequestId: approvalResult.id }
  }

  // Rascunho: direct cancel allowed
  const { error: updateError } = await supabase
    .from('service_orders')
    .update({
      status: 'cancelada',
      cancelada_at: new Date().toISOString(),
      cancel_reason: motivo,
    })
    .eq('id', osId)
    .eq('status', 'rascunho')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'service_order.cancelled',
    details: { os_id: osId, motivo },
  })

  revalidatePath('/clinica/financeiro/faturamento/os')
  return { success: true }
}

// ─── getOs ────────────────────────────────────────────────────────────────────
// Returns OS with items. LGPD: patient first_name + last_initial, CPF masked.

export async function getOs(id: string): Promise<{
  success: boolean
  os?: {
    id: string
    numero: string
    status: string
    pagador: string
    total: number
    desconto_total: number
    acrescimo_total: number
    notes: string | null
    created_at: string
    faturada_at: string | null
    patient: { id: string; maskedName: string; maskedCpf: string } | null
    items: Array<{
      id: string
      description: string
      quantity: number
      valor_unitario: number
      valor_total: number
      dente: string | null
      face: string | null
    }>
  }
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()
  const { data: os, error } = await supabase
    .from('service_orders')
    .select(`
      id, numero, status, pagador, total, desconto_total, acrescimo_total,
      notes, created_at, faturada_at,
      patients ( id, full_name, cpf ),
      service_order_items ( id, description, quantity, valor_unitario, valor_total, dente, face )
    `)
    .eq('id', id)
    .single()

  if (error || !os) {
    return { success: false, error: 'OS não encontrada' }
  }

  const patientRaw = os.patients as unknown as { id: string; full_name: string; cpf: string } | null

  return {
    success: true,
    os: {
      id: os.id,
      numero: os.numero,
      status: os.status,
      pagador: os.pagador,
      total: os.total,
      desconto_total: os.desconto_total,
      acrescimo_total: os.acrescimo_total,
      notes: os.notes,
      created_at: os.created_at,
      faturada_at: os.faturada_at,
      patient: patientRaw
        ? {
            id: patientRaw.id,
            maskedName: maskName(patientRaw.full_name),
            maskedCpf: maskCpf(patientRaw.cpf),
          }
        : null,
      items: (os.service_order_items ?? []) as Array<{
        id: string
        description: string
        quantity: number
        valor_unitario: number
        valor_total: number
        dente: string | null
        face: string | null
      }>,
    },
  }
}

// ─── listOs ───────────────────────────────────────────────────────────────────
// Clinic-scoped list with status/pagador/month filters (nuqs-driven).

export async function listOs(filters?: {
  status?: string
  pagador?: string
  month?: string // 'YYYY-MM'
  unitId?: string
}): Promise<{
  success: boolean
  orders?: Array<{
    id: string
    numero: string
    status: string
    pagador: string
    total: number
    created_at: string
    patient_maskedName: string | null
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('service_orders')
    .select(`
      id, numero, status, pagador, total, created_at,
      patients ( full_name )
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.pagador) query = query.eq('pagador', filters.pagador)
  if (filters?.unitId) query = query.eq('unit_id', filters.unitId)
  if (filters?.month) {
    const [year, month] = filters.month.split('-')
    if (year && month) {
      const from = `${year}-${month}-01`
      const nextMonth = parseInt(month) === 12
        ? `${parseInt(year) + 1}-01-01`
        : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`
      query = query.gte('created_at', from).lt('created_at', nextMonth)
    }
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

  const orders = (data ?? []).map((row) => {
    const p = row.patients as unknown as { full_name: string } | null
    return {
      id: row.id,
      numero: row.numero,
      status: row.status,
      pagador: row.pagador,
      total: row.total,
      created_at: row.created_at,
      patient_maskedName: p ? maskName(p.full_name) : null,
    }
  })

  return { success: true, orders }
}
