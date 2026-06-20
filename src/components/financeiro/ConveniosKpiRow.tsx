import { ShieldPlus, FileStack, Wallet, ScissorsSquare, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

// Helper — percentage formatter matching prototype pct()
function pct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

interface ConveniosKpiRowProps {
  ativos: number
  guias: number
  faturado: number
  glosaValor: number
  glosaAvg: number
  pendentes: number
}

export function ConveniosKpiRow({
  ativos,
  guias,
  faturado,
  glosaValor,
  glosaAvg,
  pendentes,
}: ConveniosKpiRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Convênios ativos */}
      <Card className="min-h-[72px]" aria-label={`Convênios ativos: ${ativos}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Convênios ativos
            </CardTitle>
            <ShieldPlus className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{ativos}</p>
        </CardContent>
      </Card>

      {/* Guias no mês */}
      <Card className="min-h-[72px]" aria-label={`Guias no mês: ${guias}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Guias no mês
            </CardTitle>
            <FileStack className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {guias.toLocaleString('pt-BR')}
          </p>
        </CardContent>
      </Card>

      {/* Faturado (convênios) */}
      <Card className="min-h-[72px]" aria-label={`Faturado (convênios): ${formatBRL(faturado)}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Faturado (convênios)
            </CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(faturado)}</p>
        </CardContent>
      </Card>

      {/* Glosa */}
      <Card
        className="min-h-[72px]"
        aria-label={`Glosa: ${formatBRL(glosaValor)}, ${pct(glosaAvg)} média`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Glosa
            </CardTitle>
            <ScissorsSquare className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(glosaValor)}</p>
          {/* Glosa rate threshold coloring per UI-SPEC §Glosa Rate Threshold Coloring */}
          <p
            className={`text-xs font-semibold mt-0.5 ${
              glosaAvg >= 6 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {pct(glosaAvg)} média
          </p>
        </CardContent>
      </Card>

      {/* Guias em análise */}
      <Card className="min-h-[72px]" aria-label={`Guias em análise: ${pendentes}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Guias em análise
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
