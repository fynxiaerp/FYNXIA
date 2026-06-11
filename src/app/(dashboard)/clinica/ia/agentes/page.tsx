// src/app/(dashboard)/clinica/ia/agentes/page.tsx
// AI agent outreach log — read-only view of the last 20 AI-02/AI-03 agent actions.
//
// Server Component: calls listAgentOutreach() (RLS-scoped via createClient).
// Tenant isolation is guaranteed by the agent_outreach_log SELECT policy.
// The CopilotTrigger is mounted by the parent clinica/layout.tsx.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { listAgentOutreach } from '@/actions/agent-outreach'
import { AgentOutreachLog } from '@/components/copilot/AgentOutreachLog'

export default async function AgentesPage() {
  const rows = await listAgentOutreach()

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/clinica" className="hover:text-foreground transition-colors">
            Clínica
          </Link>
          <ChevronRight className="size-3.5 shrink-0" />
          <span>IA</span>
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="text-foreground font-medium">Agentes</span>
        </nav>

        {/* Page title */}
        <div>
          <h1 className="text-xl font-semibold leading-tight">Ações dos Agentes IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Últimas 20 ações registradas pelos agentes de confirmação de consulta e cobrança automática.
          </p>
        </div>

        {/* Agent outreach log table */}
        <AgentOutreachLog rows={rows} />
      </div>
    </main>
  )
}
