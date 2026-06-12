// src/app/(dashboard)/clinica/ia/agentes/page.tsx
// AI agent outreach log — read-only view of the last 20 AI-02/AI-03 agent actions.
//
// Server Component: calls listAgentOutreach() (RLS-scoped via createClient).
// Tenant isolation is guaranteed by the agent_outreach_log SELECT policy.
// The CopilotTrigger is mounted by the parent clinica/layout.tsx.

import { listAgentOutreach } from '@/actions/agent-outreach'
import { AgentOutreachLog } from '@/components/copilot/AgentOutreachLog'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function AgentesPage() {
  const rows = await listAgentOutreach()

  return (
    <>
      <PageHeader
        title="Ações dos Agentes IA"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'IA' },
          { label: 'Agentes' },
        ]}
      />
      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <p className="text-sm text-muted-foreground">
          Últimas 20 ações registradas pelos agentes de confirmação de consulta e cobrança automática.
        </p>

        {/* Agent outreach log table */}
        <AgentOutreachLog rows={rows} />
      </main>
    </>
  )
}
