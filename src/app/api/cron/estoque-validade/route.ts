/**
 * GET /api/cron/estoque-validade
 *
 * Vercel Cron endpoint — roda semanalmente (segunda-feira 05:00) e varre
 * product_batches com data_validade <= hoje + 30 dias, inserindo um stock_alert
 * tipo='validade' por lote via insertStockAlert (idempotente por dia — EST-03/D-16).
 *
 * D-16: validade NÃO dispara o agente de compras — vencimento é descarte, não
 * reposição. Este cron apenas gera alertas na UI (banner/dashboard de estoque).
 *
 * SECURITY (mirrors /api/cron/recorrente):
 * - isCronAuthorized valida Authorization: Bearer {CRON_SECRET} — 401 fail-closed
 *   antes de qualquer query.
 *
 * RUNTIME: Node.js — Edge não tem módulo 'net' para conexões TCP do Supabase.
 * CROSS-TENANT: createAdminClient (service role) — stock_alerts não tem policy de
 * escrita para authenticated (T-17-04), apenas leitura.
 */

// CRITICAL: Node.js runtime required (Edge has no 'net' module for Supabase TCP)
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { insertStockAlert } from '@/lib/agents/stock-agent'

export async function GET(request: Request) {
  // ── CRON_SECRET validation (fail-closed) ──────────────────────────────────
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // ── Threshold: hoje + 30 dias (D-16) ──────────────────────────────────────
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + 30)
  const thresholdISO = threshold.toISOString().slice(0, 10)

  // ── Buscar lotes com validade <= threshold, saldo > 0, não deletados ──────
  const { data: batches, error: fetchError } = await admin
    .from('product_batches')
    .select('id, product_id, clinic_id, unit_id, data_validade, saldo_disponivel')
    .lte('data_validade', thresholdISO)
    .not('data_validade', 'is', null)
    .gt('saldo_disponivel', 0)
    .is('deleted_at', null)

  if (fetchError) {
    console.error('[cron/estoque-validade] Failed to fetch product_batches:', fetchError.message)
    return Response.json({ error: 'Failed to fetch product_batches' }, { status: 500 })
  }

  let alertasCriados = 0

  for (const batch of batches ?? []) {
    try {
      // Idempotente por dia via checagem interna (insertStockAlert) +
      // uq_stock_alerts_daily como backstop atômico no banco.
      await insertStockAlert(batch.clinic_id, batch.unit_id, batch.product_id, 'validade', batch.id)
      alertasCriados++
    } catch (err) {
      console.error(`[cron/estoque-validade] Failed to insert alert for batch ${batch.id}:`, err)
      // Continua com o próximo lote — uma falha não deve bloquear os demais
    }
  }

  return Response.json({ ok: true, alertas_criados: alertasCriados })
}
