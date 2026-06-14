/**
 * Autonomia da IA config page — SYS-04 / Plan 07-06
 *
 * Admin/superadmin: configure autonomy level L0–L4 per AI agent.
 * Non-admin: in-page Alert "Acesso restrito" — NO redirect (v1 UI convention).
 *
 * NOTE: L0–L4 enforcement (tetos, travas, aprovação humana) arrives in Fase 10 (AIG).
 * This page stores the desired config; Fase 10 reads and enforces it at runtime.
 *
 * Server Component — auth + role resolved server-side.
 */
import { createClient } from '@/lib/supabase/server'
import { listAiAgentConfig } from '@/actions/ai-agent-config'
import { AiAutonomyForm } from '@/components/config/AiAutonomyForm'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function IaPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Autonomia da IA"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Autonomia da IA' },
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

  // ── Role gate ─────────────────────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!actor || !['admin', 'superadmin'].includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Autonomia da IA"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Autonomia da IA' },
          ]}
        />
        <main className="p-6 max-w-2xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores da rede.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Load current AI agent configurations ─────────────────────────────────────
  const configResult = await listAiAgentConfig()
  const agents = configResult.success ? (configResult.agents ?? []) : []

  return (
    <>
      <PageHeader
        title="Autonomia da IA"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Autonomia da IA' },
        ]}
      />

      <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Configure o nível de autonomia de cada agente de IA da clínica.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Nota: a aplicação dos tetos e travas L0–L4 (aprovação humana, limites de execução)
            chega na Fase 10 (AIG). Por ora, este painel armazena a configuração desejada.
          </p>
          <AiAutonomyForm agents={agents} />
        </div>
      </main>
    </>
  )
}
