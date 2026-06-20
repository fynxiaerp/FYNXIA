import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { getNfses } from '@/actions/nfse'
import { listOs } from '@/actions/service-orders-client'
import { NfseKpiRow } from '@/components/financeiro/NfseKpiRow'
import { NfseTable } from '@/components/financeiro/NfseTable'
import { NfseEmitForm, type FaturadaOsOption } from '@/components/financeiro/NfseEmitForm'
import { ChartCard, BarChart } from '@/components/prototipos/charts'

// Screen 2 — NFS-e Fiscal (RSC)
export default async function NfsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const month = typeof params.month === 'string' ? params.month : undefined
  const status = typeof params.status === 'string' ? params.status : undefined

  const [nfsesResult, osResult] = await Promise.all([
    getNfses({ month, status }),
    listOs({ status: 'faturada' }),
  ])

  const nfses = nfsesResult.data ?? []
  const faturadaOrders = osResult.orders ?? []

  // KPI calculations
  const mesCount = nfses.filter((n) => n.status === 'emitida').length
  const valorEmitido = nfses
    .filter((n) => n.status === 'emitida')
    .reduce((sum, n) => sum + n.valor_servicos, 0)
  const pendentes = nfses.filter((n) => n.status === 'processando' || n.status === 'erro').length

  // Use average aliquota from emitted records (or default 5%)
  const emitidas = nfses.filter((n) => n.status === 'emitida')
  const aliquota = emitidas.length > 0
    ? emitidas.reduce((sum, n) => sum + n.valor_iss / (n.valor_servicos || 1), 0) / emitidas.length
    : 0.05

  // Bar chart: last 6 months counts
  const now = new Date()
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }),
    }
  })
  const chartData = months6.map(({ key, label }) => ({
    label,
    value: nfses.filter((n) => n.created_at.startsWith(key) && n.status === 'emitida').length,
  }))

  // Faturada OS options for the emit form
  const faturadaOsOptions: FaturadaOsOption[] = faturadaOrders.map((o) => ({
    id: o.id,
    numero: o.numero,
    total: o.total,
    patient_maskedName: o.patient_maskedName,
  }))

  const hasFaturada = faturadaOsOptions.length > 0

  return (
    <>
      <PageHeader
        title="NFS-e Fiscal"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'NFS-e' },
        ]}
        actions={
          <Button size="sm" disabled={!hasFaturada}>
            Emitir NFS-e
          </Button>
        }
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI row */}
        <Suspense fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
        }>
          <section aria-label="Indicadores fiscais">
            <NfseKpiRow
              mesCount={mesCount}
              valorEmitido={valorEmitido}
              aliquota={aliquota}
              pendentes={pendentes}
            />
          </section>
        </Suspense>

        {/* Chart + Emit form (2-col grid) */}
        <section aria-label="Emissão" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Notas emitidas" description="Últimos 6 meses">
            <BarChart
              data={chartData}
              format={(n) => String(n)}
              tone="chart-2"
              height={220}
            />
          </ChartCard>

          <ChartCard title="Emitir NFS-e" description="Emita nota fiscal a partir de uma OS faturada">
            <NfseEmitForm faturadaOs={faturadaOsOptions} />
          </ChartCard>
        </section>

        {/* Histórico table */}
        <Suspense fallback={<Skeleton className="h-64 rounded-xl w-full" />}>
          <section aria-label="Histórico de notas">
            {nfses.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center space-y-2">
                <p className="font-semibold">Nenhuma nota emitida</p>
                <p className="text-sm text-muted-foreground">
                  Emita NFS-e a partir de uma OS faturada. As notas aparecem aqui após o envio à prefeitura.
                </p>
              </div>
            ) : (
              <NfseTable rows={nfses} />
            )}
          </section>
        </Suspense>
      </main>
    </>
  )
}
