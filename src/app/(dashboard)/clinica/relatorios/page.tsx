// src/app/(dashboard)/clinica/relatorios/page.tsx
// REP-01: DRE screen — período/unidade (nuqs URL state via DreFilters), KPI row,
// consolidated per-unit ranking (D-04), DRE lines with drill-down (D-05/D-06) and
// YoY (D-11), "Exportar PDF" (D-07). Server Component — data fetched via
// @/actions/dre (Plan 04); access already RBAC-gated by proxy.ts (relatorios module).
import { Download } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { getDre, getDreByUnit, getDreYoY } from '@/actions/dre'
import { listUnits } from '@/actions/units'
import { listCostCenters } from '@/actions/cost-centers'
import { DreFilters } from '@/components/relatorios/DreFilters'
import { DreView } from '@/components/relatorios/DreView'

interface RelatoriosPageProps {
  searchParams: Promise<{ from?: string; to?: string; unit?: string }>
}

function lastDayOfMonth(ym: string): string {
  const parts = ym.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const params = await searchParams
  const defaultYm = new Date().toISOString().slice(0, 7)
  const from = params.from ?? `${defaultYm}-01`
  const to = params.to ?? lastDayOfMonth(defaultYm)
  const unitId = params.unit && params.unit !== '' ? params.unit : undefined

  const [dreResult, unitsResult, costCentersResult, yoyResult] = await Promise.all([
    getDre({ from, to, unitId }),
    listUnits(),
    listCostCenters(),
    getDreYoY({ from, to, unitId }),
  ])

  const rankingResult = !unitId ? await getDreByUnit({ from, to }) : null

  const units = unitsResult.success ? (unitsResult.units ?? []).map((u) => ({ id: u.id, name: u.name })) : []
  const costCenters = costCentersResult.success
    ? (costCentersResult.centers ?? []).map((cc) => ({ id: cc.id, name: cc.name }))
    : []

  const exportParams = new URLSearchParams({ from, to })
  if (unitId) exportParams.set('unit', unitId)
  const exportHref = `/api/relatorios/dre-pdf?${exportParams.toString()}`

  const actions = (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      <DreFilters units={units} />
      <Button size="sm" render={<a href={exportHref} target="_blank" rel="noopener noreferrer" />}>
        <Download className="size-4" />
        Exportar PDF
      </Button>
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader title="Relatórios" breadcrumbs={[{ label: 'Relatórios' }]} actions={actions} />
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <DreView
          dre={dreResult.success ? (dreResult.dre ?? null) : null}
          dreError={!dreResult.success ? (dreResult.error ?? 'Erro ao carregar o DRE') : null}
          ranking={rankingResult?.success ? (rankingResult.ranking ?? []) : []}
          showRanking={!unitId}
          yoy={yoyResult}
          from={from}
          to={to}
          unitId={unitId}
          costCenters={costCenters}
        />
      </div>
    </NuqsAdapter>
  )
}
