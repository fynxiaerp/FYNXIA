// src/app/(dashboard)/bi/page.tsx
// BI-01/BI-02: top-level BI dashboard — fixed "Alertas & Previsões" (D-38) above
// 4 KPI-dimension tabs (Operacional/Profissionais/CRC/Estoque-TISS, D-29) +
// "Exportar PDF" per tab (D-40). Server Component — data fetched via
// @/actions/bi-kpis / @/actions/bi-alerts (Plan 07); access already RBAC-gated
// by proxy.ts (bi module — admin/superadmin full, sócio read-only, dentist none).
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { PageHeader } from '@/components/shell/PageHeader'
import { getBiKpis } from '@/actions/bi-kpis'
import { listBiAlerts } from '@/actions/bi-alerts'
import { listUnits } from '@/actions/units'
import { createClient } from '@/lib/supabase/server'
import { BiAlertsSection } from '@/components/relatorios/BiAlertsSection'
import { BiDashboard, BiPeriodFilter } from '@/components/relatorios/BiDashboard'

interface BiPageProps {
  searchParams: Promise<{ from?: string; to?: string; unit?: string }>
}

function lastDayOfMonth(ym: string): string {
  const parts = ym.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

// ─── Insufficient-forecast-history detection (D-32) ───────────────────────────
// The nightly bi-forecast-agent silently skips forecast alerts when fewer than
// 3 monthly points of financial_transactions history exist — no dedicated
// bi_alerts row is ever written for that case (see bi-forecast-agent.ts D-32
// comment). This mirrors that same "< 3 months" rule directly against the
// earliest transaction_date, tenant-scoped via RLS + explicit tenant_id filter
// (defense-in-depth, mirrors getActor patterns in bi-kpis.ts/bi-alerts.ts).
async function loadInsufficientHistory(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: actor } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!actor) return false

  const { data } = await supabase
    .from('financial_transactions')
    .select('transaction_date')
    .eq('tenant_id', (actor as { tenant_id: string }).tenant_id)
    .order('transaction_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const earliest = (data as { transaction_date: string } | null)?.transaction_date ?? null
  if (!earliest) return true // no financial history at all → insufficient

  const [ey, em] = earliest.slice(0, 7).split('-').map(Number)
  const now = new Date()
  const monthsSince =
    (now.getUTCFullYear() - (ey ?? now.getUTCFullYear())) * 12 + (now.getUTCMonth() + 1 - (em ?? now.getUTCMonth() + 1))

  return monthsSince < 3
}

export default async function BiPage({ searchParams }: BiPageProps) {
  const params = await searchParams
  const defaultYm = new Date().toISOString().slice(0, 7)
  const from = params.from ?? `${defaultYm}-01`
  const to = params.to ?? lastDayOfMonth(defaultYm)
  const unitId = params.unit && params.unit !== '' ? params.unit : undefined

  const [kpisResult, alertsResult, unitsResult, insufficientHistory] = await Promise.all([
    getBiKpis({ from, to, unitId }),
    listBiAlerts(),
    listUnits(),
    loadInsufficientHistory(),
  ])

  const units = unitsResult.success ? (unitsResult.units ?? []).map((u) => ({ id: u.id, name: u.name })) : []

  const GENERIC_ERROR = 'Não foi possível carregar os indicadores. Tente novamente em instantes.'

  const actions = (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      <BiPeriodFilter units={units} />
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader title="BI" breadcrumbs={[{ label: 'BI' }]} actions={actions} />
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <BiAlertsSection
          alerts={alertsResult.success ? (alertsResult.alerts ?? []) : []}
          alertsError={!alertsResult.success ? (alertsResult.error ?? GENERIC_ERROR) : null}
          insufficientHistory={insufficientHistory}
        />
        <BiDashboard
          kpis={kpisResult.success ? (kpisResult.data ?? null) : null}
          kpisError={!kpisResult.success ? (kpisResult.error ?? GENERIC_ERROR) : null}
          from={from}
          to={to}
          unitId={unitId}
        />
      </div>
    </NuqsAdapter>
  )
}
