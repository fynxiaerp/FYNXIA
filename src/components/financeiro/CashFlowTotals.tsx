'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

// ─── CashFlowTotals ───────────────────────────────────────────────────────────
// FIN-01: 3-card row (entradas / saídas / saldo).
// UI-SPEC: Display-size tabular-nums amounts. Entrada green, Saída red, Saldo neutral/red.
// Accessibility: aria-label with full formatted amount on each card.

interface CashFlowTotalsProps {
  entradas: number
  saidas: number
  saldo: number
}

export function CashFlowTotals({ entradas, saidas, saldo }: CashFlowTotalsProps) {
  const saldoNegative = saldo < 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Entradas */}
      <Card
        className="min-h-[72px]"
        aria-label={`Entradas: ${formatBRL(entradas)}`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Entradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold leading-tight tabular-nums text-green-700">
            {formatBRL(entradas)}
          </p>
        </CardContent>
      </Card>

      {/* Saídas */}
      <Card
        className="min-h-[72px]"
        aria-label={`Saídas: ${formatBRL(saidas)}`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Saídas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold leading-tight tabular-nums text-red-600">
            {/* U+2212 true minus per UI-SPEC */}
            {saidas > 0 ? `−${formatBRL(saidas)}` : formatBRL(saidas)}
          </p>
        </CardContent>
      </Card>

      {/* Saldo */}
      <Card
        className="min-h-[72px]"
        aria-label={`Saldo: ${formatBRL(saldo)}`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-semibold leading-tight tabular-nums ${
              saldoNegative ? 'text-red-600' : 'text-foreground'
            }`}
          >
            {saldoNegative ? `−${formatBRL(Math.abs(saldo))}` : formatBRL(saldo)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
