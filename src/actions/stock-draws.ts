'use server'
import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import { runStockReplenishmentAgent } from '@/lib/agents/stock-agent'
import { stockDrawSchema, type StockDrawInput } from '@/lib/validators/product'

/**
 * Server Actions: baixa de estoque — Phase 17 Plan 05 (EST-02, EST-03)
 *
 * drawMaterialsForProcedures: baixa FIFO automática disparada por
 * updateAppointment (Task 3) quando appointments.status='concluido'. Chamada
 * internamente — não é exportada como Server Action de UI.
 *
 * createManualDraw: baixa manual (perda/quebra/vencimento/ajuste) com motivo
 * obrigatório (D-19) — apenas admin/superadmin.
 *
 * listStockDraws / listAnvisaTraceability: leitura (RLS tenant_read aplica
 * via createClient — sessão do usuário).
 *
 * IMPORTANTE (critical_context): stock_draws NÃO tem RLS de escrita para o role
 * authenticated — toda escrita em stock_draws (automática e manual) usa
 * createAdminClient (service role), nunca createClient.
 *
 * FIFO / CAS guard (Pitfall 2 do 17-RESEARCH.md): supabase-js não expressa
 * "SET saldo_disponivel = saldo_disponivel - qtd" como UPDATE relativo (sem
 * função RPC dedicada no schema já aplicado). selectFifoBatch implementa um
 * compare-and-swap equivalente: lê saldo_disponivel do lote FIFO mais antigo,
 * e só debita se o UPDATE casar com o valor lido (.eq('saldo_disponivel', lido))
 * — se outro processo já alterou o lote nesse meio-tempo, 0 linhas são
 * afetadas e o próximo lote FIFO é tentado. Se nenhum lote comporta a
 * quantidade, batch_id fica NULL (D-09 — saldo negativo permitido, o
 * atendimento nunca é bloqueado por falta de estoque).
 *
 * Requirements: EST-02, EST-03
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
// D-18/D-19: baixa manual apenas admin/superadmin.

const WRITER_ROLES = ['admin', 'superadmin'] as const

type AdminClient = ReturnType<typeof createAdminClient>

// ─── selectFifoBatch (FIFO + CAS guard) ─────────────────────────────────────
// D-11: seleciona o lote mais antigo com saldo_disponivel > 0 (FIFO) e debita
// qtd atomicamente. Retorna null se nenhum lote comportar a qtd — D-09 (saldo
// negativo permitido, batch_id NULL na baixa).

async function selectFifoBatch(
  admin: AdminClient,
  productId: string,
  unitId: string,
  qtd: number
): Promise<{ batchId: string; custoUnitario: number } | null> {
  const triedIds: string[] = []

  for (let attempt = 0; attempt < 25; attempt++) {
    let query = admin
      .from('product_batches')
      .select('id, saldo_disponivel, custo_unitario')
      .eq('product_id', productId)
      .eq('unit_id', unitId)
      .gt('saldo_disponivel', 0) // FIFO: apenas lotes com saldo disponível
      .is('deleted_at', null)
      .order('created_at', { ascending: true }) // FIFO: mais antigo primeiro
      .limit(1)

    if (triedIds.length > 0) {
      query = query.not('id', 'in', `(${triedIds.join(',')})`)
    }

    const { data: candidate } = await query.maybeSingle()
    if (!candidate) return null // nenhum lote disponível — D-09 saldo negativo permitido

    if (candidate.saldo_disponivel < qtd) {
      // Lote não comporta a qtd inteira — tenta o próximo lote FIFO (sem split entre lotes)
      triedIds.push(candidate.id)
      continue
    }

    // CAS guard: UPDATE só aplica se saldo_disponivel ainda for o valor lido —
    // se outro processo já debitou este lote na janela entre SELECT e UPDATE,
    // 0 linhas retornam e tentamos o próximo lote FIFO (Pitfall 2).
    const { data: updated, error: updateError } = await admin
      .from('product_batches')
      .update({ saldo_disponivel: candidate.saldo_disponivel - qtd })
      .eq('id', candidate.id)
      .eq('saldo_disponivel', candidate.saldo_disponivel)
      .select('id')

    if (!updateError && updated && updated.length > 0) {
      return { batchId: candidate.id, custoUnitario: candidate.custo_unitario }
    }

    // Corrida perdida — outro processo já alterou este lote; tenta o próximo
    triedIds.push(candidate.id)
  }

  return null
}

// ─── Helper: saldo atual do produto na unidade + trigger de reposição ──────
// D-14: verificação de estoque mínimo real-time após cada baixa.

async function checkMinimoAndReplenish(
  admin: AdminClient,
  clinicId: string,
  unitId: string,
  productId: string
): Promise<void> {
  const { data: batches } = await admin
    .from('product_batches')
    .select('saldo_disponivel')
    .eq('product_id', productId)
    .eq('unit_id', unitId)
    .is('deleted_at', null)

  const saldoAtual = (batches ?? []).reduce((sum, b) => sum + b.saldo_disponivel, 0)

  const { data: product } = await admin
    .from('products')
    .select('name, estoque_minimo, estoque_maximo, preferred_supplier_id')
    .eq('id', productId)
    .maybeSingle()

  if (!product) return

  // saldo negativo implica sempre saldo <= estoque_minimo (estoque_minimo >= 0 — Zod .min(0)),
  // então a mesma branch cobre D-09 (saldo negativo) e D-14 (mínimo atingido).
  if (saldoAtual <= product.estoque_minimo) {
    await runStockReplenishmentAgent({
      clinicId,
      unitId,
      productId,
      productName: product.name,
      saldoAtual,
      estoqueMinimo: product.estoque_minimo,
      estoqueMaximo: product.estoque_maximo,
      preferredSupplierId: product.preferred_supplier_id,
    })
  }
}

// ─── drawMaterialsForProcedures ──────────────────────────────────────────────
// D-06: chamada por updateAppointment quando appointments.status='concluido'.
// Percorre os appointment_procedures do atendimento, cruza com
// service_material_templates (D-07) e baixa cada material via FIFO.
// Toda falha por material é isolada (try/catch interno) — D-09: falta de
// estoque nunca bloqueia o atendimento nem aborta os demais materiais.

export async function drawMaterialsForProcedures(
  appointmentId: string,
  clinicId: string,
  actorId: string
): Promise<void> {
  const admin: AdminClient = createAdminClient()

  // 1. Resolver unit_id via appointments — appointment_procedures NÃO tem unit_id
  //    (Open Question 3 do 17-RESEARCH.md).
  const { data: appointment } = await admin
    .from('appointments')
    .select('unit_id')
    .eq('id', appointmentId)
    .eq('tenant_id', clinicId)
    .maybeSingle()

  if (!appointment?.unit_id) {
    console.error('[stock-draws] drawMaterialsForProcedures: appointment/unit_id não encontrado', appointmentId)
    return
  }
  const unitId = appointment.unit_id

  // 2. Buscar os procedimentos do atendimento
  const { data: procedures } = await admin
    .from('appointment_procedures')
    .select('id, service_id')
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)

  if (!procedures || procedures.length === 0) return

  let drawsCreated = 0

  for (const proc of procedures) {
    try {
      // 3. Templates de consumo do serviço (D-07)
      const { data: templates } = await admin
        .from('service_material_templates')
        .select('product_id, qtd_padrao')
        .eq('service_id', proc.service_id)
        .is('deleted_at', null)

      if (!templates || templates.length === 0) continue

      for (const tpl of templates) {
        try {
          // 4. FIFO batch selection (D-11) — batchId null permitido (D-09)
          const fifo = await selectFifoBatch(admin, tpl.product_id, unitId, tpl.qtd_padrao)

          let custoUnitario = fifo?.custoUnitario
          if (custoUnitario === undefined) {
            // Sem lote disponível — usa custo médio do produto como snapshot (D-09)
            const { data: product } = await admin
              .from('products')
              .select('custo_medio')
              .eq('id', tpl.product_id)
              .maybeSingle()
            custoUnitario = product?.custo_medio ?? 0
          }

          const { error: drawError } = await admin.from('stock_draws').insert({
            clinic_id: clinicId,
            unit_id: unitId,
            product_id: tpl.product_id,
            batch_id: fifo?.batchId ?? null,
            appointment_procedure_id: proc.id,
            qtd: tpl.qtd_padrao,
            custo_unitario_snapshot: custoUnitario,
            tipo: 'automatico',
            created_by: actorId,
          })

          if (drawError) {
            console.error('[stock-draws] drawMaterialsForProcedures: insert falhou:', drawError.message)
            continue
          }
          drawsCreated++

          // 5. Recalcular saldo do produto na unidade + disparar agente se <= mínimo (D-14)
          await checkMinimoAndReplenish(admin, clinicId, unitId, tpl.product_id)
        } catch (materialErr) {
          // D-09: falha em um material NÃO aborta os demais nem o atendimento
          console.error('[stock-draws] drawMaterialsForProcedures: falha ao baixar material:', materialErr)
        }
      }
    } catch (procErr) {
      console.error('[stock-draws] drawMaterialsForProcedures: falha ao processar procedimento:', procErr)
    }
  }

  // 6. Audit trail (D-08)
  if (drawsCreated > 0) {
    await logBusinessEvent({
      tenantId: clinicId,
      actorId,
      action: 'stock.draw.auto',
      details: { appointment_id: appointmentId, draws_created: drawsCreated },
    })
  }
}

// ─── createManualDraw ────────────────────────────────────────────────────────
// D-19: baixa manual com motivo obrigatório — apenas admin/superadmin.

export async function createManualDraw(
  input: StockDrawInput & { unit_id: string }
): Promise<{ success: boolean; error?: string }> {
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

  const parsed = stockDrawSchema.safeParse(rest)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  // stock_draws não tem RLS de escrita para authenticated — usar admin client (critical_context)
  const admin: AdminClient = createAdminClient()

  const fifo = await selectFifoBatch(admin, data.product_id, unit_id, data.qtd)

  let custoUnitario = fifo?.custoUnitario
  if (custoUnitario === undefined) {
    const { data: product } = await admin
      .from('products')
      .select('custo_medio')
      .eq('id', data.product_id)
      .maybeSingle()
    custoUnitario = product?.custo_medio ?? 0
  }

  const { error: drawError } = await admin.from('stock_draws').insert({
    clinic_id: actor.tenant_id,
    unit_id,
    product_id: data.product_id,
    batch_id: fifo?.batchId ?? null,
    appointment_procedure_id: null,
    qtd: data.qtd,
    custo_unitario_snapshot: custoUnitario,
    tipo: 'manual',
    motivo: data.motivo,
    created_by: actor.id,
  })

  if (drawError) {
    return { success: false, error: drawError.message }
  }

  // D-19: audit trail obrigatório para baixa manual
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'stock.draw.manual',
    details: {
      product_id: data.product_id,
      qtd: data.qtd,
      motivo: data.motivo,
      observacao: data.observacao ?? null,
    },
  })

  // D-14: mesmo check de mínimo da baixa automática
  await checkMinimoAndReplenish(admin, actor.tenant_id, unit_id, data.product_id)

  revalidatePath('/clinica/estoque/produtos')

  return { success: true }
}

// ─── listStockDraws ───────────────────────────────────────────────────────────

export type DrawRow = {
  id: string
  product_id: string
  product_name: string
  unidade_medida: string
  unit_id: string
  qtd: number
  custo_unitario_snapshot: number
  tipo: string
  motivo: string | null
  created_at: string
}

export async function listStockDraws(opts?: {
  productId?: string
  unitId?: string
}): Promise<{ success: boolean; error?: string; data?: DrawRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('stock_draws')
    .select(
      'id, product_id, unit_id, qtd, custo_unitario_snapshot, tipo, motivo, created_at, products(name, unidade_medida)'
    )
    .order('created_at', { ascending: false })

  if (opts?.productId) {
    query = query.eq('product_id', opts.productId)
  }
  if (opts?.unitId) {
    query = query.eq('unit_id', opts.unitId)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const result: DrawRow[] = (data ?? []).map(
    (row: {
      id: string
      product_id: string
      unit_id: string
      qtd: number
      custo_unitario_snapshot: number
      tipo: string
      motivo: string | null
      created_at: string
      products: { name: string; unidade_medida: string } | { name: string; unidade_medida: string }[] | null
    }) => {
      const product = row.products ? (Array.isArray(row.products) ? row.products[0] : row.products) : null
      return {
        id: row.id,
        product_id: row.product_id,
        product_name: product?.name ?? '',
        unidade_medida: product?.unidade_medida ?? '',
        unit_id: row.unit_id,
        qtd: row.qtd,
        custo_unitario_snapshot: row.custo_unitario_snapshot,
        tipo: row.tipo,
        motivo: row.motivo,
        created_at: row.created_at,
      }
    }
  )

  return { success: true, data: result }
}

// ─── listAnvisaTraceability ───────────────────────────────────────────────────
// D-12: relatório ANVISA de implantes — stock_draws JOIN product_batches JOIN
// products (category='implante') JOIN appointment_procedures→appointments→
// patients + professionals + services.

export type AnvisaRow = {
  id: string
  data: string
  paciente: string
  profissional: string
  procedimento: string
  produto: string
  numero_lote: string | null
  numero_anvisa: string | null
  data_validade: string | null
  qtd: number
}

type OneOrMany<T> = T | T[] | null

function one<T>(v: OneOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type AnvisaRawRow = {
  id: string
  qtd: number
  created_at: string
  product_id: string
  products: OneOrMany<{ name: string; category: string }>
  product_batches: OneOrMany<{ numero_lote: string; numero_anvisa: string | null; data_validade: string | null }>
  appointment_procedures: OneOrMany<{
    id: string
    service_id: string
    services: OneOrMany<{ name: string }>
    professional_id: string | null
    professionals: OneOrMany<{ full_name: string }>
    appointments: OneOrMany<{
      id: string
      patient_id: string | null
      patients: OneOrMany<{ full_name: string }>
    }>
  }>
}

export async function listAnvisaTraceability(opts?: {
  productId?: string
  lote?: string
  paciente?: string
  from?: string
  to?: string
}): Promise<{ success: boolean; error?: string; data?: AnvisaRow[] }> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }

  const supabase = await createClient()

  let query = supabase
    .from('stock_draws')
    .select(
      `id, qtd, created_at, product_id,
       products(name, category),
       product_batches(numero_lote, numero_anvisa, data_validade),
       appointment_procedures(
         id, service_id, professional_id,
         services(name),
         professionals(full_name),
         appointments(id, patient_id, patients(full_name))
       )`
    )
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

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  let result: AnvisaRow[] = ((data ?? []) as unknown as AnvisaRawRow[])
    .map((row) => {
      const product = one(row.products)
      const batch = one(row.product_batches)
      const proc = one(row.appointment_procedures)
      const service = proc ? one(proc.services) : null
      const professional = proc ? one(proc.professionals) : null
      const appointment = proc ? one(proc.appointments) : null
      const patient = appointment ? one(appointment.patients) : null

      return {
        id: row.id,
        data: row.created_at,
        paciente: patient?.full_name ?? '',
        profissional: professional?.full_name ?? '',
        procedimento: service?.name ?? '',
        produto: product?.name ?? '',
        numero_lote: batch?.numero_lote ?? null,
        numero_anvisa: batch?.numero_anvisa ?? null,
        data_validade: batch?.data_validade ?? null,
        qtd: row.qtd,
        _category: product?.category ?? '',
      }
    })
    // D-12: relatório ANVISA cobre apenas produtos categoria='implante'
    .filter((r) => r._category === 'implante')
    .map(({ _category, ...rest }) => rest)

  if (opts?.lote) {
    const term = opts.lote.toLowerCase()
    result = result.filter((r) => (r.numero_lote ?? '').toLowerCase().includes(term))
  }
  if (opts?.paciente) {
    const term = opts.paciente.toLowerCase()
    result = result.filter((r) => r.paciente.toLowerCase().includes(term))
  }

  return { success: true, data: result }
}
