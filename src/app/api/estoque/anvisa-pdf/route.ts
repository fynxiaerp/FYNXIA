/**
 * GET /api/estoque/anvisa-pdf
 *
 * Gera e transmite o relatório de rastreabilidade ANVISA de implantes em PDF
 * (EST-03 / D-12/D-13).
 *
 * SECURITY (threat_model 17-08-PLAN.md):
 * - T-17-19: autentica via getUser() + resolve tenant_id do actor; a leitura
 *   de dados (listAnvisaTraceability) roda sob RLS tenant-scoped via
 *   createClient() — nenhum registro cross-tenant é acessível aqui.
 * - T-17-20: export const runtime = 'nodejs' obrigatório — Edge não suporta
 *   @react-pdf/renderer (sem fs/Buffer) nem conexões TCP do Supabase.
 *
 * Filtros (querystring — mesmas 5 chaves usadas por AnvisaReportTable/
 * AnvisaExportButton): produto (nome, não id — ver AnvisaReportTable.tsx),
 * lote, paciente, from, to. Filtragem aplicada em memória sobre o resultado
 * de listAnvisaTraceability() para espelhar exatamente a mesma lógica de
 * filtro usada na tabela (client-side) — garante paridade entre o que é
 * exibido na tela e o que é exportado.
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md + T-17-20)
export const runtime = 'nodejs'

// Generous timeout for PDF generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { listAnvisaTraceability, type AnvisaRow } from '@/actions/stock-draws'
import { AnvisaReportPdf } from '@/components/estoque/AnvisaReportPdf'

function formatDateBR(isoDate: string): string {
  // isoDate no formato yyyy-MM-dd (querystring) — evita deslocamento de fuso
  // ao construir o Date a partir de meio-dia local.
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function buildPeriodoLabel(from: string | null, to: string | null): string {
  if (from && to) return `${formatDateBR(from)} até ${formatDateBR(to)}`
  if (from) return `A partir de ${formatDateBR(from)}`
  if (to) return `Até ${formatDateBR(to)}`
  return 'Todos os registros'
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

    // ── Actor (só usuários da clínica — T-17-19) ─────────────────────────────
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
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
    const produto = url.searchParams.get('produto')
    const lote = url.searchParams.get('lote')
    const paciente = url.searchParams.get('paciente')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    // ── Dados (RLS tenant-scoped via createClient — T-17-19) ────────────────
    const result = await listAnvisaTraceability()

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error ?? 'Não foi possível carregar os dados do relatório.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Filtragem em memória — espelha exatamente AnvisaReportTable.tsx (client)
    let rows: AnvisaRow[] = result.data ?? []
    if (produto) {
      rows = rows.filter((r) => r.produto === produto)
    }
    if (lote) {
      const term = lote.toLowerCase()
      rows = rows.filter((r) => (r.numero_lote ?? '').toLowerCase().includes(term))
    }
    if (paciente) {
      const term = paciente.toLowerCase()
      rows = rows.filter((r) => r.paciente.toLowerCase().includes(term))
    }
    if (from) {
      const fromDate = new Date(`${from}T00:00:00`)
      rows = rows.filter((r) => new Date(r.data) >= fromDate)
    }
    if (to) {
      const toDate = new Date(`${to}T23:59:59`)
      rows = rows.filter((r) => new Date(r.data) <= toDate)
    }

    // ── Gerar PDF ─────────────────────────────────────────────────────────────
    const geradoEm = new Date().toISOString()
    const periodoLabel = buildPeriodoLabel(from, to)

    const pdfElement = createElement(AnvisaReportPdf, {
      clinicName,
      periodoLabel,
      geradoEm,
      rows,
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio-anvisa.pdf"',
        // No-cache: PDF pode conter dados de paciente (PII LGPD)
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error('[anvisa-pdf] PDF generation error:', error)
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
