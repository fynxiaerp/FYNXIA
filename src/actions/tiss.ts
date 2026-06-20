'use server'
import 'server-only'
/**
 * src/actions/tiss.ts — TISS guide/lote/glosa/recurso Server Actions
 *
 * CONV-02:
 *   criarGuiaForOs — called by faturarOs (Plan 05) convênio branch
 *   fecharLote     — groups em_analise guides, calls provider.sendLote, stores protocolo
 *
 * CONV-03 / D-28:
 *   registrarGlosa   — per-item (motivo ANS + valor glosado); re-derives guide status/totals
 *   registrarRecurso — sets item glosa_status='em_recurso', re-derives guide status
 *
 * Read:
 *   getGuias  — clinic-scoped list with operadora/status/month filters
 *   getGlosas — glosada/em_recurso items joined with motivo descricao
 *
 * Security:
 *   T-15-25: valor re-computed server-side from service_order_items; insurer_id via OS
 *   T-15-26: registrarGlosa validates valorGlosado <= item.valor_total
 *   T-15-27: glosa_status is per-item; guide status DERIVED via deriveGuideStatus
 *   T-15-28: patient displayed first_name + last_initial only (LGPD)
 *   T-15-29: criarGuiaForOs idempotent on service_order_id (D-30)
 *
 * Dependency injection: criarGuia, fecharLote, registrarGlosa, registrarRecurso accept
 * optional `deps` for unit testing without Supabase.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 * Requirements: CONV-02, CONV-03
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTissProvider } from '@/lib/tiss/index'
import { computeGuiaGlosaTotals, deriveGuideStatus } from '@/lib/tiss/glosa-math'
import { logToHub } from '@/lib/integrations/hub-log'
import { revalidatePath } from 'next/cache'

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

// ─── LGPD name helper ─────────────────────────────────────────────────────────

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!
  const firstName = parts[0]!
  const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

// ─── criarGuia (test-injectable stub-friendly) ────────────────────────────────
// Exposed for unit tests (tiss.test.ts injects insertGuia dep).

export async function criarGuia(
  input: { serviceOrderId: string; insurerId: string; patientId: string },
  deps?: {
    insertGuia?: (data: { status: string }) => Promise<{ id: string; status: string }>
  },
): Promise<{ success: boolean; guiaId?: string }> {
  const { serviceOrderId, insurerId, patientId } = input

  if (deps?.insertGuia) {
    // Test path — use injected insertGuia
    const row = await deps.insertGuia({ status: 'em_analise' })
    return { success: true, guiaId: row.id }
  }

  // Production path
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false }
  const { actor } = actorResult

  const supabase = await createClient()

  // Idempotency (D-30)
  const { data: existing } = await supabase
    .from('tiss_guides')
    .select('id')
    .eq('service_order_id', serviceOrderId)
    .maybeSingle()

  if (existing) return { success: true, guiaId: existing.id }

  // Fetch OS items
  const { data: items } = await supabase
    .from('service_order_items')
    .select('id, description, tuss_code, quantity, valor_unitario, valor_total, dente, face')
    .eq('service_order_id', serviceOrderId)

  // Fetch insurer for registro_ans
  const { data: insurer } = await supabase
    .from('insurers')
    .select('registro_ans, tiss_version')
    .eq('id', insurerId)
    .maybeSingle()

  const ts = Date.now()
  const numeroGuia = `G-${ts}`

  const { data: guide, error: guideErr } = await supabase
    .from('tiss_guides')
    .insert({
      clinic_id: actor.tenant_id,
      service_order_id: serviceOrderId,
      insurer_id: insurerId,
      patient_id: patientId,
      numero_guia: numeroGuia,
      registro_ans: insurer?.registro_ans ?? null,
      status: 'em_analise',
      valor_total: 0,
      valor_glosado: 0,
    })
    .select('id')
    .single()

  if (guideErr || !guide) return { success: false }

  // Insert guide items mirroring service_order_items
  if (items && items.length > 0) {
    const itemRows = items.map((item) => ({
      clinic_id: actor.tenant_id,
      guide_id: guide.id,
      service_order_item_id: item.id,
      tuss_code: item.tuss_code ?? null,
      description: item.description,
      quantity: item.quantity,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      dente: item.dente ?? null,
      face: item.face ?? null,
      glosa_status: 'pendente',
      valor_glosado: 0,
    }))
    await supabase.from('tiss_guide_items').insert(itemRows)

    // Update guide valor_total from items
    const valorTotal = items.reduce((s, i) => s + i.valor_total, 0)
    await supabase.from('tiss_guides').update({ valor_total: valorTotal }).eq('id', guide.id)
  }

  // Call provider.createGuia and store provider_ref/numero_guia
  const provider = await getTissProvider(actor.tenant_id, insurerId)
  const providerResult = await provider.createGuia({
    guideId: guide.id,
    serviceOrderId,
    tissVersion: insurer?.tiss_version ?? '3.05.00',
    items: (items ?? []).map((i) => ({
      tussCode: i.tuss_code ?? null,
      description: i.description,
      quantity: i.quantity,
      valorUnitario: i.valor_unitario,
      valorTotal: i.valor_total,
      dente: i.dente ?? null,
      face: i.face ?? null,
    })),
  })

  await supabase
    .from('tiss_guides')
    .update({ provider_ref: providerResult.provider_ref, numero_guia: providerResult.numero_guia })
    .eq('id', guide.id)

  revalidatePath('/clinica/financeiro/faturamento/convenios')
  return { success: true, guiaId: guide.id }
}

// ─── criarGuiaForOs — called by faturarOs (Plan 05) ──────────────────────────
// Contract: export async function criarGuiaForOs(osId): Promise<{success,guideId?,error?}>

export async function criarGuiaForOs(
  osId: string,
): Promise<{ success: boolean; guideId?: string; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  const supabase = await createClient()

  // Idempotency (D-30): short-circuit if guide already exists
  const { data: existing } = await supabase
    .from('tiss_guides')
    .select('id')
    .eq('service_order_id', osId)
    .maybeSingle()

  if (existing) return { success: true, guideId: existing.id }

  // Fetch OS (must be pagador='convenio' with insurer_id)
  const { data: os, error: osFetchErr } = await supabase
    .from('service_orders')
    .select('id, pagador, insurer_id, patient_id, total, clinic_id')
    .eq('id', osId)
    .single()

  if (osFetchErr || !os) return { success: false, error: 'OS não encontrada' }
  if (os.pagador !== 'convenio') return { success: false, error: 'OS não é de convênio' }
  if (!os.insurer_id) return { success: false, error: 'OS sem operadora' }

  const result = await criarGuia({
    serviceOrderId: osId,
    insurerId: os.insurer_id,
    patientId: os.patient_id ?? '',
  })

  return result.success
    ? { success: true, guideId: result.guiaId }
    : { success: false, error: 'Erro ao criar guia TISS' }
}

// ─── fecharLote ───────────────────────────────────────────────────────────────

export async function fecharLote(
  loteId: string,
  deps?: {
    getLoteGuides?: () => Promise<{ id: string; insurer_id: string; service_order_id: string }[]>
    getProvider?: () => { sendLote: (input: Record<string, unknown>) => Promise<{ protocolo: string }> }
    updateLote?: (data: { protocolo: string; status?: string }) => Promise<void>
  },
): Promise<{ success: boolean; protocolo?: string; error?: string }> {
  if (deps) {
    // Test path
    const guides = await (deps.getLoteGuides?.() ?? Promise.resolve([]))
    const provider = deps.getProvider?.() ?? { sendLote: async () => ({ protocolo: 'STUB' }) }
    const result = await provider.sendLote({ loteId, guides })
    await deps.updateLote?.({ protocolo: result.protocolo, status: 'enviado' })
    return { success: true, protocolo: result.protocolo }
  }

  // Production path
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  const supabase = await createClient()

  // Fetch lote row
  const { data: lote, error: loteFetchErr } = await supabase
    .from('tiss_lotes')
    .select('id, insurer_id, competencia, clinic_id')
    .eq('id', loteId)
    .single()

  if (loteFetchErr || !lote) return { success: false, error: 'Lote não encontrado' }

  // Fetch em_analise guides without a lote yet
  const { data: guides, error: guidesFetchErr } = await supabase
    .from('tiss_guides')
    .select('id, insurer_id, service_order_id, numero_guia, valor_total')
    .eq('insurer_id', lote.insurer_id)
    .eq('status', 'em_analise')
    .is('lote_id', null)

  if (guidesFetchErr) return { success: false, error: guidesFetchErr.message }

  const guideList = guides ?? []
  const valorTotal = guideList.reduce((s, g) => s + g.valor_total, 0)

  // Fetch insurer details for the provider call
  const { data: insurer } = await supabase
    .from('insurers')
    .select('registro_ans, tiss_version, cnpj, name')
    .eq('id', lote.insurer_id)
    .maybeSingle()

  // Call provider.sendLote
  const provider = await getTissProvider(actor.tenant_id, lote.insurer_id)
  const loteResult = await provider.sendLote({
    loteId,
    insurer: {
      id: lote.insurer_id,
      registroAns: insurer?.registro_ans ?? null,
      tissVersion: insurer?.tiss_version ?? '3.05.00',
      cnpj: insurer?.cnpj ?? null,
      name: insurer?.name ?? '',
    },
    competencia: lote.competencia,
    guides: guideList.map((g) => ({
      guideId: g.id,
      serviceOrderId: g.service_order_id,
      tissVersion: insurer?.tiss_version ?? '3.05.00',
      items: [],
    })),
  })

  const now = new Date().toISOString()

  // Store protocolo + data_envio on tiss_lotes
  await supabase
    .from('tiss_lotes')
    .update({
      protocolo: loteResult.protocolo,
      provider_ref: loteResult.provider_ref ?? null,
      data_envio: now,
      status: 'enviado',
      valor_total: valorTotal,
    })
    .eq('id', loteId)

  // Link guides to lote
  if (guideList.length > 0) {
    const guideIds = guideList.map((g) => g.id)
    await supabase
      .from('tiss_guides')
      .update({ lote_id: loteId, protocolo: loteResult.protocolo })
      .in('id', guideIds)
  }

  // logToHub fire-and-forget (T-09-09)
  const admin = createAdminClient()
  logToHub({
    admin,
    connectorType: 'tiss',
    direction: 'outbound',
    clinicId: actor.tenant_id,
    eventType: 'lote_enviado',
    status: 'processed',
  }).catch((err) => console.error('[fecharLote] hub log error:', err))

  revalidatePath('/clinica/financeiro/faturamento/convenios')
  return { success: true, protocolo: loteResult.protocolo }
}

// ─── registrarGlosa ───────────────────────────────────────────────────────────

export async function registrarGlosa(
  itemId: string,
  motivoGlosaId: string,
  valorGlosado: number,
  deps?: {
    updateItem?: (data: { glosa_status: string; motivo_glosa_id: string; valor_glosado: number }) => Promise<void>
  },
): Promise<{ success: boolean; error?: string }> {
  if (deps?.updateItem) {
    // Test path — injectable
    await deps.updateItem({
      glosa_status: 'glosada',
      motivo_glosa_id: motivoGlosaId,
      valor_glosado: valorGlosado,
    })
    return { success: true }
  }

  // Production path
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  // Fetch item to validate valorGlosado <= item.valor_total (T-15-26)
  const { data: item, error: itemFetchErr } = await supabase
    .from('tiss_guide_items')
    .select('id, guide_id, valor_total')
    .eq('id', itemId)
    .single()

  if (itemFetchErr || !item) return { success: false, error: 'Item não encontrado' }

  if (valorGlosado > item.valor_total) {
    return { success: false, error: 'Valor glosado não pode exceder o valor do item' }
  }

  // Update item (D-28 / CONV-03)
  const { error: updateErr } = await supabase
    .from('tiss_guide_items')
    .update({
      motivo_glosa_id: motivoGlosaId,
      valor_glosado: valorGlosado,
      glosa_status: 'glosada',
    })
    .eq('id', itemId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Re-derive guide status and totals from ALL items (D-28, Pitfall 5)
  await _rederiveGuide(item.guide_id)

  revalidatePath('/clinica/financeiro/faturamento/glosas')
  return { success: true }
}

// ─── registrarRecurso ─────────────────────────────────────────────────────────

export async function registrarRecurso(
  itemId: string,
  texto: string,
  deps?: {
    updateItem?: (data: { glosa_status: string; recurso_texto: string; recurso_at: string }) => Promise<void>
  },
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString()

  if (deps?.updateItem) {
    // Test path
    await deps.updateItem({ glosa_status: 'em_recurso', recurso_texto: texto, recurso_at: now })
    return { success: true }
  }

  // Production path
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  // Fetch item for guide_id
  const { data: item, error: itemFetchErr } = await supabase
    .from('tiss_guide_items')
    .select('id, guide_id')
    .eq('id', itemId)
    .single()

  if (itemFetchErr || !item) return { success: false, error: 'Item não encontrado' }

  const { error: updateErr } = await supabase
    .from('tiss_guide_items')
    .update({ glosa_status: 'em_recurso', recurso_texto: texto, recurso_at: now })
    .eq('id', itemId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Re-derive guide status (T-15-27: per-item, not whole guide)
  await _rederiveGuide(item.guide_id)

  revalidatePath('/clinica/financeiro/faturamento/glosas')
  return { success: true }
}

// ─── Internal: re-derive guide status + totals from items ────────────────────

async function _rederiveGuide(guideId: string): Promise<void> {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('tiss_guide_items')
    .select('glosa_status, valor_total, valor_glosado')
    .eq('guide_id', guideId)

  if (!items) return

  const totals = computeGuiaGlosaTotals(
    items.map((i) => ({ valorTotal: i.valor_total, valorGlosado: i.valor_glosado })),
  )
  const status = deriveGuideStatus(items.map((i) => ({ glosa_status: i.glosa_status })))

  await supabase
    .from('tiss_guides')
    .update({
      valor_glosado: totals.valorGlosado,
      valor_autorizado: totals.valorAutorizado,
      status,
    })
    .eq('id', guideId)
}

// ─── getGuias ─────────────────────────────────────────────────────────────────

export async function getGuias(filters?: {
  insurerId?: string
  status?: string
  month?: string // 'YYYY-MM'
}): Promise<{
  success: boolean
  guides?: Array<{
    id: string
    numero_guia: string
    status: string
    valor_total: number
    valor_glosado: number
    valor_autorizado: number | null
    protocolo: string | null
    created_at: string
    insurer_name: string | null
    patient_maskedName: string | null
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('tiss_guides')
    .select(`
      id, numero_guia, status, valor_total, valor_glosado, valor_autorizado, protocolo, created_at,
      insurers ( name ),
      patients ( full_name )
    `)
    .order('created_at', { ascending: false })

  if (filters?.insurerId) query = query.eq('insurer_id', filters.insurerId)
  if (filters?.status) query = query.eq('status', filters.status)
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

  const guides = (data ?? []).map((row) => {
    const insurer = row.insurers as unknown as { name: string } | null
    const patient = row.patients as unknown as { full_name: string } | null
    return {
      id: row.id,
      numero_guia: row.numero_guia,
      status: row.status,
      valor_total: row.valor_total,
      valor_glosado: row.valor_glosado,
      valor_autorizado: row.valor_autorizado,
      protocolo: row.protocolo,
      created_at: row.created_at,
      insurer_name: insurer?.name ?? null,
      patient_maskedName: patient ? maskName(patient.full_name) : null, // T-15-28 LGPD
    }
  })

  return { success: true, guides }
}

// ─── getGlosas ────────────────────────────────────────────────────────────────

export async function getGlosas(filters?: {
  insurerId?: string
  status?: 'glosada' | 'em_recurso'
  month?: string
}): Promise<{
  success: boolean
  glosas?: Array<{
    id: string
    guide_id: string
    description: string
    valor_total: number
    valor_glosado: number
    glosa_status: string | null
    recurso_texto: string | null
    motivo_codigo: string | null
    motivo_descricao: string | null
    insurer_name: string | null
    patient_maskedName: string | null
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  let query = supabase
    .from('tiss_guide_items')
    .select(`
      id, guide_id, description, valor_total, valor_glosado, glosa_status, recurso_texto,
      glosa_motivos ( codigo_ans, descricao ),
      tiss_guides ( insurer_id, patient_id, patients ( full_name ), insurers ( name ) )
    `)
    .in('glosa_status', filters?.status ? [filters.status] : ['glosada', 'em_recurso'])
    .order('id', { ascending: false })

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  const glosas = (data ?? []).map((row) => {
    const motivo = row.glosa_motivos as unknown as { codigo_ans: string; descricao: string } | null
    const guide = row.tiss_guides as unknown as {
      patients?: { full_name: string } | null
      insurers?: { name: string } | null
    } | null
    const patient = guide?.patients as { full_name: string } | null
    const insurer = guide?.insurers as { name: string } | null
    return {
      id: row.id,
      guide_id: row.guide_id,
      description: row.description,
      valor_total: row.valor_total,
      valor_glosado: row.valor_glosado,
      glosa_status: row.glosa_status,
      recurso_texto: row.recurso_texto,
      motivo_codigo: motivo?.codigo_ans ?? null,
      motivo_descricao: motivo?.descricao ?? null,
      insurer_name: insurer?.name ?? null,
      patient_maskedName: patient ? maskName(patient.full_name) : null, // T-15-28 LGPD
    }
  })

  return { success: true, glosas }
}
