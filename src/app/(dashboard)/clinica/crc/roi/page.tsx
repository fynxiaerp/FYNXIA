// src/app/(dashboard)/clinica/crc/roi/page.tsx
// Painel de ROI de Campanha (CRC-02, D-05/D-06) — Server Component.
// Read-only: cost comes from payables.campaign_id (Contas a Pagar), never
// manual entry here. Fetches getRoiByCampaign + getRoiByOrigin in parallel.

import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { getRoiByCampaign, getRoiByOrigin } from '@/actions/roi'
import { listCampaigns } from '@/actions/campaigns'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RoiFilters } from '@/components/crc/RoiFilters'
import { RoiKpiRow } from '@/components/crc/RoiKpiRow'
import { RoiByOriginTable } from '@/components/crc/RoiByOriginTable'

interface RoiPageProps {
  searchParams: Promise<{
    campanha?: string
    from?: string
    to?: string
  }>
}

export default async function RoiPage({ searchParams }: RoiPageProps) {
  const params = await searchParams
  const campaignId = params.campanha || undefined
  const from = params.from || undefined
  const to = params.to || undefined

  const [campaignsResult, roiResult, originResult] = await Promise.all([
    listCampaigns(),
    getRoiByCampaign({ campaignId, from, to }),
    getRoiByOrigin({ from, to }),
  ])

  const campaigns = campaignsResult.success ? (campaignsResult.data ?? []) : []
  const roiData = roiResult.success ? (roiResult.data ?? []) : []
  const summary = roiResult.summary ?? { custoTotal: 0, cpl: null, cac: null, taxaConversaoGeral: 0 }
  const originData = originResult.success ? (originResult.data ?? []) : []

  const hasError = !roiResult.success || !originResult.success
  const hasCampaigns = campaigns.length > 0

  return (
    <NuqsAdapter>
      <PageHeader
        title="ROI de Campanhas"
        breadcrumbs={[
          { label: 'CRC & Marketing', href: '/clinica/crc' },
          { label: 'ROI de Campanhas' },
        ]}
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>
              {roiResult.error ?? originResult.error ?? 'Erro ao carregar o painel de ROI. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {!hasCampaigns ? (
          <EmptyState
            icon={TrendingUp}
            title="Nenhuma campanha registrada"
            description="Lance uma despesa de marketing no financeiro e vincule a uma campanha para calcular CPL e CAC."
            cta={
              <Link
                href="/clinica/financeiro/contas-a-pagar"
                className="text-sm font-medium text-primary underline underline-offset-2"
              >
                Lançar despesa
              </Link>
            }
          />
        ) : (
          <>
            <RoiFilters campaigns={campaigns} />

            <RoiKpiRow
              custoTotal={summary.custoTotal}
              cpl={summary.cpl}
              cac={summary.cac}
              taxaConversaoGeral={summary.taxaConversaoGeral}
            />

            <div className="space-y-3">
              <h2 className="text-sm font-semibold font-display">Conversão e ROI por Origem</h2>
              <RoiByOriginTable data={originData} />
            </div>

            {roiData.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma campanha corresponde aos filtros selecionados.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Custo de campanha vem de despesas de marketing lançadas no Financeiro (Contas a Pagar / Centro de
              Custo Marketing).{' '}
              <Link className="underline" href="/clinica/financeiro/contas-a-pagar">
                Lançar despesa
              </Link>
            </p>
          </>
        )}
      </main>
    </NuqsAdapter>
  )
}
