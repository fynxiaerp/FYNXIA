// PROTÓTIPO v2 — NFSe Fiscal (nota de serviço odontológica).
// Server Component. Dados 100% mock. Nenhum acesso a banco. Formulário é visual (sem submit).
import { FileText, FileCheck2, Landmark, Clock, FilePlus } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  BarChart,
} from '@/components/prototipos/charts'
import {
  NFSE_ROWS,
  NFSE_ISSUED_6M,
  MONTHS_6,
  nfseKpis,
  ISS_RATE,
  BRL,
  pct,
  type NfseStatus,
} from '@/lib/prototipos/mock-data'

const STATUS: Record<NfseStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  emitida: { label: 'Emitida', variant: 'default' },
  processando: { label: 'Processando', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'outline' },
  erro: { label: 'Erro', variant: 'destructive' },
}

export default function NfsePage() {
  const k = nfseKpis()
  const exemploValor = 1200
  const exemploIss = exemploValor * ISS_RATE

  return (
    <>
      <PageHeader
        title="NFSe Fiscal"
        breadcrumbs={[{ label: 'Protótipos', href: '/clinica/prototipos' }, { label: 'NFSe' }]}
        actions={
          <Button>
            <FilePlus className="size-4" />
            Emitir NFSe
          </Button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <PrototypeBanner note="Emissão de nota de serviço odontológica + histórico. No v2, integra com o provedor municipal (ou Tecnospeed) a partir dos pagamentos já registrados." />

        {/* KPIs */}
        <section aria-label="Indicadores fiscais">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Notas emitidas (mês)" value={String(k.mesCount)} icon={FileCheck2} />
            <KpiCard label="Valor emitido" value={BRL(k.valor)} icon={FileText} />
            <KpiCard label={`ISS (${pct(ISS_RATE * 100)})`} value={BRL(k.iss)} sub="Retido sobre serviços" icon={Landmark} />
            <KpiCard label="Pendentes / erro" value={String(k.pendentes)} icon={Clock} />
          </div>
        </section>

        {/* Emissão por mês + formulário visual */}
        <section aria-label="Emissão" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Notas emitidas" description="Últimos 6 meses">
            <BarChart
              data={NFSE_ISSUED_6M.map((v, i) => ({ label: MONTHS_6[i] ?? '', value: v }))}
              format={(n) => String(n)}
              tone="chart-2"
              height={220}
            />
          </ChartCard>

          <ChartCard title="Emitir NFSe" description="Pré-visualização (protótipo — sem envio)">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-tomador">Tomador (paciente)</Label>
                  <Input id="p-tomador" defaultValue="Marina Alves" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-servico">Serviço</Label>
                  <Input id="p-servico" defaultValue="Tratamento de canal" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-valor">Valor bruto</Label>
                  <Input id="p-valor" defaultValue="R$ 1.200,00" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-iss">Alíquota ISS</Label>
                  <Input id="p-iss" defaultValue={pct(ISS_RATE * 100)} disabled />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>ISS retido</span>
                  <span className="tabular-nums">{BRL(exemploIss)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span>Valor líquido</span>
                  <span className="tabular-nums">{BRL(exemploValor - exemploIss)}</span>
                </div>
              </div>

              <Button disabled className="w-full">
                <FilePlus className="size-4" />
                Emitir nota (desativado no protótipo)
              </Button>
            </div>
          </ChartCard>
        </section>

        {/* Histórico */}
        <section aria-label="Histórico de notas">
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display text-base font-semibold">Histórico de notas</h3>
              <p className="text-sm text-muted-foreground">Notas de serviço recentes</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NFSE_ROWS.map((r) => {
                  const s = STATUS[r.status]
                  return (
                    <TableRow key={r.numero}>
                      <TableCell className="font-medium tabular-nums">{r.numero}</TableCell>
                      <TableCell>{r.tomador}</TableCell>
                      <TableCell className="text-muted-foreground">{r.servico}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.data}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{BRL(r.valor)}</TableCell>
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
