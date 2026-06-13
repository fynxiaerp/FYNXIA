// PROTÓTIPO v2 — Dashboard de Franquias (visão de rede / multi-clínica).
// Server Component. Dados 100% mock (src/lib/prototipos/mock-data.ts). Nenhum acesso a banco.
import { Building2, CalendarCheck, Gauge, AlertTriangle, Receipt, Network } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  PrototypeBanner,
  KpiCard,
  ChartCard,
  LineChart,
  BarChart,
  DeltaBadge,
} from '@/components/prototipos/charts'
import {
  FRANCHISE_UNITS,
  NETWORK_REVENUE_6M,
  MONTHS_6,
  networkKpis,
  BRL,
  pct,
} from '@/lib/prototipos/mock-data'

export default function DashboardFranquiasPage() {
  const k = networkKpis()
  const ranked = [...FRANCHISE_UNITS].sort((a, b) => b.revenue - a.revenue)

  return (
    <>
      <PageHeader
        title="Dashboard de Franquias"
        breadcrumbs={[
          { label: 'Protótipos', href: '/clinica/prototipos' },
          { label: 'Franquias' },
        ]}
        actions={
          <span className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
            Junho 2026
          </span>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <PrototypeBanner note="Visão consolidada de uma rede de clínicas — exige hierarquia tenant_groups + agregação cross-tenant no v2." />

        {/* KPIs da rede */}
        <section aria-label="Indicadores da rede">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard label="Faturamento da rede" value={BRL(k.revenue)} delta={k.revenueDelta} icon={Network} />
            <KpiCard label="Unidades ativas" value={String(k.units)} sub="6 cidades · 4 estados" icon={Building2} />
            <KpiCard label="Consultas no mês" value={k.appointments.toLocaleString('pt-BR')} icon={CalendarCheck} />
            <KpiCard label="Ocupação média" value={pct(k.occupancy)} icon={Gauge} />
            <KpiCard label="Ticket médio" value={BRL(k.ticket)} icon={Receipt} />
          </div>
        </section>

        {/* Gráficos */}
        <section aria-label="Tendências" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Faturamento da rede" description="Soma de todas as unidades — últimos 6 meses">
            <LineChart
              series={[{ label: 'Rede', data: NETWORK_REVENUE_6M, tone: 'chart-2', area: true }]}
              xLabels={MONTHS_6}
              format={(n) => BRL(n)}
              height={220}
            />
          </ChartCard>

          <ChartCard title="Faturamento por unidade" description="Mês corrente">
            <BarChart
              data={ranked.map((u) => ({ label: u.name.replace('FYNXIA ', ''), value: u.revenue }))}
              format={(n) => BRL(n)}
              tone="chart-3"
              height={220}
            />
          </ChartCard>
        </section>

        {/* Ranking de unidades */}
        <section aria-label="Desempenho por unidade">
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Desempenho por unidade</h3>
              <p className="text-sm text-muted-foreground">Ranking por faturamento no mês</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Consultas</TableHead>
                  <TableHead>Ocupação</TableHead>
                  <TableHead className="text-right">Inadimplência</TableHead>
                  <TableHead className="text-right">vs. mês ant.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((u, i) => {
                  const delta = ((u.revenue - u.prevRevenue) / u.prevRevenue) * 100
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{u.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {u.city}/{u.uf} · {u.dentists} dentistas
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{BRL(u.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{u.appointments}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${u.occupancy}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{u.occupancy}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={u.overdueRate >= 6 ? 'destructive' : 'secondary'}>
                          {pct(u.overdueRate)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DeltaBadge value={delta} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  )
}
