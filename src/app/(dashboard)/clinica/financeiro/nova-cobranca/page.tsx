import { createClient } from '@/lib/supabase/server'
import { ChargeForm } from '@/components/financeiro/ChargeForm'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Nova Cobrança Page ───────────────────────────────────────────────────────
// FIN-04/05/06: Server Component. Breadcrumb + ChargeForm.
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
      <main className="min-h-screen bg-background p-8">
        <Alert variant="destructive">
          <AlertDescription>Não autenticado.</AlertDescription>
        </Alert>
      </main>
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
      <main className="min-h-screen bg-background p-8">
        <Alert>
          <AlertDescription>Acesso restrito a colaboradores da clínica.</AlertDescription>
        </Alert>
      </main>
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
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/clinica">Clínica</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/clinica/financeiro">Financeiro</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nova Cobrança</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-xl font-semibold leading-tight">Emitir Cobrança</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Emita cobranças via PIX, boleto ou cartão de crédito pelo Asaas.
          </p>
        </div>

        {/* Primary focal point: charge form (UI-SPEC) */}
        <ChargeForm patients={patients} />
      </div>
    </main>
  )
}
