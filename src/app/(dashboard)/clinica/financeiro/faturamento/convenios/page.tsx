import { Suspense } from 'react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilePlus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConveniosKpiRow } from '@/components/financeiro/ConveniosKpiRow'
import { TissGuidesTable } from '@/components/financeiro/TissGuidesTable'
import { DonutChart, ChartCard } from '@/components/prototipos/charts'
import { getGuias } from '@/actions/tiss'
import { listInsurers } from '@/actions/insurers'
import { formatBRL } from '@/lib/format/money'
import { FecharLoteButton } from './FecharLoteButton'

// Operadora status badge contract per UI-SPEC
const INSURER_STATUS: Record<string, { label: string; variant: 'secondary' | 'outline' }> = {
  ativo: { label: 'Ativo', variant: 'secondary' },
  em_negociacao: { label: 'Em negociação', variant: 'outline' },
  inativo: { label: 'Inativo', variant: 'outline' },
}

function pct(n: number) {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

interface PageProps {
  searchParams: Promise<{ month?: string; status?: string; operadora?: string }>
}

export default async function ConveniosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const month = params.month
  const statusFilter = params.status
  const insurerId = params.operadora

  const [guiasResult, insurersResult] = await Promise.all([
    getGuias({ insurerId, status: statusFilter, month }),
    listInsurers({ ativo: true }),
  ])

  const guides = guiasResult.guides ?? []
  const insurers = insurersResult.insurers ?? []

  // Compute KPIs from live data
  const ativos = insurers.filter((i) => i.ativo).length
  const guiasMes = guides.length
  const faturado = guides.reduce((s, g) => s + g.valor_total, 0)
  const glosaValor = guides.reduce((s, g) => s + g.valor_glosado, 0)
  const glosaAvg = faturado > 0 ? (glosaValor / faturado) * 100 : 0
  const pendentes = guides.filter((g) => g.status === 'em_analise').length

  // Donut chart data: faturado per insurer
  const insurerTotals: Record<string, number> = {}
  for (const g of guides) {
    if (g.insurer_name) {
      insurerTotals[g.insurer_name] = (insurerTotals[g.insurer_name] ?? 0) + g.valor_total
    }
  }
  const TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const
  const donutData = Object.entries(insurerTotals).map(([label, value], i) => ({
    label,
    value,
    tone: TONES[i % TONES.length]!,
  }))

  // Per-operadora summary for right panel
  type InsurerSummary = {
    id: string
    name: string
    status: string
    guias: number
    faturado: number
    glosaRate: number
  }
  const summaryMap: Record<string, InsurerSummary> = {}
  for (const ins of insurers) {
    summaryMap[ins.id] = {
      id: ins.id,
      name: ins.name,
      status: ins.status,
      guias: 0,
      faturado: 0,
      glosaRate: 0,
    }
  }
  for (const g of guides) {
    // find insurer by name match (guides carry insurer_name not id in current shape)
    const ins = insurers.find((i) => i.name === g.insurer_name)
    if (ins && summaryMap[ins.id]) {
      summaryMap[ins.id]!.guias += 1
      summaryMap[ins.id]!.faturado += g.valor_total
    }
  }
  // Compute glosa rate per insurer
  for (const g of guides) {
    const ins = insurers.find((i) => i.name === g.insurer_name)
    if (ins && summaryMap[ins.id] && summaryMap[ins.id]!.faturado > 0) {
      summaryMap[ins.id]!.glosaRate =
        (guides
          .filter((gg) => gg.insurer_name === ins.name)
          .reduce((s, gg) => s + gg.valor_glosado, 0) /
          summaryMap[ins.id]!.faturado) *
        100
    }
  }
  const insurerSummary = Object.values(summaryMap)

  return (
    <>
      <PageHeader
        title="Convênios / Planos"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'Convênios' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <FecharLoteButton insurers={insurers} />
            <Button>
              <FilePlus className="size-4" />
              Nova guia TISS
            </Button>
          </div>
        }
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI row — 5 cards */}
        <section aria-label="Indicadores de convênios">
          <Suspense fallback={<div className="h-[72px] animate-pulse rounded-xl bg-muted" />}>
            <ConveniosKpiRow
              ativos={ativos}
              guias={guiasMes}
              faturado={faturado}
              glosaValor={glosaValor}
              glosaAvg={glosaAvg}
              pendentes={pendentes}
            />
          </Suspense>
        </section>

        {/* Donut + operadoras summary table */}
        <section
          aria-label="Composição por convênio"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <ChartCard title="Faturamento por convênio" description="Mês corrente">
            {donutData.length > 0 ? (
              <DonutChart data={donutData} format={(n) => formatBRL(n)} />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </ChartCard>

          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Convênios</h3>
              <p className="text-sm text-muted-foreground">Desempenho por operadora</p>
            </div>
            {insurerSummary.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma operadora cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convênio</TableHead>
                    <TableHead className="text-right">Guias</TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Glosa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insurerSummary.map((ins) => {
                    const st =
                      INSURER_STATUS[ins.status] ?? { label: ins.status, variant: 'outline' as const }
                    return (
                      <TableRow key={ins.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{ins.name}</span>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {ins.guias}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatBRL(ins.faturado)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {/* Glosa rate threshold: >= 6% → text-destructive */}
                          <span
                            className={
                              ins.glosaRate >= 6 ? 'text-destructive' : 'text-muted-foreground'
                            }
                          >
                            {pct(ins.glosaRate)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Full-width TISS guides table */}
        <section aria-label="Guias TISS recentes">
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Guias TISS recentes</h3>
              <p className="text-sm text-muted-foreground">Últimas guias emitidas</p>
            </div>
            <TissGuidesTable guides={guides} />
          </div>
        </section>
      </main>
    </>
  )
}
