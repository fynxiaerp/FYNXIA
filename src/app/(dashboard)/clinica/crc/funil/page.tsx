// src/app/(dashboard)/clinica/crc/funil/page.tsx
// Funil de Leads (Kanban) — CRC-01. Server Component: fetches leads-by-stage,
// lead sources, conversion-by-origin and the patient list (for "Indicado por" /
// convert-to-patient search), then hands everything to the client kanban board.
// NuqsAdapter wraps both PageHeader.actions (FunilHeaderActions) and main
// (LeadKanbanBoard) so the `view` query key stays in sync between them.

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { createClient } from '@/lib/supabase/server'
import { listLeadsByStage, listConversionByOrigin } from '@/actions/leads'
import { listLeadSources } from '@/actions/lead-sources'
import { LEAD_STAGES, type LeadStage } from '@/lib/validators/crc'
import { PageHeader } from '@/components/shell/PageHeader'
import { LeadKanbanBoard, FunilHeaderActions } from '@/components/crc/LeadKanbanBoard'
import { Alert, AlertDescription } from '@/components/ui/alert'

const WRITER_ROLES = ['receptionist', 'admin', 'superadmin']

export default async function CrcFunilPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Funil de Leads"
          breadcrumbs={[
            { label: 'CRC & Marketing', href: '/clinica/crc' },
            { label: 'Funil de Leads' },
          ]}
        />
        <main className="p-6 max-w-2xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'
  const canWrite = WRITER_ROLES.includes(role)

  const [leadsResult, sourcesResult, conversionResult, patientsResult] = await Promise.all([
    listLeadsByStage(),
    listLeadSources(),
    listConversionByOrigin(),
    supabase
      .from('patients')
      .select('id, full_name, cpf')
      .is('deleted_at', null)
      .eq('is_anonymized', false)
      .order('full_name', { ascending: true }),
  ])

  const emptyLeadsByStage: Record<LeadStage, never[]> = {
    novo: [],
    contatado: [],
    agendado: [],
    convertido: [],
    perdido: [],
  }

  const leadsByStage =
    leadsResult.success && leadsResult.leadsByStage ? leadsResult.leadsByStage : emptyLeadsByStage
  const sources = sourcesResult.success ? (sourcesResult.sources ?? []) : []
  const conversionData = conversionResult.success ? (conversionResult.data ?? []) : []
  const patients = (patientsResult.data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    cpf: p.cpf,
  }))

  // Sanity check: every stage key must be present (defensive against future
  // LEAD_STAGES additions without a corresponding grouped-array default).
  for (const stage of LEAD_STAGES) {
    if (!(stage in leadsByStage)) {
      ;(leadsByStage as Record<LeadStage, typeof leadsByStage.novo>)[stage] = []
    }
  }

  return (
    <NuqsAdapter>
      <PageHeader
        title="Funil de Leads"
        breadcrumbs={[
          { label: 'CRC & Marketing', href: '/clinica/crc' },
          { label: 'Funil de Leads' },
        ]}
        actions={
          <FunilHeaderActions
            sources={sources}
            patients={patients}
            canWrite={canWrite}
            canManageSources={isAdmin}
          />
        }
      />
      <main className="p-6 w-full space-y-4">
        <LeadKanbanBoard
          leadsByStage={leadsByStage}
          conversionData={conversionData}
          patients={patients}
        />
      </main>
    </NuqsAdapter>
  )
}
