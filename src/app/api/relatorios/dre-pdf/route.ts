/**
 * GET /api/relatorios/dre-pdf
 *
 * Gera e transmite o DRE (Demonstração de Resultado) em PDF (REP-01 / D-07).
 *
 * SECURITY (19-10-PLAN.md, mirrors T-17-19/T-17-20 pattern from anvisa-pdf):
 * - getUser() + resolve tenant_id/role do actor; role gate independente
 *   (admin/socio/superadmin — D-09) além do gate já interno em getDre/getDreYoY
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
import { getDre } from '@/actions/dre'
import { listUnits } from '@/actions/units'
import { DrePdf } from '@/components/relatorios/DrePdf'

const DRE_ROLES = ['admin', 'socio', 'superadmin']

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function formatDateBR(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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

    // ── Actor + role gate (D-09) ─────────────────────────────────────────────
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    if (!DRE_ROLES.includes(actor.role)) {
      return new Response('Permissão insuficiente para exportar o DRE', { status: 403 })
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

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return new Response('Período inválido (YYYY-MM-DD)', { status: 400 })
    }

    // ── Dados do DRE (RLS tenant-scoped + role gate interno via getDre — T-19-01) ──
    const result = await getDre({ from, to, unitId })

    if (!result.success || !result.dre) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Não foi possível carregar os dados do DRE.' }),
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

    const pdfElement = createElement(DrePdf, {
      clinicName,
      periodoLabel,
      unidadeLabel,
      geradoEm,
      dre: result.dre,
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="dre.pdf"',
        // No-cache: PDF contém dados financeiros sensíveis
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error('[dre-pdf] PDF generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Não foi possível gerar o DRE. Tente novamente ou entre em contato com o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
