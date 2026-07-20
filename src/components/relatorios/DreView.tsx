'use client'
// src/components/relatorios/DreView.tsx
// REP-01: DRE screen body — KPI row, per-unit ranking (D-04), DRE lines with
// % of revenue (D-08), two-level drill-down (D-05 cost-center → D-06 transactions),
// and YoY comparison (D-11).
//
// D-05 vs D-06 (one fetch, two expansion levels): getDreDrilldown returns the raw
// financial_transactions rows for one account_id. The FIRST Accordion level groups
// those rows client-side by cost_center_id (D-06, cost-center subtotals — NULL
// cost_center_id renders under "Sem centro de custo"). The SECOND (nested) level
// lists that cost center's individual transactions (D-05). No extra server round-trip.
import { useState } from 'react'
import { DollarSign, TrendingDown, Percent, AlertCircle, RotateCcw, Wallet } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { KpiCard, DeltaBadge } from '@/components/relatorios/charts'
import { EmptyState } from '@/components/shell/EmptyState'
import {
  getDreDrilldown,
  type DreDrilldownRow,
  type DreUnitRanking,
} from '@/actions/dre'
import type { DreResult } from '@/lib/financeiro/dre-math'

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEM_CENTRO_CUSTO = 'Sem centro de custo'
const UNCLASSIFIED_CC_KEY = '__sem_cc__'

function BRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pctLabel(v: number): string {
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatTxDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR')
}

interface CostCenterGroup {
  key: string
  name: string
  total: number
  rows: DreDrilldownRow[]
}

/** D-06: group already-fetched drilldown rows by cost_center_id, client-side. */
function groupByCostCenter(
  rows: DreDrilldownRow[],
  costCenterNames: Map<string, string>
): CostCenterGroup[] {
  const groups = new Map<string, CostCenterGroup>()
  for (const row of rows) {
    const key = row.cost_center_id ?? UNCLASSIFIED_CC_KEY
    const name = row.cost_center_id
      ? (costCenterNames.get(row.cost_center_id) ?? 'Centro de custo')
      : SEM_CENTRO_CUSTO
    const existing = groups.get(key)
    if (existing) {
      existing.total += row.amount
      existing.rows.push(row)
    } else {
      groups.set(key, { key, name, total: row.amount, rows: [row] })
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.total - a.total)
}

// ─── Resultado KPI (colored by sign — primary when positive, destructive when negative) ──

function ResultadoKpiCard({ value, positive }: { value: string; positive: boolean }) {
  return (
    <Card className="gap-2">
      <div className="px-(--card-spacing) flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Resultado</span>
        <Wallet className="size-4 text-muted-foreground" />
      </div>
      <div className="px-(--card-spacing) flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-semibold font-display tabular-nums',
            positive ? 'text-primary' : 'text-destructive'
          )}
        >
          {value}
        </span>
      </div>
    </Card>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DreYoyResult {
  success: boolean
  available?: boolean
  dre?: DreResult
  resultadoDelta?: number
  error?: string
}

export interface DreViewProps {
  dre: DreResult | null
  dreError: string | null
  ranking: DreUnitRanking[]
  showRanking: boolean
  yoy: DreYoyResult
  from: string
  to: string
  unitId?: string
  costCenters: { id: string; name: string }[]
}

// ─── DreView ──────────────────────────────────────────────────────────────────

export function DreView({
  dre,
  dreError,
  ranking,
  showRanking,
  yoy,
  from,
  to,
  unitId,
  costCenters,
}: DreViewProps) {
  const [drilldowns, setDrilldowns] = useState<
    Record<string, DreDrilldownRow[] | 'loading' | 'error'>
  >({})

  const costCenterNames = new Map(costCenters.map((cc) => [cc.id, cc.name]))

  async function fetchLine(accountId: string) {
    if (accountId in drilldowns) return
    setDrilldowns((prev) => ({ ...prev, [accountId]: 'loading' }))
    const result = await getDreDrilldown({ from, to, unitId, accountId })
    setDrilldowns((prev) => ({
      ...prev,
      [accountId]: result.success ? (result.transactions ?? []) : 'error',
    }))
  }

  function handleLinesValueChange(newValue: string[]) {
    for (const id of newValue) {
      void fetchLine(id)
    }
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (dreError) {
    return (
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar o DRE. Verifique sua conexão e tente novamente."
          description=""
          cta={
            <Button size="sm" variant="outline" render={<a href="." />}>
              <RotateCcw className="size-4" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!dre || dre.lines.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="Nenhum lançamento neste período"
        description="Ajuste o período ou a unidade selecionada para visualizar o DRE."
      />
    )
  }

  const resultadoPositive = dre.resultado >= 0

  // YoY: DeltaBadge when available; "comparação indisponível" text otherwise (D-11) — never crashes.
  const priorResultado = yoy.dre?.resultado
  const yoyDeltaPct =
    yoy.success && yoy.available && yoy.resultadoDelta !== undefined && priorResultado
      ? (yoy.resultadoDelta / Math.abs(priorResultado)) * 100
      : undefined

  return (
    <div className="space-y-6">
      {/* KPI row (Faturamento/Despesa/Resultado/Margem) — Resultado is the primary anchor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Faturamento" value={BRL(dre.receitaTotal)} icon={DollarSign} />
        <KpiCard label="Despesa" value={BRL(dre.despesaTotal)} icon={TrendingDown} />
        <ResultadoKpiCard value={BRL(dre.resultado)} positive={resultadoPositive} />
        <KpiCard label="Margem" value={pctLabel(dre.margem)} icon={Percent} />
      </div>

      {/* YoY comparison (D-11) */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Comparação com mesmo período do ano anterior:
        </span>
        {yoyDeltaPct === undefined ? (
          <span className="text-xs text-muted-foreground">comparação indisponível</span>
        ) : (
          <DeltaBadge value={yoyDeltaPct} />
        )}
      </div>

      {/* Consolidated per-unit ranking (D-04) — only when unit='Todas' */}
      {showRanking && ranking.length > 0 && (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display text-xl font-semibold">Desempenho por unidade</h3>
            <p className="text-sm text-muted-foreground">Ranking por resultado no período</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesa</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((u, i) => (
                <TableRow key={u.unitId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="truncate">{u.unitName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {BRL(u.dre.receitaTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {BRL(u.dre.despesaTotal)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-semibold',
                      u.dre.resultado >= 0 ? 'text-primary' : 'text-destructive'
                    )}
                  >
                    {BRL(u.dre.resultado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {pctLabel(u.dre.margem)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* DRE lines — % of revenue (D-08) + two-level drill-down (D-05/D-06) */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display text-xl font-semibold">Demonstração de Resultado</h3>
          <p className="text-sm text-muted-foreground">
            Clique em uma linha para ver o detalhamento por centro de custo
          </p>
        </div>
        <div className="px-4 py-1">
          <Accordion multiple onValueChange={handleLinesValueChange} className="w-full">
            {dre.lines.map((line) => {
              const key = line.account_id ?? '__unclassified__'

              // "Não classificado" (NULL account_id) — no accountId to drill down with.
              if (!line.account_id) {
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm text-muted-foreground">{line.account_name}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm tabular-nums">{BRL(line.total)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        · {pctLabel(line.pctReceita)} da receita
                      </span>
                    </div>
                  </div>
                )
              }

              const drill = drilldowns[line.account_id]
              const groups = Array.isArray(drill) ? groupByCostCenter(drill, costCenterNames) : []

              return (
                <AccordionItem key={key} value={line.account_id}>
                  <AccordionTrigger>
                    <div className="flex flex-1 items-center justify-between pr-2">
                      <span className="text-sm">{line.account_name}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm tabular-nums">{BRL(line.total)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          · {pctLabel(line.pctReceita)} da receita
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {drill === 'loading' && (
                      <p className="text-xs text-muted-foreground py-2">Carregando…</p>
                    )}
                    {drill === 'error' && (
                      <p className="text-xs text-destructive py-2">
                        Erro ao carregar detalhamento.
                      </p>
                    )}
                    {Array.isArray(drill) && groups.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Nenhum lançamento.</p>
                    )}
                    {Array.isArray(drill) && groups.length > 0 && (
                      <Accordion multiple className="w-full pl-4">
                        {groups.map((g) => (
                          <AccordionItem key={g.key} value={g.key}>
                            <AccordionTrigger className="py-1.5">
                              <div className="flex flex-1 items-center justify-between pr-2">
                                <span className="text-sm text-muted-foreground">{g.name}</span>
                                <span className="text-sm tabular-nums">{BRL(g.total)}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="pl-4 space-y-1">
                                {g.rows.map((tx) => (
                                  <div
                                    key={tx.id}
                                    className="flex items-center justify-between text-xs text-muted-foreground py-1"
                                  >
                                    <span>
                                      {formatTxDate(tx.transaction_date)} · {tx.description ?? '—'}
                                    </span>
                                    <span className="tabular-nums">{BRL(tx.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
