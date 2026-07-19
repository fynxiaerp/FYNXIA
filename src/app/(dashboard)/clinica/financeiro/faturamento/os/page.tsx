import { Suspense } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listOs } from '@/actions/service-orders-client'
import { OsListClient } from './OsListClient'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Screen 1 — Ordens de Serviço (RSC)
// Reads filters from searchParams. Calls listOs. Renders KPI row + filter bar + OsTable.
export default async function OsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const month = typeof params.month === 'string' ? params.month : undefined
  const status = typeof params.status === 'string' ? params.status : undefined
  const pagador = typeof params.pagador === 'string' ? params.pagador : undefined

  const result = await listOs({ month, status, pagador })
  const orders = result.orders ?? []

  // KPI counts
  const rascunhoCount = orders.filter((o) => o.status === 'rascunho').length
  const faturadaCount = orders.filter((o) => o.status === 'faturada').length
  const canceladaCount = orders.filter((o) => o.status === 'cancelada').length

  return (
    <NuqsAdapter>
      <PageHeader
        title="Ordens de Serviço"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'OS' },
        ]}
        actions={
          <Button size="sm" render={<Link href="/clinica/financeiro/faturamento/os/nova" />}>
            Nova OS
          </Button>
        }
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI row */}
        <section aria-label="Indicadores de OS">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="min-h-[72px]" aria-label={`OS abertas (rascunho): ${rascunhoCount}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  OS abertas (rascunho)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{rascunhoCount}</p>
              </CardContent>
            </Card>

            <Card className="min-h-[72px]" aria-label={`Faturadas (mês): ${faturadaCount}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Faturadas (mês)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{faturadaCount}</p>
              </CardContent>
            </Card>

            <Card className="min-h-[72px]" aria-label={`Canceladas (mês): ${canceladaCount}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Canceladas (mês)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{canceladaCount}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Client-side filters + table (nuqs state) */}
        <Suspense fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-xs" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        }>
          <OsListClient
            initialOrders={orders}
            initialMonth={month}
            initialStatus={status}
            initialPagador={pagador}
          />
        </Suspense>
      </main>
    </NuqsAdapter>
  )
}
