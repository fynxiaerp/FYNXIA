/**
 * GET /api/societario/pdf
 *
 * Gera e transmite a distribuição de resultado societário em PDF (REP-03 / D-40).
 *
 * SECURITY (threat_model 19-12-PLAN.md):
 * - T-19-02: role gate — admin/superadmin/socio may request this PDF; other
 *   roles (dentist, receptionist, etc.) get 403. A sócio's PDF naturally
 *   contains only their own row because getPartnerDistribution's underlying
 *   partner_shares read is RLS-scoped (partner_shares_self_or_admin_read) —
 *   no extra client-trusted filtering is layered on top here.
 * - T-17-20 precedent: export const runtime = 'nodejs' obrigatório — Edge não
 *   suporta @react-pdf/renderer (sem fs/Buffer) nem conexões TCP do Supabase.
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md)
export const runtime = 'nodejs'

// Generous timeout for PDF generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getPartnerDistribution } from '@/actions/partner-shares'
import { SocietarioPdf } from '@/components/relatorios/SocietarioPdf'

// Admin/superadmin get the full distribution; sócio gets only their own row
// (already RLS-scoped). All other roles are denied (T-19-02).
const ALLOWED_ROLES = ['admin', 'superadmin', 'socio']

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function formatDateBR(isoDate: string): string {
  // isoDate no formato yyyy-MM-dd (querystring) — evita deslocamento de fuso
  // ao construir o Date a partir de meio-dia local.
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

    // ── Actor + role gate (T-19-02) ───────────────────────────────────────────
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(actor.role)) {
      return new Response('Acesso negado', { status: 403 })
    }

    // ── Nome da clínica ──────────────────────────────────────────────────────
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', actor.tenant_id)
      .single()

    const clinicName = clinic?.name ?? 'Clínica'

    // ── Período da querystring ────────────────────────────────────────────────
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: 'Período (from/to) obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Período inválido (YYYY-MM-DD)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Dados (RLS tenant + share-row scoped — T-19-02) ──────────────────────
    const result = await getPartnerDistribution({ from, to })

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Não foi possível carregar a distribuição societária.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Gerar PDF ─────────────────────────────────────────────────────────────
    const geradoEm = new Date().toISOString()
    const periodoLabel = `${formatDateBR(from)} até ${formatDateBR(to)}`

    const pdfElement = createElement(SocietarioPdf, {
      clinicName,
      periodoLabel,
      geradoEm,
      resultado: result.resultado ?? 0,
      distribution: result.distribution ?? [],
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="societario.pdf"',
        // No-cache: PDF pode conter dados financeiros sensíveis (resultado/valores por sócio)
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error('[societario-pdf] PDF generation error:', error)
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
