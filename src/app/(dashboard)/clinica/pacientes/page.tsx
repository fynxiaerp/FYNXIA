import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PatientTable } from '@/components/patients/PatientTable'
import { Button, buttonVariants } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function PacientesPage() {
  const supabase = await createClient()

  // WR-03: derive tenant + role from the authenticated user — do NOT trust the
  // forwarded `x-user-role` / `x-user-id` headers for masking / gating decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: actor } = user
    ? await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single()
    : { data: null }

  const userRole = actor?.role ?? 'receptionist'
  const tenantId = actor?.tenant_id

  // Fetch active patients for this tenant (RLS also applies)
  const { data: patients } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name, cpf, phone, email, created_at, is_anonymized')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const isStaff =
    userRole === 'admin' ||
    userRole === 'dentist' ||
    userRole === 'receptionist' ||
    userRole === 'superadmin'

  return (
    <>
      <PageHeader
        title="Pacientes"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Pacientes' },
        ]}
        actions={
          isStaff ? (
            <Button render={<Link href="/clinica/pacientes/novo" />}>
              <UserPlus className="size-4" />
              Novo Paciente
            </Button>
          ) : undefined
        }
      />
      <main className="p-6 max-w-5xl mx-auto w-full">
        {!patients || patients.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-xl font-semibold font-display">
              Nenhum paciente cadastrado
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre o primeiro paciente da clínica para começar o atendimento.
            </p>
            {isStaff && (
              <Button
                className="mt-4"
                render={<Link href="/clinica/pacientes/novo" />}
              >
                <UserPlus className="size-4" />
                Novo Paciente
              </Button>
            )}
          </div>
        ) : (
          <PatientTable patients={patients} userRole={userRole} />
        )}
      </main>
    </>
  )
}
