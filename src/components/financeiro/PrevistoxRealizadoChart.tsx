'use client'

// PrevistoxRealizadoChart — Previsto × Realizado comparison view.
// Two-column card layout: Previsto (pendente) vs Realizado (baixado+conciliado).
// Each column shows Entradas/Saídas/Saldo (3-card pattern like CashFlowTotals).
// Consumes cashFlowPrevistoVsRealizado data passed as prop (FOP-03/D-08).

import { formatBRL } from '@/lib/format/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashFlowBucket {
  entradas: number
  saidas: number
}

interface PrevistoxRealizadoChartProps {
  data: {
    success: boolean
    previsto?: CashFlowBucket
    realizado?: CashFlowBucket
    baixadoNaoConciliado?: CashFlowBucket
    error?: string
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saldo(bucket: CashFlowBucket): number {
  return bucket.entradas - bucket.saidas
}

// ─── BucketCard ───────────────────────────────────────────────────────────────

function BucketCard({
  title,
  bucket,
}: {
  title: string
  bucket: CashFlowBucket
}) {
  const s = saldo(bucket)
  const saldoNeg = s < 0

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Entradas */}
        <Card className="min-h-[72px]" aria-label={`Entradas ${title}: ${formatBRL(bucket.entradas)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold leading-tight tabular-nums text-green-700">
              {formatBRL(bucket.entradas)}
            </p>
          </CardContent>
        </Card>

        {/* Saídas */}
        <Card className="min-h-[72px]" aria-label={`Saídas ${title}: ${formatBRL(bucket.saidas)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold leading-tight tabular-nums text-red-600">
              {bucket.saidas > 0 ? `−${formatBRL(bucket.saidas)}` : formatBRL(bucket.saidas)}
            </p>
          </CardContent>
        </Card>

        {/* Saldo */}
        <Card className="min-h-[72px]" aria-label={`Saldo ${title}: ${formatBRL(s)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold leading-tight tabular-nums ${
                saldoNeg ? 'text-red-600' : 'text-foreground'
              }`}
            >
              {saldoNeg ? `−${formatBRL(Math.abs(s))}` : formatBRL(s)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── VarianceRow ──────────────────────────────────────────────────────────────

function VarianceSection({
  previsto,
  realizado,
}: {
  previsto: CashFlowBucket
  realizado: CashFlowBucket
}) {
  const previstoSaldo = saldo(previsto)
  const realizadoSaldo = saldo(realizado)
  const variancia = realizadoSaldo - previstoSaldo
  const varNeg = variancia < 0

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Variância</h3>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Saldo Previsto</p>
          <p className={`tabular-nums font-semibold ${previstoSaldo < 0 ? 'text-red-600' : 'text-foreground'}`}>
            {previstoSaldo < 0 ? `−${formatBRL(Math.abs(previstoSaldo))}` : formatBRL(previstoSaldo)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Saldo Realizado</p>
          <p className={`tabular-nums font-semibold ${realizadoSaldo < 0 ? 'text-red-600' : 'text-foreground'}`}>
            {realizadoSaldo < 0 ? `−${formatBRL(Math.abs(realizadoSaldo))}` : formatBRL(realizadoSaldo)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Variância</p>
          <p
            className={`tabular-nums font-semibold ${
              varNeg ? 'text-red-600' : variancia > 0 ? 'text-green-700' : 'text-foreground'
            }`}
          >
            {varNeg ? `−${formatBRL(Math.abs(variancia))}` : formatBRL(variancia)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── PrevistoxRealizadoChart ──────────────────────────────────────────────────

export function PrevistoxRealizadoChart({ data }: PrevistoxRealizadoChartProps) {
  const zero: CashFlowBucket = { entradas: 0, saidas: 0 }

  const previsto = data?.previsto ?? zero
  const realizado = data?.realizado ?? zero

  return (
    <div className="space-y-6">
      {/* Previsto — transactions WHERE reconciliation_status = 'pendente' */}
      <BucketCard title="Previsto" bucket={previsto} />

      <div className="border-t border-border" />

      {/* Realizado — transactions WHERE reconciliation_status IN ('baixado','conciliado') */}
      <BucketCard title="Realizado" bucket={realizado} />

      <div className="border-t border-border" />

      {/* Variance summary */}
      <VarianceSection previsto={previsto} realizado={realizado} />
    </div>
  )
}
