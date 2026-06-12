import { createClient } from '@/lib/supabase/server'
import { ChargeForm } from '@/components/financeiro/ChargeForm'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Nova Cobrança Page ───────────────────────────────────────────────────────
// FIN-04/05/06: Server Component. PageHeader + ChargeForm.
// Role gate: accessible to admin/dentist/receptionist (action-level gates enforce writes).
// Fetches patient list server-side so ChargeForm can render patient search.

export default async function NovaCobrancaPage() {
  const supabase = await createClient()

  // Auth + role check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Nova Cobrança"
          breadcrumbs={[
            { label: 'Financeiro', href: '/clinica/financeiro' },
            { label: 'Nova Cobrança' },
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

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = me?.role ?? 'receptionist'
  const allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!allowedRoles.includes(role)) {
    return (
      <>
        <PageHeader
          title="Nova Cobrança"
          breadcrumbs={[
            { label: 'Financeiro', href: '/clinica/financeiro' },
            { label: 'Nova Cobrança' },
          ]}
        />
        <main className="p-6 max-w-2xl mx-auto w-full">
          <Alert>
            <AlertDescription>Acesso restrito a colaboradores da clínica.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // Fetch patients for the charge form (RLS scopes to tenant automatically)
  const { data: patientRows } = await supabase
    .from('patients')
    .select('id, full_name, cpf')
    .is('deleted_at', null)
    .eq('is_anonymized', false)
    .order('full_name', { ascending: true })

  const patients = (patientRows ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    cpf: p.cpf,
  }))

  return (
    <>
      <PageHeader
        title="Nova Cobrança"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Nova Cobrança' },
        ]}
      />
      <main className="p-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-muted-foreground mb-6">
          Emita cobranças via PIX, boleto ou cartão de crédito pelo Asaas.
        </p>

        {/* Primary focal point: charge form (UI-SPEC) */}
        <ChargeForm patients={patients} />
      </main>
    </>
  )
}
