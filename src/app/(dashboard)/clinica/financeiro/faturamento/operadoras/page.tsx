import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { listInsurers } from '@/actions/insurers'
import { InsurerTableWrapper } from './InsurerTableWrapper'

// T-15-35: server-side role gate — admin/financeiro only (D-18)
const ALLOWED_ROLES = ['admin', 'superadmin', 'financeiro'] as const

export default async function OperadorasPage() {
  // Server-side role check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    role = userRow?.role ?? null
  }

  const canWrite = ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])

  // Even read access is gated to these roles (T-15-35)
  if (!canWrite) {
    return (
      <>
        <PageHeader
          title="Operadoras de Convênio"
          breadcrumbs={[
            { label: 'Financeiro', href: '/clinica/financeiro' },
            { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
            { label: 'Operadoras' },
          ]}
        />
        <main className="p-6 max-w-6xl mx-auto w-full">
          <div className="rounded-xl border border-border bg-muted/40 p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">
              O cadastro de operadoras é acessível apenas para perfis admin e financeiro.
            </p>
          </div>
        </main>
      </>
    )
  }

  const result = await listInsurers()
  const insurers = result.insurers ?? []

  return (
    <>
      <PageHeader
        title="Operadoras de Convênio"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento', href: '/clinica/financeiro/faturamento' },
          { label: 'Operadoras' },
        ]}
        actions={<InsurerTableWrapper insurers={insurers} canWrite={canWrite} showTrigger />}
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {insurers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center space-y-2">
            <p className="text-sm font-semibold">Nenhuma operadora cadastrada</p>
            <p className="text-sm text-muted-foreground">
              Cadastre uma operadora para iniciar o faturamento de convênios.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <InsurerTableWrapper insurers={insurers} canWrite={canWrite} />
          </div>
        )}
      </main>
    </>
  )
}
