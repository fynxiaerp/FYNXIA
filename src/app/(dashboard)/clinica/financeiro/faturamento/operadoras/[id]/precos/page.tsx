import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shell/PageHeader'
import { listInsurers } from '@/actions/insurers'
import { listServices, listInsurerPrices } from '@/actions/services'
import { InsurerPricesTable, type ServicePriceRow } from '@/components/financeiro/InsurerPricesTable'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InsurerPrecosPage({ params }: PageProps) {
  const { id: insurerId } = await params

  const [insurersResult, servicesResult, pricesResult] = await Promise.all([
    listInsurers(),
    listServices(),
    listInsurerPrices(insurerId),
  ])

  const insurer = (insurersResult.insurers ?? []).find((i) => i.id === insurerId)
  if (!insurer) notFound()

  const services = servicesResult.services ?? []
  const prices = pricesResult.prices ?? []

  // Build service × valor_convenio rows
  const priceMap = new Map(prices.map((p) => [p.service_id, p]))
  const rows: ServicePriceRow[] = services.map((svc) => {
    const existing = priceMap.get(svc.id)
    return {
      serviceId: svc.id,
      serviceName: svc.name,
      valorParticular: svc.valor_particular,
      valorConvenio: existing?.valor ?? null,
      priceId: existing?.id ?? null,
    }
  })

  return (
    <>
      <PageHeader
        title={`Tabela de preços — ${insurer.name}`}
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'Operadoras', href: '/clinica/financeiro/faturamento/operadoras' },
          { label: insurer.name },
        ]}
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <p className="text-sm text-muted-foreground">
          Clique em um valor para editar o preço de convênio por serviço. Pressione Enter para salvar ou Esc para cancelar.
        </p>
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display text-base font-semibold">Serviços × Valores</h3>
            <p className="text-sm text-muted-foreground">
              {insurer.name} · TISS {insurer.tiss_version}
            </p>
          </div>
          <InsurerPricesTable insurerId={insurerId} rows={rows} />
        </div>
      </main>
    </>
  )
}
