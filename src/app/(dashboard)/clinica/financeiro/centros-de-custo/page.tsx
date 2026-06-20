// src/app/(dashboard)/clinica/financeiro/centros-de-custo/page.tsx
// FCAD-01: Centros de Custo cadastro — RSC.
// UI-SPEC §"Page Structure /centros-de-custo".
// T-14-16: units Select populated with tenant's own units (RLS-filtered listUnits).
// T-14-17: canEdit={isAdmin} — UI hides controls; Server Actions enforce the real gate.

import { Building2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listCostCenters } from '@/actions/cost-centers'
import { listUnits } from '@/actions/units'
import { PageHeader } from '@/components/shell/PageHeader'
import { CostCentersTable } from '@/components/financeiro/CostCentersTable'
import { CostCenterFormDialog } from '@/components/financeiro/CostCenterFormDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function CentrosDeCustoPage() {
  // ─── Role fetch — mirrors plano-de-contas/page.tsx pattern ──────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  // ─── Fetch data ──────────────────────────────────────────────────────────────
  const [centersResult, unitsResult] = await Promise.all([
    listCostCenters(),
    listUnits(),
  ])

  const centers = centersResult.success ? (centersResult.centers ?? []) : []
  const units = (unitsResult.success ? (unitsResult.units ?? []) : []).map((u) => ({
    id: u.id,
    name: u.name,
  }))

  return (
    <>
      <PageHeader
        title="Centros de Custo"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Centros de Custo' },
        ]}
        actions={
          isAdmin ? (
            <CostCenterFormDialog
              mode="create"
              units={units}
              trigger={
                <Button size="sm">
                  <Building2 className="size-4 mr-1" />
                  Novo Centro de Custo
                </Button>
              }
            />
          ) : null
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full">
        {/* Error state */}
        {!centersResult.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {centersResult.error ?? 'Erro ao carregar centros de custo.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <CostCentersTable
            centers={centers}
            units={units}
            canEdit={isAdmin}
          />
        </div>
      </main>
    </>
  )
}
