// src/app/(dashboard)/clinica/estoque/page.tsx
// Dashboard de Alertas de Estoque — RSC (EST-03).
// D-23: estoque é por unidade — usa a unidade padrão (primeira retornada por
// listUnits, ordenada is_default DESC) para calcular saldo/alertas/movimentações.
// Read-only: nenhuma ação de escrita nesta tela (UI-SPEC §1 "Header actions: Nenhum").

import { CheckCircle2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { listUnits } from '@/actions/units'
import { getAlertCounts } from '@/actions/stock-alerts'
import { listStockDraws } from '@/actions/stock-draws'
import { listStockEntries } from '@/actions/stock-entries'
import { StockAlertBanner } from '@/components/estoque/StockAlertBanner'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Movimentacao = {
  id: string
  tipo: 'entrada' | 'baixa'
  produto: string
  qtd: number
  created_at: string
}

export default async function EstoqueDashboardPage() {
  const unitsResult = await listUnits()
  const units = unitsResult.success ? (unitsResult.units ?? []) : []
  const unitId = units[0]?.id

  const [counts, drawsResult, entriesResult] = await Promise.all([
    getAlertCounts(unitId),
    listStockDraws(unitId ? { unitId } : undefined),
    listStockEntries(),
  ])

  const draws = drawsResult.success ? (drawsResult.data ?? []) : []
  const entries = entriesResult.success ? (entriesResult.data ?? []) : []

  const movimentacoes: Movimentacao[] = [
    ...draws.map((d) => ({
      id: `draw-${d.id}`,
      tipo: 'baixa' as const,
      produto: d.product_name,
      qtd: d.qtd,
      created_at: d.created_at,
    })),
    ...entries.map((e) => ({
      id: `entry-${e.id}`,
      tipo: 'entrada' as const,
      produto: e.product_name,
      qtd: e.qtd,
      created_at: e.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  const hasAlerts = counts.minimo > 0 || counts.validade > 0 || counts.negativo > 0

  return (
    <>
      <PageHeader title="Estoque" breadcrumbs={[{ label: 'Estoque' }]} />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Banner de alertas — Empty state: "Estoque sob controle" quando não há alertas */}
        {hasAlerts ? (
          <StockAlertBanner counts={counts} />
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <CheckCircle2 className="size-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold font-display">Estoque sob controle</p>
              <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="min-h-[72px]" aria-label={`Alertas de Mínimo: ${counts.minimo}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Alertas de Mínimo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-amber-600">
                {counts.minimo}
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[72px]" aria-label={`Próximos do Vencimento: ${counts.validade}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Próximos do Vencimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-orange-600">
                {counts.validade}
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[72px]" aria-label={`Saldo Negativo: ${counts.negativo}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Saldo Negativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-red-600">
                {counts.negativo}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Movimentações Recentes — últimas 10 (entradas + baixas), sem paginação */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold font-display">Movimentações Recentes</h2>

          {movimentacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        {m.tipo === 'entrada' ? (
                          <ArrowDownCircle className="size-4 text-green-600" aria-label="Entrada" />
                        ) : (
                          <ArrowUpCircle className="size-4 text-amber-600" aria-label="Baixa" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{m.produto}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{m.qtd}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {format(parseISO(m.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
