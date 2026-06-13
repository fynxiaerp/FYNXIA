// Lightweight, dependency-free chart + KPI primitives for the v2 PROTOTYPES.
// Pure SVG/CSS on design tokens (chart-1..5, primary, etc.) — themeable in light & dark.
// No hooks → safe in Server or Client Components. NOT production charting (no a11y table fallback,
// no axis ticks library) — these exist only to make the prototype screens feel real.
import * as React from 'react'
import { TrendingUp, TrendingDown, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

// Static class maps so Tailwind can see every class at build time.
const STROKE: Record<string, string> = {
  'chart-1': 'stroke-chart-1', 'chart-2': 'stroke-chart-2', 'chart-3': 'stroke-chart-3',
  'chart-4': 'stroke-chart-4', 'chart-5': 'stroke-chart-5', primary: 'stroke-primary',
}
const FILL: Record<string, string> = {
  'chart-1': 'fill-chart-1', 'chart-2': 'fill-chart-2', 'chart-3': 'fill-chart-3',
  'chart-4': 'fill-chart-4', 'chart-5': 'fill-chart-5', primary: 'fill-primary',
}
const BG: Record<string, string> = {
  'chart-1': 'bg-chart-1', 'chart-2': 'bg-chart-2', 'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4', 'chart-5': 'bg-chart-5', primary: 'bg-primary',
}

// ───────────────────────────── Prototype banner ─────────────────────────────

export function PrototypeBanner({ note }: { note?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-primary/40 bg-accent/40 px-4 py-3">
      <FlaskConical className="size-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Protótipo</span> — tela de exploração para o
        v2. {note ?? 'Todos os números são fictícios e não vêm do banco de dados.'}
      </p>
    </div>
  )
}

// ───────────────────────────── Delta badge ─────────────────────────────

export function DeltaBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
        up ? 'text-primary' : 'text-destructive'
      )}
    >
      <Icon className="size-3.5" />
      {up ? '+' : ''}
      {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      {suffix}
    </span>
  )
}

// ───────────────────────────── KPI card ─────────────────────────────

export function KpiCard({
  label,
  value,
  delta,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  delta?: number
  sub?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="gap-2">
      <div className="px-(--card-spacing) flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className="px-(--card-spacing) flex items-baseline gap-2">
        <span className="text-2xl font-semibold font-display tabular-nums">{value}</span>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      {sub && <p className="px-(--card-spacing) text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ───────────────────────────── Bar chart (vertical) ─────────────────────────────

export function BarChart({
  data,
  format = (n) => String(n),
  tone = 'primary',
  height = 200,
}: {
  data: { label: string; value: number }[]
  format?: (n: number) => string
  tone?: string
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex h-full items-end gap-3">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2 min-w-0">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {format(d.value)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn('w-full rounded-t-md transition-all', BG[tone] ?? 'bg-primary')}
                style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
                title={`${d.label}: ${format(d.value)}`}
              />
            </div>
            <span className="w-full truncate text-center text-xs text-muted-foreground" title={d.label}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────── Line chart (multi-series + area) ─────────────────────────────

interface Series {
  label: string
  data: number[]
  tone: string
  area?: boolean
}

export function LineChart({
  series,
  xLabels,
  format = (n) => String(n),
  height = 240,
}: {
  series: Series[]
  xLabels: string[]
  format?: (n: number) => string
  height?: number
}) {
  const W = 600
  const H = 200
  const pad = 8
  const max = Math.max(...series.flatMap((s) => s.data), 1)
  const n = xLabels.length

  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(n - 1, 1)
  const y = (v: number) => pad + (1 - v / max) * (H - pad * 2)

  const linePath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  const areaPath = (data: number[]) =>
    `${linePath(data)} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`

  const gridY = [0, 0.5, 1]

  return (
    <div className="w-full">
      <div className="flex gap-3">
        {/* Y axis labels */}
        <div className="flex flex-col justify-between py-1 text-right text-xs tabular-nums text-muted-foreground" style={{ height }}>
          <span>{format(max)}</span>
          <span>{format(max / 2)}</span>
          <span>{format(0)}</span>
        </div>

        {/* Plot */}
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            width="100%"
            height={height}
            role="img"
            aria-label="Gráfico de linhas (protótipo)"
          >
            {gridY.map((g) => (
              <line
                key={g}
                x1={pad}
                x2={W - pad}
                y1={pad + g * (H - pad * 2)}
                y2={pad + g * (H - pad * 2)}
                className="stroke-border"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map(
              (s) =>
                s.area && (
                  <path
                    key={`a-${s.label}`}
                    d={areaPath(s.data)}
                    className={cn(FILL[s.tone] ?? 'fill-primary', 'opacity-10')}
                    stroke="none"
                  />
                )
            )}
            {series.map((s) => (
              <path
                key={`l-${s.label}`}
                d={linePath(s.data)}
                className={cn(STROKE[s.tone] ?? 'stroke-primary', 'fill-none')}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* X axis labels */}
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            {xLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 pl-12">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('size-2.5 rounded-full', BG[s.tone] ?? 'bg-primary')} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────── Donut chart + legend ─────────────────────────────

export function DonutChart({
  data,
  format = (n) => String(n),
  size = 160,
}: {
  data: { label: string; value: number; tone: string }[]
  format?: (n: number) => string
  size?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 56
  const C = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" width={size} height={size} className="-rotate-90">
          <circle cx="80" cy="80" r={r} className="stroke-muted fill-none" strokeWidth={18} />
          {data.map((d) => {
            const len = (d.value / total) * C
            const seg = (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={r}
                className={cn(STROKE[d.tone] ?? 'stroke-primary', 'fill-none')}
                strokeWidth={18}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
              />
            )
            acc += len
            return seg
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold font-display tabular-nums">{format(total)}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2 min-w-[180px]">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className={cn('size-2.5 rounded-full shrink-0', BG[d.tone] ?? 'bg-primary')} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0 tabular-nums">
              <span className="font-medium">{format(d.value)}</span>
              <span className="text-xs text-muted-foreground">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ───────────────────────────── Section card wrapper ─────────────────────────────

export function ChartCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="gap-4">
      <div className="px-(--card-spacing) flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-(--card-spacing)">{children}</div>
    </Card>
  )
}
