/**
 * Integrações config page — INT-01 + INT-03 / Phase 9 Plan 05
 *
 * Admin/superadmin/ti: register/edit connectors + health panel + reprocess.
 * Auditor/dpo/socio: read-only view of connectors and health panel (mutations blocked server-side).
 * All others: in-page Alert "Acesso restrito" — NO redirect (v1 UI convention).
 *
 * Server Component — auth + role gate resolved server-side.
 * RSC RULE: passes ONLY serializable arrays (connectors/health) to IntegrationsManager.
 *           NO functions, NO components, NO server objects across the boundary (T-09-25).
 *
 * Module: integracoes (gated by MODULE_PERMISSIONS in proxy.ts — Plan 03).
 * Permitted roles: admin, superadmin, ti (write); auditor, dpo, socio (readOnly).
 */
import { createClient } from '@/lib/supabase/server'
import { listConnectors } from '@/actions/integration-connectors'
import { listConnectorHealth } from '@/actions/integration-events'
import { IntegrationsManager } from '@/components/config/IntegrationsManager'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Roles permitted to access the integracoes module (mirrors MODULE_PERMISSIONS in proxy.ts).
const PERMITTED_ROLES = ['admin', 'superadmin', 'ti', 'auditor', 'dpo', 'socio'] as const

export default async function IntegracoesPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Integrações"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Integrações' },
          ]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
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

  if (!actor || !(PERMITTED_ROLES as readonly string[]).includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Integrações"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Integrações' },
          ]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores e TI.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Load data server-side ─────────────────────────────────────────────────────
  // RSC RULE: Only serializable plain arrays are passed to the client manager (T-09-25).
  // credential_enc NEVER appears in connectors (ConnectorPublic type guarantee — T-09-20).
  const connectors = (await listConnectors()).connectors ?? []
  const health = (await listConnectorHealth()).health ?? []

  return (
    <>
      <PageHeader
        title="Integrações"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Integrações' },
        ]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <p className="text-sm text-muted-foreground">
          Gerencie os conectores externos da clínica (pagamentos, WhatsApp, e-mail, NFS-e e outros).
          As credenciais são cifradas no servidor e nunca expostas ao cliente. O painel de saúde
          exibe o status derivado dos eventos das últimas 24 horas.
        </p>
        <IntegrationsManager connectors={connectors} health={health} />
      </main>
    </>
  )
}
