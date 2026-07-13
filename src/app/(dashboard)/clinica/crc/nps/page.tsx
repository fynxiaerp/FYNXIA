// src/app/(dashboard)/clinica/crc/nps/page.tsx
// Painel de NPS (CRC-04, D-13/D-14/D-15) — Server Component.
// Reads getNpsSummary + listNpsResponses (Plan 06). Score card -> detractor
// alert (D-15, only when there are untreated detractors) -> secondary
// promotor/neutro/detrator KPIs -> recent responses table (UI-SPEC §5).

import { Smile } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { getNpsSummary, listNpsResponses } from '@/actions/nps'
import { listUnits } from '@/actions/units'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NpsFilters } from '@/components/crc/NpsFilters'
import { NpsScoreCard } from '@/components/crc/NpsScoreCard'
import { DetractorAlertBanner } from '@/components/crc/DetractorAlertBanner'
import { NpsResponsesTable } from '@/components/crc/NpsResponsesTable'

interface NpsPageProps {
  searchParams: Promise<{
    from?: string
    to?: string
    unidade?: string
  }>
}

export default async function NpsPage({ searchParams }: NpsPageProps) {
  const params = await searchParams
  const from = params.from || undefined
  const to = params.to || undefined
  const unitId = params.unidade || undefined

  const [summaryResult, responsesResult, unitsResult] = await Promise.all([
    getNpsSummary({ from, to, unitId }),
    listNpsResponses({ from, to, unitId }),
    listUnits(),
  ])

  const hasError = !summaryResult.success || !responsesResult.success
  const summary = summaryResult.data ?? {
    score: null,
    promotores: 0,
    neutros: 0,
    detratores: 0,
    detractorsPending: 0,
  }
  const responses = responsesResult.data ?? []
  const units = unitsResult.units ?? []

  const hasFilters = Boolean(from || to || unitId)
  const isTrulyEmpty = !hasFilters && summary.score === null && responses.length === 0

  return (
    <NuqsAdapter>
      <PageHeader
        title="NPS"
        breadcrumbs={[
          { label: 'CRC & Marketing', href: '/clinica/crc' },
          { label: 'NPS' },
        ]}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>
              {summaryResult.error ?? responsesResult.error ?? 'Erro ao carregar o painel de NPS. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {isTrulyEmpty ? (
          <EmptyState
            icon={Smile}
            title="Nenhuma resposta de NPS ainda"
            description="As respostas aparecem aqui após o envio automático pós-consulta."
          />
        ) : (
          <>
            <NpsFilters units={units} />

            <NpsScoreCard
              score={summary.score}
              promotores={summary.promotores}
              neutros={summary.neutros}
              detratores={summary.detratores}
            />

            {summary.detractorsPending > 0 && (
              <DetractorAlertBanner count={summary.detractorsPending} />
            )}

            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="min-h-[72px]" aria-label={`Promotores: ${summary.promotores}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Promotores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums text-green-700 dark:text-green-400">
                    {summary.promotores}
                  </p>
                </CardContent>
              </Card>

              <Card className="min-h-[72px]" aria-label={`Neutros: ${summary.neutros}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Neutros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {summary.neutros}
                  </p>
                </CardContent>
              </Card>

              <Card className="min-h-[72px]" aria-label={`Detratores: ${summary.detratores}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Detratores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
                    {summary.detratores}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold font-display">Respostas Recentes</h2>
              <NpsResponsesTable responses={responses} />
            </div>
          </>
        )}
      </main>
    </NuqsAdapter>
  )
}
