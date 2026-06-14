/**
 * Perfis de Acesso config page — SYS-03 / Plan 07-06
 *
 * Admin/superadmin: read-only view of the role×module permission matrix.
 * socio/dpo: view-only access (config module with readOnly:true per MODULE_PERMISSIONS).
 * auditor: NO access to /config — redirected by proxy.
 * Non-admin non-gov: in-page Alert "Acesso restrito".
 *
 * NOTE: editable per-action permissions (100% configurável pelo admin via tabela)
 * is deferred (D-03). This surface displays the enforced matrix from proxy.ts.
 *
 * Server Component — auth + role resolved server-side.
 */
import { createClient } from '@/lib/supabase/server'
import { PerfisMatrix } from '@/components/config/PerfisMatrix'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function PerfisPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Perfis de Acesso"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Perfis de Acesso' },
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
  // admin/superadmin/ti: full view
  // socio/dpo: view-only (config module with readOnly:true — governance surface)
  // auditor: no /config access — proxy redirects before reaching here
  // others: blocked with in-page alert
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  const ALLOWED_ROLES = ['admin', 'superadmin', 'ti', 'socio', 'dpo']

  if (!actor || !ALLOWED_ROLES.includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Perfis de Acesso"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Perfis de Acesso' },
          ]}
        />
        <main className="p-6 max-w-4xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores da rede.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Perfis de Acesso"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Perfis de Acesso' },
        ]}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Matriz de permissões por papel × módulo (somente leitura).
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Esta matriz é a fonte de verdade do servidor (proxy.ts). Permissões configuráveis
            por ação fina são deferidas (D-03).
          </p>
          <PerfisMatrix />
        </div>
      </main>
    </>
  )
}
