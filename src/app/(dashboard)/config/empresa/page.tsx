/**
 * Empresa & Unidades config page — SYS-01
 *
 * Admin/superadmin: PageHeader + EmpresaForm + UnitsManager.
 * Non-admin: in-page Alert "Acesso restrito" — NO redirect (v1 UI convention).
 *
 * Server Component — auth + role resolved server-side.
 */
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/actions/empresa'
import { listUnits } from '@/actions/units'
import { EmpresaForm } from '@/components/config/EmpresaForm'
import { UnitsManager } from '@/components/config/UnitsManager'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export default async function EmpresaPage() {
  const supabase = await createClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Empresa & Unidades"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Empresa' },
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

  // ── Role gate ────────────────────────────────────────────────────────────────
  const { data: actor } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  // Non-admin sees "Acesso restrito" in-page — no redirect (v1 convention)
  if (!actor || !['admin', 'superadmin'].includes(actor.role)) {
    return (
      <>
        <PageHeader
          title="Empresa & Unidades"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Empresa' },
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

  // ── Load data ────────────────────────────────────────────────────────────────
  const [empresaResult, unitsResult] = await Promise.all([getEmpresa(), listUnits()])

  const empresa = empresaResult.success ? empresaResult.empresa : undefined
  const units = unitsResult.success ? (unitsResult.units ?? []) : []

  return (
    <>
      <PageHeader
        title="Empresa & Unidades"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Empresa' },
        ]}
      />

      <main className="p-6 max-w-2xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-1">Dados da Empresa</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure os dados fiscais da sua rede odontológica.
          </p>
          <EmpresaForm initial={empresa} />
        </div>

        <Separator />

        <UnitsManager units={units} />
      </main>
    </>
  )
}
