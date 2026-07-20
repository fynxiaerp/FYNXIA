'use client'
// src/components/relatorios/BiDashboard.tsx
// BI-01 (Plan 19-13): 4 KPI-dimension tabs (Operacional | Profissionais | CRC |
// Estoque/TISS), each with a meta×realizado KPI row (D-29/D-38) + "Exportar PDF"
// per tab (D-40). Consumes Plan 07's getBiKpis shape as-is — no client-side
// forecasting, purely presentational formatting.
//
// Deviation (Rule 2, D-40 precedence): 19-13-PLAN.md's Task 1 <action> text
// describes the PageHeader actions slot as "período/unit selector + Exportar
// PDF", but 19-UI-SPEC.md's Copywriting Contract and this plan's own must_haves
// truths state "Exportar PDF" is per-tab, not a single global button. The
// authoritative UI-SPEC wins: the header only carries BiPeriodFilter; each
// TabsContent below ships its own dimension-scoped "Exportar PDF" link.
//
// Deviation (Rule 2): not declared as a separate file in Task 1's <files> list —
// BiPeriodFilter (client, nuqs) is exported from this already-'use client' module
// instead of a new file, mirroring the D-317 SocietarioPeriodFilter precedent.
import { useQueryState } from 'nuqs'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { KpiCard, ChartCard, BarChart, OccupancyBar } from '@/components/relatorios/charts'
import type { BiKpis, KpiValue, ProfessionalKpiRow } from '@/actions/bi-kpis'

// ─── Format helpers (per-key, mirrors bi-kpis.ts's kpi_key vocabulary) ────────

const PERCENT_KEYS = new Set(['ocupacao', 'glosa_taxa', 'conversao_leads'])
const BRL_KEYS = new Set(['ticket_medio', 'cpl', 'cac'])

function formatKpiValue(key: string, value: number | null): string {
  if (value === null) return '—'
  if (PERCENT_KEYS.has(key)) return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  if (BRL_KEYS.has(key)) return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (key === 'nps') return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return value.toLocaleString('pt-BR')
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── KpiCard wrapper — meta×realizado (D-29/D-38) ─────────────────────────────

function KpiValueCard({ kpi }: { kpi: KpiValue }) {
  const delta = kpi.atingimento !== null ? Math.round((kpi.atingimento - 1) * 1000) / 10 : undefined
  const sub = kpi.meta !== null ? `Meta: ${formatKpiValue(kpi.key, kpi.meta)}` : undefined
  return (
    <KpiCard label={kpi.label} value={formatKpiValue(kpi.key, kpi.valor)} delta={delta} sub={sub} />
  )
}

// ─── Per-tab "Exportar PDF" (D-40) ─────────────────────────────────────────────

function ExportTabButton({
  dimension,
  from,
  to,
  unitId,
}: {
  dimension: string
  from: string
  to: string
  unitId?: string
}) {
  const params = new URLSearchParams({ from, to, dimension })
  if (unitId) params.set('unit', unitId)
  const href = `/api/bi/pdf?${params.toString()}`
  return (
    <Button
      variant="outline"
      size="sm"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <Download className="size-4" />
      Exportar PDF
    </Button>
  )
}

function TabHeader({
  title,
  dimension,
  from,
  to,
  unitId,
}: {
  title: string
  dimension: string
  from: string
  to: string
  unitId?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <ExportTabButton dimension={dimension} from={from} to={to} unitId={unitId} />
    </div>
  )
}

// ─── Profissionais tab body (no kpi_targets meta exists for this dimension —
// aggregate totals shown without DeltaBadge/meta sub, plus a BarChart) ────────

function ProfissionaisBody({ rows }: { rows: ProfessionalKpiRow[] }) {
  const totalFaturamento = rows.reduce((sum, r) => sum + r.faturamento, 0)
  const totalProcedimentos = rows.reduce((sum, r) => sum + r.procedimentos, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Faturamento por profissionais" value={formatBRL(totalFaturamento)} />
        <KpiCard label="Procedimentos realizados" value={totalProcedimentos.toLocaleString('pt-BR')} />
        <KpiCard label="Dentistas com faturamento" value={rows.length.toLocaleString('pt-BR')} />
      </div>

      <ChartCard title="Faturamento por dentista">
        {rows.length > 0 ? (
          <BarChart data={rows.map((r) => ({ label: r.nome, value: r.faturamento }))} format={formatBRL} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum faturamento por profissional no período.</p>
        )}
      </ChartCard>
    </div>
  )
}

// ─── BiDashboard ────────────────────────────────────────────────────────────────

export interface BiDashboardProps {
  kpis: BiKpis | null
  kpisError: string | null
  from: string
  to: string
  unitId?: string
}

export function BiDashboard({ kpis, kpisError, from, to, unitId }: BiDashboardProps) {
  if (kpisError || !kpis) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {kpisError ?? 'Não foi possível carregar os indicadores. Tente novamente em instantes.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Tabs defaultValue="operacional">
      <TabsList>
        <TabsTrigger value="operacional">Operacional</TabsTrigger>
        <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
        <TabsTrigger value="crc">CRC</TabsTrigger>
        <TabsTrigger value="estoque_tiss">Estoque/TISS</TabsTrigger>
      </TabsList>

      <TabsContent value="operacional" className="mt-4 space-y-4">
        <TabHeader title="Operacional" dimension="operacional" from={from} to={to} unitId={unitId} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiValueCard kpi={kpis.operacional.ocupacao} />
          <KpiValueCard kpi={kpis.operacional.ticket_medio} />
          <KpiValueCard kpi={kpis.operacional.consultas_mes} />
        </div>
        <ChartCard title="Ocupação da agenda" description={kpis.operacional.ocupacao.label}>
          <div className="flex items-center gap-3">
            <OccupancyBar value={kpis.operacional.ocupacao.valor ?? 0} />
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatKpiValue('ocupacao', kpis.operacional.ocupacao.valor)}
            </span>
          </div>
        </ChartCard>
      </TabsContent>

      <TabsContent value="profissionais" className="mt-4 space-y-4">
        <TabHeader title="Profissionais" dimension="profissionais" from={from} to={to} unitId={unitId} />
        <ProfissionaisBody rows={kpis.profissionais} />
      </TabsContent>

      <TabsContent value="crc" className="mt-4 space-y-4">
        <TabHeader title="CRC" dimension="crc" from={from} to={to} unitId={unitId} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiValueCard kpi={kpis.crc.nps} />
          <KpiValueCard kpi={kpis.crc.cpl} />
          <KpiValueCard kpi={kpis.crc.cac} />
          <KpiValueCard kpi={kpis.crc.conversao_leads} />
        </div>
      </TabsContent>

      <TabsContent value="estoque_tiss" className="mt-4 space-y-4">
        <TabHeader title="Estoque/TISS" dimension="estoque_tiss" from={from} to={to} unitId={unitId} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiValueCard kpi={kpis.estoque_tiss.alertas_minimo} />
          <KpiValueCard kpi={kpis.estoque_tiss.glosa_taxa} />
          <KpiValueCard kpi={kpis.estoque_tiss.atraso_pagamento} />
        </div>
      </TabsContent>
    </Tabs>
  )
}

// ─── BiPeriodFilter — período (mês) + unidade selector for the PageHeader ─────

interface UnitOption {
  id: string
  name: string
}

function lastDayOfMonth(ym: string): string {
  const parts = ym.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function BiPeriodFilter({ units }: { units: UnitOption[] }) {
  const defaultYm = currentYearMonth()
  const [from, setFrom] = useQueryState('from', { defaultValue: `${defaultYm}-01` })
  const [, setTo] = useQueryState('to', { defaultValue: lastDayOfMonth(defaultYm) })
  const [unit, setUnit] = useQueryState('unit', { defaultValue: '' })

  function handleMonthChange(value: string) {
    if (!value) return
    void setFrom(`${value}-01`)
    void setTo(lastDayOfMonth(value))
  }

  function handleUnitChange(value: string | null) {
    void setUnit(!value || value === 'all' ? '' : value)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <input
        type="month"
        defaultValue={from.slice(0, 7)}
        onChange={(e) => handleMonthChange(e.target.value)}
        aria-label="Selecionar mês"
        className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {units.length > 0 && (
        <Select value={unit || 'all'} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
