import { FileCheck2, FileText, Landmark, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

interface NfseKpiRowProps {
  mesCount: number
  valorEmitido: number
  aliquota: number
  pendentes: number
}

export function NfseKpiRow({ mesCount, valorEmitido, aliquota, pendentes }: NfseKpiRowProps) {
  const aliquotaPct = (aliquota * 100).toFixed(0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        className="min-h-[72px]"
        aria-label={`Notas emitidas (mês): ${mesCount}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Notas emitidas (mês)
            </CardTitle>
            <FileCheck2 className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{mesCount}</p>
        </CardContent>
      </Card>

      <Card
        className="min-h-[72px]"
        aria-label={`Valor emitido: ${formatBRL(valorEmitido)}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Valor emitido
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(valorEmitido)}</p>
        </CardContent>
      </Card>

      <Card
        className="min-h-[72px]"
        aria-label={`ISS (${aliquotaPct}%): ${formatBRL(valorEmitido * aliquota)}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              ISS ({aliquotaPct}%)
            </CardTitle>
            <Landmark className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {formatBRL(valorEmitido * aliquota)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Retido sobre serviços</p>
        </CardContent>
      </Card>

      <Card
        className="min-h-[72px]"
        aria-label={`Pendentes / erro: ${pendentes}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Pendentes / erro
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{pendentes}</p>
        </CardContent>
      </Card>
    </div>
  )
}
