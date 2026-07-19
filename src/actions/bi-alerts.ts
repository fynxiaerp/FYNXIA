'use server'
/**
 * src/actions/bi-alerts.ts — read active bi_alerts for the BI panel (BI-01, Plan 19-07).
 *
 * bi_alerts rows are produced by the nightly forecast/alert cron + bi-forecast-agent
 * (Plan 08) — this plan only READS. Zero authenticated write policy on bi_alerts
 * (mirrors stock_alerts/nps_responses, T-19-06) — writes exclusively via service role.
 *
 * SECURITY (T-19-01):
 *   Gated to admin/socio/superadmin (D-39), matching KPI_READ_ROLES in kpi-targets.ts /
 *   getBiKpis in bi-kpis.ts — defense-in-depth alongside bi_alerts RLS.
 *
 * approval_request_id present ⇒ the "Alertas & Previsões" panel (Plan 13) renders the
 * "Revisar sugestão" link into ApprovalInbox (D-35) — set only when the alert resulted
 * in a concrete action (budget adjustment suggestion), never for purely informative alerts.
 */
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

type Actor = {
  id: string
  tenant_id: string
  role: string
}

export const BI_ALERT_READ_ROLES = ['admin', 'socio', 'superadmin'] as const

// ─── Helper: get authenticated actor (replicated from transactions.ts) ──────

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

// ─── listBiAlerts ─────────────────────────────────────────────────────────────
// D-35/D-38: active alerts for the panel's fixed "Alertas & Previsões" section,
// newest first.

export interface BiAlertRow {
  id: string
  kpiKey: string
  severity: string
  triggerType: string
  narrative: string | null
  projectedValue: number | null
  actualValue: number | null
  approvalRequestId: string | null
  createdAt: string
}

export async function listBiAlerts(): Promise<{
  success: boolean
  alerts?: BiAlertRow[]
  error?: string
}> {
  const actorResult = await getActor()
  if ('error' in actorResult) {
    return { success: false, error: actorResult.error }
  }
  const { actor } = actorResult

  if (!(BI_ALERT_READ_ROLES as readonly string[]).includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para acessar o BI' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bi_alerts')
    .select(
      'id, kpi_key, severity, trigger_type, narrative, projected_value, actual_value, approval_request_id, created_at'
    )
    .eq('clinic_id', actor.tenant_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const alerts: BiAlertRow[] = (
    (data ?? []) as Array<{
      id: string
      kpi_key: string
      severity: string
      trigger_type: string
      narrative: string | null
      projected_value: number | null
      actual_value: number | null
      approval_request_id: string | null
      created_at: string
    }>
  ).map((row) => ({
    id: row.id,
    kpiKey: row.kpi_key,
    severity: row.severity,
    triggerType: row.trigger_type,
    narrative: row.narrative,
    projectedValue: row.projected_value,
    actualValue: row.actual_value,
    approvalRequestId: row.approval_request_id,
    createdAt: row.created_at,
  }))

  return { success: true, alerts }
}
