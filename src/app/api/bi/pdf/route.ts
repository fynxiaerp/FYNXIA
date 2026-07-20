/**
 * GET /api/bi/pdf
 *
 * Gera e transmite o resumo de indicadores de BI em PDF, por dimensão
 * (BI-01/BI-02 / D-40).
 *
 * SECURITY (threat_model 19-13-PLAN.md, mirrors T-19-01/T-19-02 pattern from
 * dre-pdf/societario/pdf):
 * - getUser() + resolve tenant_id/role do actor; role gate independente
 *   (admin/socio/superadmin — D-39) além do gate já interno em getBiKpis
 *   (defesa em profundidade: 401 sem sessão, 403 sem permissão).
 * - export const runtime = 'nodejs' — Edge não suporta @react-pdf/renderer nem
 *   conexões TCP do Supabase.
 * - Cache-Control: no-store — PDF pode conter dados financeiros/operacionais sensíveis.
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md)
export const runtime = 'nodejs'

// Generous timeout for PDF generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getBiKpis, type BiKpis } from '@/actions/bi-kpis'
import { listUnits } from '@/actions/units'
import { BiPdf, type BiPdfRow } from '@/components/relatorios/BiPdf'

const BI_PDF_ROLES = ['admin', 'socio', 'superadmin']

const DIMENSION_LABELS: Record<string, string> = {
  operacional: 'Operacional',
  profissionais: 'Profissionais',
  crc: 'CRC',
  estoque_tiss: 'Estoque/TISS',
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function formatDateBR(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Format helpers (per-key, mirrors BiDashboard.tsx's kpi_key vocabulary) ───

const PERCENT_KEYS = new Set(['ocupacao', 'glosa_taxa', 'conversao_leads'])
const BRL_KEYS = new Set(['ticket_medio', 'cpl', 'cac'])

function formatKpiValue(key: string, value: number | null): string {
  if (value === null) return '—'
  if (PERCENT_KEYS.has(key)) return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  if (BRL_KEYS.has(key)) return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (key === 'nps') return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return value.toLocaleString('pt-BR')
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── buildRows — label + atual + meta per dimension ────────────────────────────

function buildRows(dimension: string, data: BiKpis): BiPdfRow[] {
  switch (dimension) {
    case 'operacional': {
      const { ocupacao, ticket_medio, consultas_mes } = data.operacional
      return [ocupacao, ticket_medio, consultas_mes].map((kpi) => ({
        label: kpi.label,
        atual: formatKpiValue(kpi.key, kpi.valor),
        meta: kpi.meta !== null ? formatKpiValue(kpi.key, kpi.meta) : '—',
      }))
    }
    case 'profissionais': {
      return data.profissionais.map((p) => ({
        label: p.nome,
        atual: `${formatBRL(p.faturamento)} · ${p.procedimentos.toLocaleString('pt-BR')} proc.`,
        meta: '—',
      }))
    }
    case 'crc': {
      const { nps, cpl, cac, conversao_leads } = data.crc
      return [nps, cpl, cac, conversao_leads].map((kpi) => ({
        label: kpi.label,
        atual: formatKpiValue(kpi.key, kpi.valor),
        meta: kpi.meta !== null ? formatKpiValue(kpi.key, kpi.meta) : '—',
      }))
    }
    case 'estoque_tiss': {
      const { alertas_minimo, glosa_taxa, atraso_pagamento } = data.estoque_tiss
      return [alertas_minimo, glosa_taxa, atraso_pagamento].map((kpi) => ({
        label: kpi.label,
        atual: formatKpiValue(kpi.key, kpi.valor),
        meta: kpi.meta !== null ? formatKpiValue(kpi.key, kpi.meta) : '—',
      }))
    }
    default:
      return []
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // ── Auth ──────────────────────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response('Não autenticado', { status: 401 })
    }

    // ── Actor + role gate (D-39) ─────────────────────────────────────────────
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    if (!BI_PDF_ROLES.includes(actor.role)) {
      return new Response('Permissão insuficiente para exportar o BI', { status: 403 })
    }

    // ── Nome da clínica ──────────────────────────────────────────────────────
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', actor.tenant_id)
      .single()

    const clinicName = clinic?.name ?? 'Clínica'

    // ── Filtros da querystring ───────────────────────────────────────────────
    const url = new URL(request.url)
    const defaultYm = new Date().toISOString().slice(0, 7)
    const from = url.searchParams.get('from') ?? `${defaultYm}-01`
    const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
    const unitId = url.searchParams.get('unit') ?? undefined
    const dimensionParam = url.searchParams.get('dimension') ?? 'operacional'
    const dimension = DIMENSION_LABELS[dimensionParam] ? dimensionParam : 'operacional'

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return new Response('Período inválido (YYYY-MM-DD)', { status: 400 })
    }

    // ── Dados de BI (RLS tenant-scoped + role gate interno via getBiKpis — T-19-01) ──
    const result = await getBiKpis({ from, to, unitId })

    if (!result.success || !result.data) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Não foi possível carregar os indicadores.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Rótulo de unidade ─────────────────────────────────────────────────────
    let unidadeLabel = 'Todas as unidades'
    if (unitId) {
      const unitsResult = await listUnits()
      const unit = unitsResult.success ? (unitsResult.units ?? []).find((u) => u.id === unitId) : undefined
      unidadeLabel = unit?.name ?? 'Unidade'
    }

    // ── Gerar PDF ─────────────────────────────────────────────────────────────
    const geradoEm = new Date().toISOString()
    const periodoLabel = `${formatDateBR(from)} até ${formatDateBR(to)}`
    const dimensionLabel = DIMENSION_LABELS[dimension] ?? 'Operacional'
    const rows = buildRows(dimension, result.data)

    const pdfElement = createElement(BiPdf, {
      clinicName,
      dimensionLabel,
      periodoLabel,
      unidadeLabel,
      geradoEm,
      rows,
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bi-${dimension}.pdf"`,
        // No-cache: PDF pode conter dados financeiros/operacionais sensíveis
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error('[bi-pdf] PDF generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Não foi possível gerar o relatório. Tente novamente ou entre em contato com o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
