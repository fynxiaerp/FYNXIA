// PROTÓTIPO v2 — Convênios / Planos (TISS).
// Server Component. Dados 100% mock. Nenhum acesso a banco.
import { ShieldPlus, FileStack, Wallet, ScissorsSquare, Clock, FilePlus } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DonutChart,
} from '@/components/prototipos/charts'
import {
  INSURERS,
  TISS_GUIDES,
  insurerKpis,
  insurerSplit,
  BRL,
  pct,
  type TissStatus,
  type InsurerStatus,
} from '@/lib/prototipos/mock-data'

const TISS_STATUS: Record<TissStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  paga: { label: 'Paga', variant: 'default' },
  autorizada: { label: 'Autorizada', variant: 'secondary' },
  em_analise: { label: 'Em análise', variant: 'outline' },
  glosada: { label: 'Glosada', variant: 'destructive' },
}

const INSURER_STATUS: Record<InsurerStatus, { label: string; variant: 'secondary' | 'outline' }> = {
  ativo: { label: 'Ativo', variant: 'secondary' },
  em_negociacao: { label: 'Em negociação', variant: 'outline' },
}

export default function ConveniosPage() {
  const k = insurerKpis()

  return (
    <>
      <PageHeader
        title="Convênios / Planos"
        breadcrumbs={[{ label: 'Protótipos', href: '/clinica/prototipos' }, { label: 'Convênios' }]}
        actions={
          <Button>
            <FilePlus className="size-4" />
            Nova guia TISS
          </Button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <PrototypeBanner note="Cadastro de convênios, guias TISS e faturamento por plano + controle de glosas. No v2, integra com o padrão TISS/ANS." />

        {/* KPIs */}
        <section aria-label="Indicadores de convênios">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="Convênios ativos" value={String(k.ativos)} icon={ShieldPlus} />
            <KpiCard label="Guias no mês" value={k.guias.toLocaleString('pt-BR')} icon={FileStack} />
            <KpiCard label="Faturado (convênios)" value={BRL(k.faturado)} icon={Wallet} />
            <KpiCard label="Glosa" value={BRL(k.glosaValor)} sub={`${pct(k.glosaAvg)} média`} icon={ScissorsSquare} />
            <KpiCard label="Guias em análise" value={String(k.pendentes)} icon={Clock} />
          </div>
        </section>

        {/* Donut + tabela de convênios */}
        <section aria-label="Composição por convênio" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Faturamento por convênio" description="Mês corrente">
            <DonutChart data={insurerSplit()} format={(n) => BRL(n)} />
          </ChartCard>

          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Convênios</h3>
              <p className="text-sm text-muted-foreground">Desempenho por operadora</p>
            </div>
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
                {INSURERS.map((ins) => {
                  const st = INSURER_STATUS[ins.status]
                  return (
                    <TableRow key={ins.name}>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{ins.name}</span>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{ins.guias}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{BRL(ins.faturado)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={ins.glosaRate >= 6 ? 'text-destructive' : 'text-muted-foreground'}>
                          {pct(ins.glosaRate)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Guias TISS */}
        <section aria-label="Guias TISS recentes">
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Guias TISS recentes</h3>
              <p className="text-sm text-muted-foreground">Últimas guias emitidas</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guia</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TISS_GUIDES.map((g) => {
                  const s = TISS_STATUS[g.status]
                  return (
                    <TableRow key={g.numero}>
                      <TableCell className="font-medium tabular-nums">{g.numero}</TableCell>
                      <TableCell>{g.paciente}</TableCell>
                      <TableCell className="text-muted-foreground">{g.convenio}</TableCell>
                      <TableCell className="text-muted-foreground">{g.procedimento}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{BRL(g.valor)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={s.variant}>{s.label}</Badge>
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
