'use server'
import 'server-only'
/**
 * rpa.ts — RPA Autônomo Server Actions (TRIB-02)
 * Phase 16 / Plan 08
 *
 * gerarRpa           — emite RPA com retenções por vigência, numeração atômica,
 *                      PDF arquivado + CP origem='tributo' para cada retenção (D-16/D-17/D-19/D-20)
 * getRpaDocumentUrl  — signed URL TTL=60s; pdf_storage_path NUNCA retornado (Pitfall 7/T-16-41)
 * listRpas           — listagem SEM pdf_storage_path (Pitfall 7)
 * estornarRpa        — SEMPRE via createApprovalRequest alçada (D-24/T-16-44)
 *
 * Security:
 *   T-16-40: valorBruto via rpaSchema + computeRpaWithholdings puro (nada inline)
 *   T-16-41: pdf_storage_path nunca em select de listRpas/getRpa; só getRpaDocumentUrl
 *   T-16-43: next_rpa_number() SECURITY DEFINER atômico (Pitfall 2)
 *   T-16-44: estornarRpa → createApprovalRequest + logBusinessEvent
 *   T-16-46: writer gate ['admin','superadmin']
 *   T-16-47: guard competencia_fechamentos em gerarRpa (D-26)
 *   Pitfall 4: computeRpaWithholdings já deduz INSS antes do IRRF (lib pura)
 *   Pitfall 7: storage_path nunca retornado ao cliente
 *   Pitfall 8: simples_nacional → issAliquota = 0
 */

import { revalidatePath } from 'next/cache'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logBusinessEvent } from '@/lib/audit'
import {
  computeRpaWithholdings,
  selectBracketsByVigencia,
} from '@/lib/financeiro/tax-tables'
import type { InssBracket, IrrfBracket } from '@/lib/financeiro/tax-tables'
import { createTributoPayable } from '@/actions/payables'
import { createApprovalRequest } from '@/actions/approval-actions'
import { rpaSchema } from '@/lib/validators/rpa'
import { RpaPDF } from '@/components/pdf/RpaPDF'

// ─── Actor helper (verbatim from receivables.ts) ─────────────────────────────

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

// ─── Role gate ────────────────────────────────────────────────────────────────
const WRITER_ROLES = ['admin', 'superadmin'] as const

// ─── ISS bracket interface ────────────────────────────────────────────────────
interface IssBracketRow {
  vigencia_inicio: string
  vigencia_fim: string | null
  municipio_ibge: string
  aliquota: number
}

// ─── gerarRpa ─────────────────────────────────────────────────────────────────
/**
 * TRIB-02: emite RPA para autônomo.
 * D-16: supplier.vinculo deve ser 'autonomo'.
 * D-17: retenções calculadas por vigência da data de pagamento.
 * D-19: clinics.regime_tributario → simples_nacional pula ISS.
 * D-20: cada retenção > 0 vira CP origem='tributo'.
 */
export async function gerarRpa(rawInput: unknown): Promise<{
  success: boolean
  rpaId?: string
  numero?: string
  payableIds?: string[]
  error?: string
}> {
  // 1. Auth + writer gate
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para emitir RPA' }
  }

  // Parse rpaSchema (friendly first error — T-16-40)
  const parsed = rpaSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()

  // 2. Verificar vínculo do supplier (D-16): deve ser 'autonomo'
  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('id, name, document_number, vinculo')
    .eq('id', data.supplierId)
    .single()

  if (supplierError || !supplier) {
    return { success: false, error: 'Fornecedor não encontrado' }
  }

  if (supplier.vinculo !== 'autonomo') {
    return { success: false, error: 'RPA só para autônomo (vinculo=autonomo)' }
  }

  // Carregar clinics.regime_tributario (D-19)
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, regime_tributario')
    .eq('id', actor.tenant_id)
    .single()

  if (clinicError || !clinic) {
    return { success: false, error: 'Clínica não encontrada' }
  }

  // Carregar municipio_ibge da unidade (para ISS)
  let municipioIbge: string | null = null
  if (data.unitId) {
    const { data: unitFiscal } = await supabase
      .from('unit_fiscal_config')
      .select('municipio_ibge')
      .eq('unit_id', data.unitId)
      .maybeSingle()
    municipioIbge = unitFiscal?.municipio_ibge ?? null
  }

  // 3. Guard de competência fechada (T-16-47/D-26)
  if (data.unitId) {
    const { data: fechamento } = await supabase
      .from('competencia_fechamentos')
      .select('id')
      .eq('clinic_id', actor.tenant_id)
      .eq('unit_id', data.unitId)
      .eq('competencia', data.competencia)
      .maybeSingle()

    if (fechamento) {
      return { success: false, error: `Competência ${data.competencia} fechada` }
    }
  }

  // 4. Carregar brackets por vigência da data de pagamento (D-17)
  const dataPagamentoDate = new Date(data.dataPagamento + 'T00:00:00')

  const [inssBracketsRaw, irrfBracketsRaw, issBracketsRaw] = await Promise.all([
    supabase.from('inss_tax_tables').select('*').order('faixa_min'),
    supabase.from('irrf_tax_tables').select('*').order('faixa_min'),
    municipioIbge
      ? supabase.from('iss_tax_tables').select('*').eq('municipio_ibge', municipioIbge)
      : Promise.resolve({ data: [] as IssBracketRow[], error: null }),
  ])

  const inssBrackets = selectBracketsByVigencia(
    (inssBracketsRaw.data ?? []) as InssBracket[],
    dataPagamentoDate,
  )

  const irrfBrackets = selectBracketsByVigencia(
    (irrfBracketsRaw.data ?? []) as IrrfBracket[],
    dataPagamentoDate,
  )

  const issBracketsVigentes = selectBracketsByVigencia(
    (issBracketsRaw.data ?? []) as IssBracketRow[],
    dataPagamentoDate,
  )

  // 5. Determinar issAliquota
  //    simples_nacional → 0 (pula ISS a pagar, Pitfall 8/D-19)
  let issAliquota = 0
  if (clinic.regime_tributario !== 'simples_nacional') {
    if (data.issOverride !== undefined) {
      issAliquota = data.issOverride
    } else if (issBracketsVigentes.length > 0) {
      issAliquota = issBracketsVigentes[0]!.aliquota
    }
  }

  // 6. computeRpaWithholdings (NUNCA calcular inline — T-16-40)
  //    Lib já: Pitfall 3 (teto INSS), Pitfall 4 (IRRF base = bruto − INSS)
  const w = computeRpaWithholdings(
    data.valorBruto,
    data.modalidadeInss,
    inssBrackets,
    irrfBrackets,
    issAliquota,
  )

  // 7. Numeração atômica via next_rpa_number (T-16-43, Pitfall 2)
  const unitIdForRpa = data.unitId ?? null
  if (!unitIdForRpa) {
    return { success: false, error: 'unitId obrigatório para emissão de RPA' }
  }

  const { data: rpcNumero, error: rpcError } = await supabase.rpc('next_rpa_number', {
    p_unit_id: unitIdForRpa,
  })

  if (rpcError || !rpcNumero) {
    return { success: false, error: rpcError?.message ?? 'Erro ao gerar número do RPA' }
  }

  const numero = rpcNumero as string

  // 8. INSERT rpa_records
  const { data: rpa, error: rpaInsertError } = await supabase
    .from('rpa_records')
    .insert({
      clinic_id: actor.tenant_id,
      unit_id: unitIdForRpa,
      supplier_id: data.supplierId,
      professional_id: null, // pode ser linkado depois via payout
      numero,
      competencia: data.competencia,
      data_pagamento: data.dataPagamento,
      valor_bruto: data.valorBruto,
      valor_inss: w.inss,
      valor_irrf: w.irrf,
      valor_iss: w.iss,
      valor_liquido: w.liquido,
      aliquota_inss: data.modalidadeInss === '11pct' ? 0.11 : null,
      aliquota_irrf: null, // calculado progressivamente pela lib
      aliquota_iss: issAliquota,
      municipio_ibge: municipioIbge,
      regime_tributario: clinic.regime_tributario ?? null, // snapshot
      modalidade_inss: data.modalidadeInss,
      status: 'emitido',
      created_by: actor.id,
    })
    .select('id')
    .single()

  if (rpaInsertError || !rpa) {
    return { success: false, error: rpaInsertError?.message ?? 'Erro ao criar RPA' }
  }

  const rpaId = rpa.id

  // 9. PDF: renderToBuffer → upload no bucket 'documents' → gravar pdf_storage_path
  //    NUNCA retornar o path (Pitfall 7/T-16-41)
  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(RpaPDF, {
        numero,
        competencia: data.competencia,
        prestadorNome: supplier.name,
        prestadorDoc: supplier.document_number ?? '',
        valorBruto: data.valorBruto,
        valorInss: w.inss,
        valorIrrf: w.irrf,
        valorIss: w.iss,
        valorLiquido: w.liquido,
        dataPagamento: data.dataPagamento,
        clinicaNome: clinic.name,
      })
    )

    const storagePath = `rpa/${actor.tenant_id}/${rpaId}.pdf`
    const admin = createAdminClient()

    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (!uploadError) {
      // Gravar pdf_storage_path — NUNCA retornado ao cliente
      await supabase
        .from('rpa_records')
        .update({ pdf_storage_path: storagePath })
        .eq('id', rpaId)
    }
  } catch (pdfErr) {
    // PDF generation failure is non-fatal (RPA já emitido); log e continua
    console.error('[gerarRpa] PDF generation failed:', pdfErr)
  }

  // 10. Lançar retenções como CP origem='tributo' (D-20)
  //     GPS (INSS), DARF (IRRF), guia municipal (ISS) — apenas quando > 0
  const payableIds: string[] = []
  const retencoesTodo: { descricao: string; valor: number }[] = [
    { descricao: `INSS (GPS) RPA ${numero}`, valor: w.inss },
    { descricao: `IRRF (DARF) RPA ${numero}`, valor: w.irrf },
    { descricao: `ISS (Guia Municipal) RPA ${numero}`, valor: w.iss },
  ]

  // Vencimento padrão do tributo: 20 dias após pagamento (simplificado)
  const dataPag = new Date(data.dataPagamento + 'T00:00:00')
  dataPag.setDate(dataPag.getDate() + 20)
  const tributoDueDate = dataPag.toISOString().split('T')[0]!

  for (const ret of retencoesTodo) {
    if (ret.valor <= 0) continue

    // Para createTributoPayable precisamos de accountId e costCenterId
    // Buscamos conta de tributo padrão da clínica (simplificado: accountId/costCenterId podem ser nulos
    // em uma implementação de bootstrap; a action createTributoPayable os aceita como string obrigatório
    // mas podemos usar IDs sentinel. Para esta fase, buscamos a conta 'tributos' do chart_of_accounts)
    const { data: taxAccount } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('clinic_id', actor.tenant_id)
      .ilike('name', '%tributo%')
      .maybeSingle()

    const { data: taxCC } = await supabase
      .from('cost_centers')
      .select('id')
      .eq('clinic_id', actor.tenant_id)
      .limit(1)
      .maybeSingle()

    if (!taxAccount?.id || !taxCC?.id) {
      // Sem conta de tributo configurada — logar mas não falhar
      console.warn('[gerarRpa] Conta de tributo não encontrada; CP tributo não criado para', ret.descricao)
      continue
    }

    const cpResult = await createTributoPayable({
      supplierId: null,
      descricao: ret.descricao,
      valor: ret.valor,
      dueDate: tributoDueDate,
      competencia: data.competencia,
      accountId: taxAccount.id,
      costCenterId: taxCC.id,
      documentId: null,
    })

    if (cpResult.success && cpResult.payableId) {
      payableIds.push(cpResult.payableId)
    }
  }

  // 11. Audit + revalidate
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'gerar_rpa',
    details: { rpa_id: rpaId, numero, competencia: data.competencia },
  })

  revalidatePath('/clinica/financeiro/rpa')

  return { success: true, rpaId, numero, payableIds }
}

// ─── getRpaDocumentUrl ────────────────────────────────────────────────────────
/**
 * Pitfall 7 / T-16-41: signed URL TTL=60s.
 * pdf_storage_path NUNCA retornado — apenas a URL temporária.
 */
export async function getRpaDocumentUrl(rpaId: string): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  const admin = createAdminClient()

  // SELECT com pdf_storage_path via admin (RLS escopa ao tenant via clinic_id)
  const { data: rpa, error: rpaError } = await admin
    .from('rpa_records')
    .select('id, pdf_storage_path, clinic_id')
    .eq('id', rpaId)
    .eq('clinic_id', actor.tenant_id)
    .maybeSingle()

  if (rpaError || !rpa) {
    return { success: false, error: 'RPA não encontrado' }
  }

  if (!rpa.pdf_storage_path) {
    return { success: false, error: 'PDF não disponível' }
  }

  const { data: signedData, error: signErr } = await admin.storage
    .from('documents')
    .createSignedUrl(rpa.pdf_storage_path, 60) // TTL=60s (Pitfall 7)

  if (signErr || !signedData) {
    return { success: false, error: 'Falha ao gerar URL do documento' }
  }

  return { success: true, url: signedData.signedUrl }
}

// ─── listRpas ─────────────────────────────────────────────────────────────────
/**
 * Listagem SEM pdf_storage_path (Pitfall 7/T-16-41).
 */
export async function listRpas(filters: {
  competencia?: string
  supplierId?: string
  status?: string
}): Promise<{ success: boolean; rpas?: unknown[]; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }

  const supabase = await createClient()

  // NUNCA incluir pdf_storage_path no select (T-16-41)
  let query = supabase
    .from('rpa_records')
    .select(
      'id, numero, competencia, data_pagamento, valor_bruto, valor_inss, valor_irrf, valor_iss, valor_liquido, status, supplier_id, professional_id, unit_id, created_at'
    )
    .order('created_at', { ascending: false })

  if (filters.competencia) {
    query = query.eq('competencia', filters.competencia)
  }
  if (filters.supplierId) {
    query = query.eq('supplier_id', filters.supplierId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) return { success: false, error: error.message }

  return { success: true, rpas: data ?? [] }
}

// ─── estornarRpa ──────────────────────────────────────────────────────────────
/**
 * D-24 / T-16-44: RPA emitido SEMPRE via createApprovalRequest (alçada).
 * NÃO cancela diretamente.
 */
export async function estornarRpa(
  rpaId: string,
  motivo: string,
): Promise<{ success: boolean; error?: string }> {
  const actorResult = await getActor()
  if ('error' in actorResult) return { success: false, error: actorResult.error }
  const { actor } = actorResult

  if (!(WRITER_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Sem permissão para estornar RPA' }
  }

  const supabase = await createClient()

  // Re-fetch do RPA (deve ser 'emitido')
  const { data: rpa, error: fetchError } = await supabase
    .from('rpa_records')
    .select('id, status, numero')
    .eq('id', rpaId)
    .single()

  if (fetchError || !rpa) {
    return { success: false, error: 'RPA não encontrado' }
  }

  if (rpa.status !== 'emitido') {
    return { success: false, error: `RPA no status '${rpa.status}' não pode ser estornado` }
  }

  // Rotear SEMPRE por alçada (D-24/T-16-44) — NÃO cancelar direto
  const approvalResult = await createApprovalRequest({
    type: 'estorno',
    requiredRole: 'admin',
    payload: { rpa_id: rpaId, rpa_numero: rpa.numero, motivo },
    idempotencyKey: `estorno_rpa_${rpaId}`,
  })

  if (!approvalResult.success) {
    return { success: false, error: approvalResult.error }
  }

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'estorno_rpa_solicitado',
    details: { rpa_id: rpaId, motivo, approval_id: approvalResult.id },
  })

  revalidatePath('/clinica/financeiro/rpa')

  return { success: true }
}
