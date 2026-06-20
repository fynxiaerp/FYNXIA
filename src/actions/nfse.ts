'use server'
import 'server-only'
/**
 * src/actions/nfse.ts — NFS-e Server Actions (OS-02, D-20, D-19)
 *
 * emitirNfseForOs  — called by faturarOs (Plan 05); regime split + convenio guard
 * emitirNfse       — public-facing wrapper for manual "Emitir NFS-e" button
 * cancelarNfse     — D-19: routed through Phase 10 alçada + audit
 * getNfses         — clinic-scoped list with LGPD masking
 * getNfseDocumentUrl — signed URL (60s TTL) for NFS-e XML/PDF archival
 *
 * SECURITY:
 *   T-15-19: tomador_cpf sent only to aggregator over HTTPS — never stored in
 *            nfse_records or returned to any client response.
 *   T-15-22: CAS advance uses .eq('status','processando') — forward-only.
 *   T-15-24: idempotency: existing nfse_records for service_order_id short-circuits;
 *            insert processando BEFORE provider.emit() (Pitfall 2).
 *   T-15-23: getNfses never returns raw storage_path; signed URL helper only.
 *
 * Dependency injection: emitirNfse (and emitirNfseForOs) accept optional `deps`
 * so unit tests can mock without Supabase. In production all deps are omitted.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFiscalProvider } from '@/lib/fiscal'
import { computeIss, resolveAliquota, computeValorLiquido } from '@/lib/fiscal/iss'
import { createApprovalRequest } from '@/actions/approval-actions'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// LGPD: first name + last initial only
function maskTomadorNome(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!
  const firstName = parts[0]!
  const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

// ─── Dependency injection types ───────────────────────────────────────────────

type EmitirNfseDeps = {
  getOs?: (osId: string) => Promise<{ pagador: string; status: string }>
  getUnitFiscalConfig?: (osId: string) => Promise<{ regime_emissao: string; aliquota_iss_padrao: number }>
  insertNfseRecord?: (data: { status: string }) => Promise<{ id: string }>
  getProvider?: () => { emit: (input: Record<string, unknown>) => Promise<{ status: string; numero?: string; provider_ref?: string; serie?: string }> }
}

// ─── emitirNfse — testable core with DI ──────────────────────────────────────
// D-20: regime split; OS-02: convenio guard; Pitfall 2: insert before emit.
// This function is called by emitirNfseForOs (production) and by tests directly.

export async function emitirNfse(
  osId: string,
  _input: Record<string, unknown>,
  deps?: EmitirNfseDeps
): Promise<{ success: boolean; nfseId?: string; skipped?: boolean; error?: string }> {

  // ── 1. Fetch OS ────────────────────────────────────────────────────────────
  let os: { pagador: string; status: string }
  if (deps?.getOs) {
    os = await deps.getOs(osId)
  } else {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('service_orders')
      .select('pagador, status, patient_id, unit_id, total, clinic_id')
      .eq('id', osId)
      .single()
    if (error || !data) return { success: false, error: 'OS não encontrada' }
    os = data
  }

  // ── 2. Guard: convenio → no NFS-e (OS-02) ─────────────────────────────────
  if (os.pagador === 'convenio') {
    return { success: true, skipped: true }
  }

  // ── 3. Fetch unit fiscal config (regime split — D-20) ─────────────────────
  let unitConfig: { regime_emissao: string; aliquota_iss_padrao: number }
  if (deps?.getUnitFiscalConfig) {
    unitConfig = await deps.getUnitFiscalConfig(osId)
  } else {
    const admin = createAdminClient()
    const osRecord = os as Record<string, unknown>
    const unitId = osRecord['unit_id'] as string | null
    if (!unitId) return { success: true, skipped: true } // no unit config → skip
    const { data: cfg, error: cfgErr } = await admin
      .from('unit_fiscal_config')
      .select('regime_emissao, aliquota_iss_padrao, emitente_cnpj, prestador_inscricao_municipal, municipio_codigo_ibge, item_lista_servico, serie_rps, optante_simples_nacional, iss_retido')
      .eq('unit_id', unitId)
      .maybeSingle()
    if (cfgErr || !cfg) return { success: true, skipped: true } // no fiscal config → skip
    unitConfig = cfg
  }

  // ── 4. Guard: regime caixa → defer to payment webhook (D-20) ──────────────
  if (unitConfig.regime_emissao === 'caixa') {
    return { success: true, skipped: true }
  }

  // ── 5. INSERT nfse_records status='processando' BEFORE emit (Pitfall 2) ───
  let nfseId: string
  if (deps?.insertNfseRecord) {
    const row = await deps.insertNfseRecord({ status: 'processando' })
    nfseId = row.id
  } else {
    const admin = createAdminClient()
    const osRecord = os as Record<string, unknown>

    // Idempotency: existing non-erro row short-circuits (D-30, T-15-24)
    const { data: existing } = await admin
      .from('nfse_records')
      .select('id, status')
      .eq('service_order_id', osId)
      .neq('status', 'erro')
      .maybeSingle()
    if (existing) return { success: true, nfseId: existing.id }

    const clinicId = osRecord['clinic_id'] as string
    const total = (osRecord['total'] as number) ?? 0
    const fullConfig = unitConfig as Record<string, unknown>
    const aliquota = resolveAliquota({ aliquota_iss_override: null }, { aliquota_iss_padrao: unitConfig.aliquota_iss_padrao })
    const valorIss = computeIss(total, aliquota)
    const issRetido = Boolean(fullConfig['iss_retido'])
    const valorLiquido = computeValorLiquido(total, valorIss, issRetido)

    // LGPD: fetch patient name server-side for masking
    let tomadorNome = 'Paciente'
    let tomadorCpf = ''
    const patientId = osRecord['patient_id'] as string | null
    if (patientId) {
      const { data: pt } = await admin
        .from('patients')
        .select('first_name, last_name, cpf')
        .eq('id', patientId)
        .maybeSingle()
      if (pt) {
        tomadorNome = maskTomadorNome(`${pt.first_name} ${pt.last_name ?? ''}`.trim())
        tomadorCpf = pt.cpf ?? '' // raw CPF only for provider.emit, NOT stored
      }
    }

    const { data: inserted, error: insertErr } = await admin
      .from('nfse_records')
      .insert({
        service_order_id: osId,
        clinic_id: clinicId,
        status: 'processando',
        valor_servicos: total,
        aliquota_iss: aliquota,
        valor_iss: valorIss,
        valor_liquido: valorLiquido,
        iss_retido: issRetido,
        tomador_nome: tomadorNome,  // LGPD: first_name + last_initial only (T-15-19)
        // tomador_cpf NOT stored here — only sent to aggregator
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      return { success: false, error: 'Falha ao criar registro NFS-e' }
    }
    nfseId = inserted.id

    // ── 6. Call provider.emit (AFTER insert — Pitfall 2) ───────────────────
    const provider = await getFiscalProvider(clinicId)
    const fullConfigTyped = fullConfig as {
      emitente_cnpj?: string
      prestador_inscricao_municipal?: string
      municipio_codigo_ibge?: string
      item_lista_servico?: string
      optante_simples_nacional?: boolean
      iss_retido?: boolean
    }

    const result = await provider.emit({
      prestador_cnpj: fullConfigTyped.emitente_cnpj ?? '',
      prestador_inscricao_municipal: fullConfigTyped.prestador_inscricao_municipal ?? '',
      prestador_codigo_municipio: fullConfigTyped.municipio_codigo_ibge ?? '',
      tomador_cpf: tomadorCpf, // raw CPF — sent to aggregator only (T-15-19)
      tomador_nome: tomadorNome,
      discriminacao: `Serviços odontológicos — OS ${osId}`,
      valor_servicos: total,
      item_lista_servico: fullConfigTyped.item_lista_servico ?? '11.02',
      aliquota_iss: aliquota,
      iss_retido: issRetido,
      natureza_operacao: '1',
      optante_simples_nacional: Boolean(fullConfigTyped.optante_simples_nacional),
      idempotency_key: `nfse:os:${osId}`,
    })

    // ── 7. CAS advance: forward-only (T-15-22, Pitfall 8) ──────────────────
    const mappedStatus = result.status
    await admin
      .from('nfse_records')
      .update({
        status: mappedStatus,
        provider_ref: result.provider_ref ?? null,
        numero: result.numero ?? null,
        serie: result.serie ?? null,
        ...(mappedStatus === 'emitida' ? { emitida_at: new Date().toISOString() } : {}),
        ...(mappedStatus === 'erro' ? { error_message: result.error_message ?? null } : {}),
        ...(result.xml_url ? { xml_storage_path: result.xml_url } : {}),
        ...(result.pdf_url ? { pdf_storage_path: result.pdf_url } : {}),
      })
      .eq('id', nfseId)
      .eq('status', 'processando') // CAS guard — forward-only

    return { success: true, nfseId }
  }

  // ── 6 (DI path). Call provider.emit AFTER insert (Pitfall 2) ──────────────
  if (!deps?.getProvider) return { success: false, error: 'getProvider required in test mode' }
  const provider = deps.getProvider()
  await provider.emit({ idempotency_key: `nfse:os:${osId}` })

  try { revalidatePath('/clinica/financeiro/faturamento/nfse') } catch { /* no-op outside Next.js context */ }
  return { success: true, nfseId }
}

// ─── emitirNfseForOs — called by faturarOs (Plan 05 contract) ────────────────

export async function emitirNfseForOs(
  osId: string
): Promise<{ success: boolean; nfseId?: string; error?: string }> {
  // Production path: no deps injection — runs real Supabase queries
  return emitirNfse(osId, {})
}

// ─── cancelarNfse — D-19: alçada + audit ─────────────────────────────────────

export async function cancelarNfse(
  nfseId: string,
  motivo: string
): Promise<{ success: boolean; approvalId?: string; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  // Fetch the nfse_records row to get provider_ref
  const admin = createAdminClient()
  const { data: nfse, error: nfseErr } = await admin
    .from('nfse_records')
    .select('id, status, provider_ref, clinic_id, service_order_id')
    .eq('id', nfseId)
    .eq('clinic_id', actor.tenant_id) // tenant-scoped
    .maybeSingle()

  if (nfseErr || !nfse) return { success: false, error: 'NFS-e não encontrada' }
  if (nfse.status === 'cancelada') return { success: true } // already cancelled
  if (nfse.status !== 'emitida') {
    return { success: false, error: 'Apenas NFS-e com status emitida pode ser cancelada' }
  }

  // D-19: route through Phase 10 alçada (createApprovalRequest)
  const approvalResult = await createApprovalRequest({
    type: 'estorno',
    payload: { nfseId, motivo, service_order_id: nfse.service_order_id },
    requiredRole: 'admin',
  })

  if (!approvalResult.success) {
    return { success: false, error: approvalResult.error }
  }

  // NOTE: actual provider.cancel + status='cancelada' update happens in the
  // approval workflow (approveRequest → executes the payload). This ensures
  // the cancellation is audited and authorized before reaching the aggregator.

  return { success: true, approvalId: approvalResult.id }
}

// ─── getNfses — clinic-scoped list with LGPD masking ─────────────────────────

export async function getNfses(filters?: {
  month?: string   // YYYY-MM
  status?: string
}): Promise<{
  data?: Array<{
    id: string
    service_order_id: string
    numero: string | null
    serie: string | null
    status: string
    valor_servicos: number
    valor_iss: number
    tomador_nome: string  // LGPD masked: first_name + last_initial
    emitida_at: string | null
    created_at: string
  }>
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { error: actorResult.error }
  const { actor } = actorResult

  const admin = createAdminClient()
  let query = admin
    .from('nfse_records')
    .select(
      'id, service_order_id, numero, serie, status, valor_servicos, valor_iss, tomador_nome, emitida_at, created_at'
      // NOTE: xml_storage_path and pdf_storage_path NOT selected here (T-15-23)
      // Use getNfseDocumentUrl(nfseId) for signed URL access only
    )
    .eq('clinic_id', actor.tenant_id)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.month) {
    // Filter by month: e.g. "2026-06" → >= 2026-06-01 AND < 2026-07-01
    const [year, month] = filters.month.split('-').map(Number)
    if (year && month) {
      const start = new Date(year, month - 1, 1).toISOString()
      const end = new Date(year, month, 1).toISOString()
      query = query.gte('created_at', start).lt('created_at', end)
    }
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── getNfseDocumentUrl — signed URL (60s TTL) for archival (T-15-23, D-17) ──

export async function getNfseDocumentUrl(
  nfseId: string,
  type: 'xml' | 'pdf'
): Promise<{ url?: string; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { error: actorResult.error }
  const { actor } = actorResult

  const admin = createAdminClient()
  const { data: nfse, error: nfseErr } = await admin
    .from('nfse_records')
    .select('id, xml_storage_path, pdf_storage_path, clinic_id')
    .eq('id', nfseId)
    .eq('clinic_id', actor.tenant_id) // tenant-scoped
    .maybeSingle()

  if (nfseErr || !nfse) return { error: 'NFS-e não encontrada' }

  const storagePath = type === 'xml' ? nfse.xml_storage_path : nfse.pdf_storage_path
  if (!storagePath) return { error: 'Documento não disponível' }

  const { data: signedData, error: signErr } = await admin.storage
    .from('documents')
    .createSignedUrl(storagePath, 60) // 60s TTL (Phase 8 pattern, T-15-23)

  if (signErr || !signedData) return { error: 'Falha ao gerar URL do documento' }
  return { url: signedData.signedUrl }
}
