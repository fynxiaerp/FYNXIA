/**
 * GET /api/financeiro/charges/[id]/recibo.pdf
 *
 * Generates and streams a PDF receipt for a paid charge.
 *
 * SECURITY:
 * - T-3-pdf-I: getActor role gate — admin / dentist / receptionist ONLY (ROADMAP Phase 3 SC-4).
 *   Receptionist legitimately issues receipts at the front desk (overrides UI-SPEC admin/dentist only).
 *   Any other role returns 403.
 * - RLS via createClient() ensures charge belongs to actor's tenant.
 *   Cross-tenant attempt: RLS returns null → 404 (T-2-11 pattern).
 * - CPF appears in PDF — this is a privileged operation with explicit role gate.
 *
 * PITFALL 7: Edge runtime does NOT support @react-pdf/renderer (no fs/Buffer).
 * CRITICAL: export const runtime = 'nodejs' is mandatory here.
 */

// CRITICAL: Node.js runtime required — Edge runtime does not support @react-pdf/renderer (CLAUDE.md + Pitfall 7)
export const runtime = 'nodejs'

// Generous timeout for PDF generation
export const maxDuration = 30

import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ReceiboPDF } from '@/components/pdf/ReceiboPDF'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

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

    // ── Actor + role gate ──────────────────────────────────────────────────────
    // ROADMAP Phase 3 SC-4: receptionist can generate/download receipts.
    // This overrides the 03-UI-SPEC admin/dentist-only restriction (ROADMAP is higher authority).
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (actorError || !actor) {
      return new Response('Usuário não encontrado', { status: 401 })
    }

    // Gate: admin, dentist, receptionist — any other role returns 403
    const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
    if (!allowedRoles.includes(actor.role)) {
      return new Response('Acesso negado', { status: 403 })
    }

    // ── Load charge (RLS-scoped to actor's tenant) ─────────────────────────────
    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select(
        'id, billing_type, total_value, status, provider_charge_id, patient_id, created_at'
      )
      .eq('id', id)
      .single()

    if (chargeError || !charge) {
      // T-2-11 pattern: do not distinguish "not found" from "wrong tenant"
      return new Response('Cobrança não encontrada', { status: 404 })
    }

    // ── Load patient (RLS-scoped) ──────────────────────────────────────────────
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, full_name, cpf')
      .eq('id', charge.patient_id)
      .single()

    if (patientError || !patient) {
      return new Response('Paciente não encontrado', { status: 404 })
    }

    // ── Load clinic name ───────────────────────────────────────────────────────
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', actor.tenant_id)
      .single()

    const clinicName = clinic?.name ?? 'Clínica'

    // ── Determine paid_at: prefer updated_at, fall back to created_at ──────────
    // The charge may have a paid_at if we extended the table; otherwise use created_at.
    const paidAt = (charge as Record<string, unknown>).paid_at as string | undefined
      ?? charge.created_at

    // ── Generate PDF buffer ────────────────────────────────────────────────────
    const pdfElement = createElement(ReceiboPDF, {
      clinicName,
      patientName: patient.full_name,
      patientCpf: patient.cpf,
      billingType: charge.billing_type,
      amount: charge.total_value,
      paidAt,
      providerChargeId: charge.provider_charge_id,
    }) as ReactElement<DocumentProps>

    const buffer = await renderToBuffer(pdfElement)
    const uint8Array = new Uint8Array(buffer)

    const safeFileName = `recibo-${id}.pdf`

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        // No-cache: PDF contains PHI (CPF) — must not be cached by CDN or browser
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('[recibo.pdf] PDF generation error:', error)
    // UI-SPEC: "Erro ao gerar recibo" — generic message (never expose internals)
    return new Response(
      JSON.stringify({
        error: 'Não foi possível gerar o recibo. Tente novamente ou entre em contato com o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
