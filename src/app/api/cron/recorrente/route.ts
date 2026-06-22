/**
 * GET /api/cron/recorrente
 *
 * Vercel Cron endpoint — runs on the 1st of each month to generate recurring CP payables.
 * Iterates all clinics with ≥1 ativo recorrente_template and calls generateRecorrentePayables
 * per clinic for the current competência (YYYY-MM). Idempotent per (template, competência).
 *
 * SECURITY (T-16-24):
 * - Validates Authorization: Bearer {CRON_SECRET} — 401 on mismatch before any DB query.
 *   isCronAuthorized fails CLOSED when CRON_SECRET is unset (misconfiguration).
 *   Vercel injects CRON_SECRET automatically on scheduled invocation.
 *
 * IDEMPOTENCY (T-16-25):
 * - generateRecorrentePayables skips a template if a payable with (recorrente_template_id, competencia)
 *   already exists — safe to re-run for the same month.
 *
 * RUNTIME: Node.js — Edge has no 'net' module for Supabase TCP connections.
 * CROSS-TENANT: Uses createAdminClient (service role) to iterate all clinics.
 */

// CRITICAL: Node.js runtime required (Edge has no 'net' module for Supabase TCP)
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { generateRecorrentePayables } from '@/actions/recorrente'

export async function GET(request: Request) {
  // ── CRON_SECRET validation (T-16-24, fail-closed) ────────────────────────────
  // Vercel injects Authorization: Bearer {CRON_SECRET} on scheduled invocation.
  // isCronAuthorized rejects when CRON_SECRET is unset and uses constant-time compare.
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Compute current competência (YYYY-MM) ─────────────────────────────────
  const competencia = new Date().toISOString().slice(0, 7)

  const admin = createAdminClient()

  // ── Fetch all clinics with ≥1 ativo recorrente_template ──────────────────
  const { data: templateRows, error: fetchError } = await admin
    .from('recorrente_templates')
    .select('clinic_id')
    .eq('ativo', true)

  if (fetchError) {
    console.error('[cron/recorrente] Failed to fetch recorrente_templates:', fetchError.message)
    return Response.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }

  if (!templateRows || templateRows.length === 0) {
    return Response.json({ ok: true, competencia, totals: { created: 0, skipped: 0 } })
  }

  // Deduplicate clinic IDs
  const clinicIds = [...new Set(templateRows.map((r: { clinic_id: string }) => r.clinic_id))]

  let totalCreated = 0
  let totalSkipped = 0

  for (const clinicId of clinicIds) {
    try {
      const result = await generateRecorrentePayables(competencia, clinicId)
      if (result.success) {
        totalCreated += result.created ?? 0
        totalSkipped += result.skipped ?? 0
      } else {
        console.error(
          `[cron/recorrente] generateRecorrentePayables failed for clinic ${clinicId}:`,
          result.error
        )
      }
    } catch (err) {
      console.error(`[cron/recorrente] Unexpected error for clinic ${clinicId}:`, err)
      // Continue with next clinic — one failure should not block others
    }
  }

  return Response.json({
    ok: true,
    competencia,
    totals: { created: totalCreated, skipped: totalSkipped },
  })
}
