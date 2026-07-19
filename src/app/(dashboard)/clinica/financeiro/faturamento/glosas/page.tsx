import { PageHeader } from '@/components/shell/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScissorsSquare, Wallet, RefreshCcw } from 'lucide-react'
import { getGlosas } from '@/actions/tiss'
import { listInsurers } from '@/actions/insurers'
import { formatBRL } from '@/lib/format/money'
import { GlosaListClient } from './GlosaListClient'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

interface PageProps {
  searchParams: Promise<{ operadora?: string; status?: string; month?: string }>
}

export default async function GlosasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const insurerId = params.operadora
  const statusFilter = params.status as 'glosada' | 'em_recurso' | undefined
  const month = params.month

  const [glosaResult, insurersResult] = await Promise.all([
    getGlosas({ insurerId, status: statusFilter, month }),
    listInsurers({ ativo: true }),
  ])

  const glosas = glosaResult.glosas ?? []
  const insurers = insurersResult.insurers ?? []

  // KPI calculations
  const pendentes = glosas.filter((g) => g.glosa_status === 'glosada').length
  const valorGlosado = glosas.reduce((s, g) => s + g.valor_glosado, 0)
  const emRecurso = glosas.filter((g) => g.glosa_status === 'em_recurso').length

  return (
    <NuqsAdapter>
      <PageHeader
        title="Tratamento de Glosas"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'Glosas' },
        ]}
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI row — 3 cards */}
        <section aria-label="Indicadores de glosas">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="min-h-[72px]" aria-label={`Glosas pendentes: ${pendentes}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Glosas pendentes
                  </CardTitle>
                  <ScissorsSquare className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{pendentes}</p>
              </CardContent>
            </Card>

            <Card className="min-h-[72px]" aria-label={`Valor glosado: ${formatBRL(valorGlosado)}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Valor glosado
                  </CardTitle>
                  <Wallet className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-destructive">
                  {formatBRL(valorGlosado)}
                </p>
              </CardContent>
            </Card>

            <Card className="min-h-[72px]" aria-label={`Em recurso: ${emRecurso}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Em recurso
                  </CardTitle>
                  <RefreshCcw className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{emRecurso}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Filter bar + table (client for nuqs + sheet state) */}
        <GlosaListClient
          initialGlosas={glosas}
          insurers={insurers.map((i) => ({ id: i.id, name: i.name }))}
          initialOperadora={insurerId ?? ''}
          initialStatus={statusFilter ?? ''}
          initialMonth={month ?? ''}
        />
      </main>
    </NuqsAdapter>
  )
}
