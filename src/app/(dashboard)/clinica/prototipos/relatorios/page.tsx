// PROTÓTIPO v2 — Relatórios / BI (clínica única).
// Server Component. Dados 100% mock (src/lib/prototipos/mock-data.ts). Nenhum acesso a banco.
import { DollarSign, TrendingDown, Wallet, Percent } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PrototypeBanner,
  KpiCard,
  ChartCard,
  LineChart,
  BarChart,
  DonutChart,
} from '@/components/prototipos/charts'
import {
  REVENUE_12M,
  EXPENSE_12M,
  MONTHS_12,
  DENTIST_PRODUCTIVITY,
  PAYMENT_SPLIT,
  TOP_PROCEDURES,
  biKpis,
  BRL,
  pct,
} from '@/lib/prototipos/mock-data'

export default function RelatoriosPage() {
  const k = biKpis()

  return (
    <>
      <PageHeader
        title="Relatórios"
        breadcrumbs={[
          { label: 'Protótipos', href: '/clinica/prototipos' },
          { label: 'Relatórios' },
        ]}
        actions={
          <span className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
            Últimos 12 meses
          </span>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <PrototypeBanner note="Painéis gerenciais (faturamento, produtividade, inadimplência). No v2, alimentados pelos dados financeiros e de agenda já existentes." />

        {/* KPIs */}
        <section aria-label="Indicadores do mês">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Faturamento (mês)" value={BRL(k.revenue)} delta={k.revenueDelta} icon={DollarSign} />
            <KpiCard label="Despesas (mês)" value={BRL(k.expense)} icon={TrendingDown} />
            <KpiCard label="Lucro" value={BRL(k.profit)} icon={Wallet} />
            <KpiCard label="Margem" value={pct(k.margin)} icon={Percent} />
          </div>
        </section>

        {/* Receita x Despesa */}
        <section aria-label="Receita e despesa">
          <ChartCard title="Receita × Despesa" description="Evolução mensal — últimos 12 meses">
            <LineChart
              series={[
                { label: 'Receita', data: REVENUE_12M, tone: 'chart-2', area: true },
                { label: 'Despesa', data: EXPENSE_12M, tone: 'chart-5' },
              ]}
              xLabels={MONTHS_12}
              format={(n) => BRL(n)}
              height={240}
            />
          </ChartCard>
        </section>

        {/* Pagamentos + produtividade */}
        <section aria-label="Composição" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Formas de pagamento" description="Distribuição do faturamento do mês">
            <DonutChart data={PAYMENT_SPLIT} format={(n) => BRL(n)} />
          </ChartCard>

          <ChartCard title="Produtividade por dentista" description="Faturamento gerado no mês">
            <BarChart
              data={DENTIST_PRODUCTIVITY.map((d) => ({
                label: d.name.replace('Dra. ', '').replace('Dr. ', '').split(' ')[0] ?? d.name,
                value: d.revenue,
              }))}
              format={(n) => BRL(n)}
              tone="chart-3"
              height={200}
            />
          </ChartCard>
        </section>

        {/* Top procedimentos */}
        <section aria-label="Procedimentos">
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Top procedimentos</h3>
              <p className="text-sm text-muted-foreground">Por faturamento no mês</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Qtde.</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...TOP_PROCEDURES]
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{BRL(p.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {BRL(p.revenue / p.count)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  )
}
