// src/app/(dashboard)/clinica/orcamento/page.tsx
// REP-02: Orçamento screen — 12-month editable grid per conta contábil with
// meta/realizado/desvio semáforo (D-15), past-month lock (D-13/D-18), copy-from-year
// (D-17), save (D-14), DRE cross-link (D-16) and PDF export (D-19/D-40). Server
// Component — data fetched via @/actions/budget-targets (Plan 05); access already
// RBAC-gated by proxy.ts (orcamento module, D-14 socio write).
import { Download } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { getBudgetVsRealizado } from '@/actions/budget-targets'
import { listUnits } from '@/actions/units'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import type { AccountNode } from '@/lib/financeiro/chart-tree'
import { OrcamentoFilters } from '@/components/relatorios/OrcamentoFilters'
import { BudgetGrid } from '@/components/relatorios/BudgetGrid'

interface OrcamentoPageProps {
  searchParams: Promise<{ ano?: string; unit?: string }>
}

function flattenLeafAccounts(nodes: AccountNode[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const n of nodes) {
    if (n.type !== 'grupo' && n.ativo) {
      out.push({ id: n.id, name: n.name })
    }
    if (n.children.length > 0) {
      out.push(...flattenLeafAccounts(n.children))
    }
  }
  return out
}

export default async function OrcamentoPage({ searchParams }: OrcamentoPageProps) {
  const params = await searchParams
  const currentYear = new Date().getFullYear()
  const anoParsed = params.ano ? parseInt(params.ano, 10) : NaN
  const ano = Number.isInteger(anoParsed) ? anoParsed : currentYear
  const unitId = params.unit && params.unit !== '' ? params.unit : undefined

  const [budgetResult, unitsResult, accountsResult] = await Promise.all([
    getBudgetVsRealizado({ ano, unitId }),
    listUnits(),
    listAccountsTree(),
  ])

  const units = unitsResult.success ? (unitsResult.units ?? []).map((u) => ({ id: u.id, name: u.name })) : []
  const accountOptions = accountsResult.success ? flattenLeafAccounts(accountsResult.tree ?? []) : []

  const pdfParams = new URLSearchParams({ ano: String(ano) })
  if (unitId) pdfParams.set('unit', unitId)
  const exportHref = `/api/orcamento/pdf?${pdfParams.toString()}`

  const actions = (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      <OrcamentoFilters units={units} currentAno={ano} />
      <Button variant="outline" size="sm" render={<a href="/clinica/relatorios" />}>
        Ver DRE
      </Button>
      <Button size="sm" render={<a href={exportHref} target="_blank" rel="noopener noreferrer" />}>
        <Download className="size-4" />
        Exportar PDF
      </Button>
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader title="Orçamento" breadcrumbs={[{ label: 'Orçamento' }]} actions={actions} />
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <BudgetGrid
          key={`${ano}-${unitId ?? ''}`}
          ano={ano}
          unitId={unitId}
          rows={budgetResult.success ? (budgetResult.rows ?? []) : []}
          accountOptions={accountOptions}
        />
      </div>
    </NuqsAdapter>
  )
}
