'use server'
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { computeCpl, computeCac } from '@/lib/crc/roi-math'

/**
 * ROI de Campanha — CPL/CAC aggregates (CRC-02, D-05/D-06).
 *
 * getRoiByCampaign / getRoiByOrigin.
 *
 * SECURITY / DESIGN:
 *   1. Read-only — no writes, no assertNotReadOnly() needed (T-18-26).
 *   2. RLS-scoped via createClient(); payables/leads/campaigns always filtered
 *      by actor.tenant_id (defense-in-depth alongside RLS).
 *   3. Cost is committed spend at lançamento (payables.campaign_id), not
 *      baixa/payment — mirrors 18-CONTEXT D-05 + the plan's Assumption A3.
 *      status <> 'cancelado' excludes cancelled payables from cost.
 *   4. Zero-denominator math is delegated to computeCpl/computeCac
 *      (src/lib/crc/roi-math.ts) — never Infinity/NaN, always null → UI '—'.
 */

// ─── Helper: get authenticated actor ────────────────────────────────────────

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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ─── Helper: SUM(payables.valor_total) per campaign_id ──────────────────────
// T-18-27: cost is validated by the existing payables action (amounts always
// go through createPayable's Zod schema); this is a read-only rollup.

async function getCostByCampaign(
  supabase: SupabaseClient,
  tenantId: string,
  from?: string,
  to?: string
): Promise<Map<string, number>> {
  let query = supabase
    .from('payables')
    .select('campaign_id, valor_total')
    .eq('clinic_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'cancelado')
    .not('campaign_id', 'is', null)

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: rows } = await query

  const costByCampaign = new Map<string, number>()
  for (const row of (rows ?? []) as Array<{ campaign_id: string | null; valor_total: number }>) {
    if (!row.campaign_id) continue
    costByCampaign.set(row.campaign_id, (costByCampaign.get(row.campaign_id) ?? 0) + row.valor_total)
  }
  return costByCampaign
}

// ─── getRoiByCampaign ─────────────────────────────────────────────────────────
// Per-campaign CPL/CAC + an aggregate summary for the KPI row.

export type RoiCampaignRow = {
  campaignId: string
  campaignName: string
  custoTotal: number
  leads: number
  convertidos: number
  cpl: number | null
  cac: number | null
  taxaConversao: number
}

export type RoiCampaignSummary = {
  custoTotal: number
  cpl: number | null
  cac: number | null
  taxaConversaoGeral: number
}

export async function getRoiByCampaign(opts?: {
  campaignId?: string
  from?: string
  to?: string
}): Promise<{
  success: boolean
  data?: RoiCampaignRow[]
  summary?: RoiCampaignSummary
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  let campaignsQuery = supabase
    .from('campaigns')
    .select('id, name')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (opts?.campaignId) {
    campaignsQuery = campaignsQuery.eq('id', opts.campaignId)
  }

  const { data: campaigns, error: campaignsError } = await campaignsQuery
  if (campaignsError) {
    return { success: false, error: campaignsError.message }
  }

  const emptySummary: RoiCampaignSummary = { custoTotal: 0, cpl: null, cac: null, taxaConversaoGeral: 0 }

  if (!campaigns || campaigns.length === 0) {
    return { success: true, data: [], summary: emptySummary }
  }

  const costByCampaign = await getCostByCampaign(supabase, actor.tenant_id, opts?.from, opts?.to)

  let leadsQuery = supabase
    .from('leads')
    .select('campaign_id, stage, created_at')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .not('campaign_id', 'is', null)

  if (opts?.from) leadsQuery = leadsQuery.gte('created_at', opts.from)
  if (opts?.to) leadsQuery = leadsQuery.lte('created_at', opts.to)

  const { data: leadRows, error: leadsError } = await leadsQuery
  if (leadsError) {
    return { success: false, error: leadsError.message }
  }

  const leadsByCampaign = new Map<string, { total: number; converted: number }>()
  for (const row of (leadRows ?? []) as Array<{ campaign_id: string | null; stage: string }>) {
    if (!row.campaign_id) continue
    const entry = leadsByCampaign.get(row.campaign_id) ?? { total: 0, converted: 0 }
    entry.total += 1
    if (row.stage === 'convertido') entry.converted += 1
    leadsByCampaign.set(row.campaign_id, entry)
  }

  const data: RoiCampaignRow[] = (campaigns as Array<{ id: string; name: string }>).map((c) => {
    const custoTotal = costByCampaign.get(c.id) ?? 0
    const leadsEntry = leadsByCampaign.get(c.id) ?? { total: 0, converted: 0 }
    const taxaConversao = leadsEntry.total > 0 ? leadsEntry.converted / leadsEntry.total : 0

    return {
      campaignId: c.id,
      campaignName: c.name,
      custoTotal,
      leads: leadsEntry.total,
      convertidos: leadsEntry.converted,
      cpl: computeCpl(custoTotal, leadsEntry.total),
      cac: computeCac(custoTotal, leadsEntry.converted),
      taxaConversao,
    }
  })

  const summaryCustoTotal = data.reduce((sum, r) => sum + r.custoTotal, 0)
  const summaryLeads = data.reduce((sum, r) => sum + r.leads, 0)
  const summaryConvertidos = data.reduce((sum, r) => sum + r.convertidos, 0)

  const summary: RoiCampaignSummary = {
    custoTotal: summaryCustoTotal,
    cpl: computeCpl(summaryCustoTotal, summaryLeads),
    cac: computeCac(summaryCustoTotal, summaryConvertidos),
    taxaConversaoGeral: summaryLeads > 0 ? summaryConvertidos / summaryLeads : 0,
  }

  return { success: true, data, summary }
}

// ─── getRoiByOrigin ───────────────────────────────────────────────────────────
// D-06 second requirement: conversion by lead source. Cost attribution is
// independent of the campaign axis (RESEARCH §Pattern 2) — a source's
// custoAtribuido is the sum of costs of campaigns that have at least one lead
// from that source; sources with no campaign-linked leads render '—'
// (custoAtribuido/cpl/cac all null) per UI-SPEC RoiByOriginTable convention.

export type RoiOriginRow = {
  sourceId: string
  sourceName: string
  leads: number
  convertidos: number
  taxaConversao: number
  custoAtribuido: number | null
  cpl: number | null
  cac: number | null
}

export async function getRoiByOrigin(opts?: {
  from?: string
  to?: string
}): Promise<{
  success: boolean
  data?: RoiOriginRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  const supabase = await createClient()

  const { data: sources, error: sourcesError } = await supabase
    .from('lead_sources')
    .select('id, name')
    .eq('clinic_id', actor.tenant_id)
    .order('is_default', { ascending: false })
    .order('name')

  if (sourcesError) {
    return { success: false, error: sourcesError.message }
  }

  let leadsQuery = supabase
    .from('leads')
    .select('source_id, stage, campaign_id, created_at')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)

  if (opts?.from) leadsQuery = leadsQuery.gte('created_at', opts.from)
  if (opts?.to) leadsQuery = leadsQuery.lte('created_at', opts.to)

  const { data: leadRows, error: leadsError } = await leadsQuery
  if (leadsError) {
    return { success: false, error: leadsError.message }
  }

  const costByCampaign = await getCostByCampaign(supabase, actor.tenant_id, opts?.from, opts?.to)

  const bySource = new Map<
    string,
    { total: number; converted: number; campaignIds: Set<string> }
  >()

  for (const row of (leadRows ?? []) as Array<{
    source_id: string
    stage: string
    campaign_id: string | null
  }>) {
    const entry = bySource.get(row.source_id) ?? { total: 0, converted: 0, campaignIds: new Set<string>() }
    entry.total += 1
    if (row.stage === 'convertido') entry.converted += 1
    if (row.campaign_id) entry.campaignIds.add(row.campaign_id)
    bySource.set(row.source_id, entry)
  }

  const data: RoiOriginRow[] = (sources ?? []).map((source: { id: string; name: string }) => {
    const entry = bySource.get(source.id) ?? { total: 0, converted: 0, campaignIds: new Set<string>() }

    let custoAtribuido: number | null = null
    if (entry.campaignIds.size > 0) {
      custoAtribuido = 0
      for (const campaignId of entry.campaignIds) {
        custoAtribuido += costByCampaign.get(campaignId) ?? 0
      }
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      leads: entry.total,
      convertidos: entry.converted,
      taxaConversao: entry.total > 0 ? entry.converted / entry.total : 0,
      custoAtribuido,
      cpl: custoAtribuido !== null ? computeCpl(custoAtribuido, entry.total) : null,
      cac: custoAtribuido !== null ? computeCac(custoAtribuido, entry.converted) : null,
    }
  })

  return { success: true, data }
}
