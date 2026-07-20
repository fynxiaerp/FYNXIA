/**
 * GET /api/orcamento/pdf
 *
 * Gera e transmite o Orçamento (metas × realizado) em PDF (REP-02 / D-19/D-40).
 *
 * SECURITY (19-11-PLAN.md, mirrors T-17-19/T-17-20 pattern from anvisa-pdf/dre-pdf):
 * - getUser() + resolve tenant_id/role do actor; role gate independente
 *   (admin/socio/superadmin — D-14) além do gate já interno em getBudgetVsRealizado
 *   (defesa em profundidade: 401 sem sessão, 403 sem permissão).
 * - export const runtime = 'nodejs' — Edge não suporta @react-pdf/renderer nem
 *   conexões TCP do Supabase.
 * - Cache-Control: no-store — PDF pode conter dados financeiros sensíveis.
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md)
export const runtime = 'nodejs'

// Generous timeout for PDF generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getBudgetVsRealizado } from '@/actions/budget-targets'
import { listUnits } from '@/actions/units'
import { BudgetPdf } from '@/components/relatorios/BudgetPdf'

const BUDGET_PDF_ROLES = ['admin', 'socio', 'superadmin']

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

    // ── Actor + role gate (D-14) ──────────────────────────────────────────────
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    if (!BUDGET_PDF_ROLES.includes(actor.role)) {
      return new Response('Permissão insuficiente para exportar o orçamento', { status: 403 })
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
    const anoParam = url.searchParams.get('ano')
    const currentYear = new Date().getFullYear()
    const anoParsed = anoParam ? parseInt(anoParam, 10) : NaN
    const ano = Number.isInteger(anoParsed) ? anoParsed : currentYear
    const unitId = url.searchParams.get('unit') ?? undefined

    // ── Dados do orçamento (RLS tenant-scoped + role gate interno via
    //    getBudgetVsRealizado — T-19-08) ──────────────────────────────────────
    const result = await getBudgetVsRealizado({ ano, unitId })

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Não foi possível carregar os dados do orçamento.' }),
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

    const pdfElement = createElement(BudgetPdf, {
      clinicName,
      ano,
      unidadeLabel,
      geradoEm,
      rows: result.rows ?? [],
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="orcamento.pdf"',
        // No-cache: PDF contém dados financeiros sensíveis
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error('[orcamento-pdf] PDF generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Não foi possível gerar o orçamento. Tente novamente ou entre em contato com o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
