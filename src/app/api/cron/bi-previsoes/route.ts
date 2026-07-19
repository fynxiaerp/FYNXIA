/**
 * GET /api/cron/bi-previsoes
 *
 * Vercel Cron endpoint — roda diariamente às 04:00 UTC (BI-02, D-36). Varre todas
 * as clínicas ativas e chama runBiForecastForClinic per clinic (per-row try/catch
 * so one failure doesn't abort the batch), computando tendências, desvios
 * orçamentários, KPIs fora da meta e atrasos de pagamento — grava bi_alerts e,
 * quando aplicável, approval_requests (D-34, via bi-forecast-agent.ts).
 *
 * The panel (Plan 13) only reads pre-computed bi_alerts — all forecasting/LLM
 * cost happens here, nightly, server-side.
 *
 * SECURITY (mirrors /api/cron/estoque-validade):
 * - isCronAuthorized valida Authorization: Bearer {CRON_SECRET} — 401 fail-closed
 *   antes de qualquer query.
 *
 * RUNTIME: Node.js — Edge não tem módulo 'net' para conexões TCP do Supabase.
 * CROSS-TENANT: createAdminClient (service role) — necessário para iterar todas
 * as clínicas independente de sessão de usuário.
 */

// CRITICAL: Node.js runtime required (Edge has no 'net' module for Supabase TCP)
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { runBiForecastForClinic } from '@/lib/agents/bi-forecast-agent'

export async function GET(request: Request): Promise<Response> {
  // ── CRON_SECRET validation (fail-closed) ──────────────────────────────────
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // ── Fetch all active clinics ──────────────────────────────────────────────
  const { data: clinics, error: fetchError } = await admin
    .from('clinics')
    .select('id')
    .is('deleted_at', null)

  if (fetchError) {
    console.error('[cron/bi-previsoes] Failed to fetch clinics:', fetchError.message)
    return Response.json({ error: 'Failed to fetch clinics' }, { status: 500 })
  }

  let clinicsProcessed = 0
  let alertsCreated = 0

  for (const clinic of (clinics ?? []) as Array<{ id: string }>) {
    try {
      const result = await runBiForecastForClinic({ clinicId: clinic.id })
      alertsCreated += result.alertsCreated
      clinicsProcessed++
    } catch (err) {
      console.error(`[cron/bi-previsoes] Failed to run forecast for clinic ${clinic.id}:`, err)
      // Continua com a próxima clínica — uma falha não deve bloquear as demais
    }
  }

  return Response.json({ ok: true, clinics_processed: clinicsProcessed, alerts_created: alertsCreated })
}
