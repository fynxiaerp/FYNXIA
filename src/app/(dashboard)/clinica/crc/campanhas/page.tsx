// src/app/(dashboard)/clinica/crc/campanhas/page.tsx
// Campanhas de Reativação (CRC-03, D-07..D-11) — Server Component.
// Fetches listCampaigns() + listUnits()/listServices() (segment filter options
// for the 3-step CampaignFormDialog) and hands everything to the client table.

import { Send, Plus } from 'lucide-react'

import { listCampaigns } from '@/actions/campaigns'
import { listUnits } from '@/actions/units'
import { listServices } from '@/actions/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CampaignsTable } from '@/components/crc/CampaignsTable'
import { CampaignFormDialog } from '@/components/crc/CampaignFormDialog'

export default async function CampanhasPage() {
  const [campaignsResult, unitsResult, servicesResult] = await Promise.all([
    listCampaigns(),
    listUnits(),
    listServices(),
  ])

  const campaigns = campaignsResult.success ? (campaignsResult.data ?? []) : []
  const units = (unitsResult.success ? (unitsResult.units ?? []) : []).map((u) => ({
    id: u.id,
    name: u.name,
  }))
  const services = (servicesResult.success ? (servicesResult.services ?? []) : []).map((s) => ({
    id: s.id,
    name: s.name,
  }))

  const hasError = !campaignsResult.success

  return (
    <>
      <PageHeader
        title="Campanhas de Reativação"
        breadcrumbs={[
          { label: 'CRC & Marketing', href: '/clinica/crc' },
          { label: 'Campanhas de Reativação' },
        ]}
        actions={
          <CampaignFormDialog mode="create" units={units} services={services}>
            <Button size="sm">
              <Plus className="size-4" />
              Nova Campanha
            </Button>
          </CampaignFormDialog>
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>
              {campaignsResult.error ?? 'Erro ao carregar campanhas. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {campaigns.length === 0 && !hasError ? (
          <EmptyState
            icon={Send}
            title="Nenhuma campanha de reativação"
            description="Configure um segmento de pacientes inativos para disparar sua primeira campanha."
            cta={
              <CampaignFormDialog mode="create" units={units} services={services}>
                <Button size="sm">
                  <Plus className="size-4" />
                  Nova Campanha
                </Button>
              </CampaignFormDialog>
            }
          />
        ) : (
          <CampaignsTable campaigns={campaigns} units={units} services={services} />
        )}
      </main>
    </>
  )
}
