'use client'

// StockAlertBanner — banner de alertas ativos no dashboard de estoque (EST-03).
// Renderizado pela page apenas quando há pelo menos 1 alerta (minimo/validade/negativo > 0).
// Copy exata do 17-UI-SPEC.md §Copywriting Contract.
// Ícones: AlertTriangle (mínimo/negativo) / Clock (validade) — variant destructive apenas para negativo.

import { AlertTriangle, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface StockAlertCounts {
  minimo: number
  validade: number
  negativo: number
}

interface StockAlertBannerProps {
  counts: StockAlertCounts
}

export function StockAlertBanner({ counts }: StockAlertBannerProps) {
  const { minimo, validade, negativo } = counts

  if (minimo === 0 && validade === 0 && negativo === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {minimo > 0 && (
        <Alert>
          <AlertTriangle className="text-amber-600" />
          <AlertDescription>
            {minimo} produto{minimo > 1 ? 's' : ''} abaixo do estoque mínimo — pedido de reposição
            enviado para aprovação.
          </AlertDescription>
        </Alert>
      )}

      {validade > 0 && (
        <Alert>
          <Clock className="text-orange-600" />
          <AlertDescription>
            {validade} lote{validade > 1 ? 's' : ''} com vencimento nos próximos 30 dias.
          </AlertDescription>
        </Alert>
      )}

      {negativo > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            {negativo} produto{negativo > 1 ? 's' : ''} com saldo negativo — registre uma entrada
            para normalizar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
