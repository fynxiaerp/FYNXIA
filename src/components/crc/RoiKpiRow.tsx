// RoiKpiRow — 4 KPI cards for the campaign ROI panel (CRC-02, D-05/D-06).
// Mirrors src/components/financeiro/NfseKpiRow.tsx (min-h-[72px] cards,
// tabular-nums numbers). cpl/cac render '—' when null (zero-denominator —
// computeCpl/computeCac already guarantee this, see roi-math.ts).

import { DollarSign, Users, Target, Percent } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

interface RoiKpiRowProps {
  custoTotal: number
  cpl: number | null
  cac: number | null
  taxaConversaoGeral: number
}

export function RoiKpiRow({ custoTotal, cpl, cac, taxaConversaoGeral }: RoiKpiRowProps) {
  const pct = Math.round(taxaConversaoGeral * 1000) / 10

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="min-h-[72px]" aria-label={`Custo Total: ${formatBRL(custoTotal)}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Custo Total
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(custoTotal)}</p>
        </CardContent>
      </Card>

      <Card className="min-h-[72px]" aria-label={`CPL: ${cpl !== null ? formatBRL(cpl) : '—'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              CPL (Custo por Lead)
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {cpl !== null ? formatBRL(cpl) : '—'}
          </p>
        </CardContent>
      </Card>

      <Card className="min-h-[72px]" aria-label={`CAC: ${cac !== null ? formatBRL(cac) : '—'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              CAC (Custo por Aquisição)
            </CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {cac !== null ? formatBRL(cac) : '—'}
          </p>
        </CardContent>
      </Card>

      <Card className="min-h-[72px]" aria-label={`Taxa de Conversão Geral: ${pct}%`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Taxa de Conversão Geral
            </CardTitle>
            <Percent className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{pct}%</p>
        </CardContent>
      </Card>
    </div>
  )
}
