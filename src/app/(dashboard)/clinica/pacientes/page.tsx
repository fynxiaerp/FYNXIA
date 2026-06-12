import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PatientTable } from '@/components/patients/PatientTable'
import { Button } from '@/components/ui/button'
import { UserPlus, UserX } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'

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
          <EmptyState
            icon={UserX}
            title="Nenhum paciente cadastrado"
            description="Cadastre o primeiro paciente da clínica para começar o atendimento."
            cta={
              isStaff ? (
                <Button render={<Link href="/clinica/pacientes/novo" />}>
                  <UserPlus className="size-4" />
                  Novo Paciente
                </Button>
              ) : undefined
            }
          />
        ) : (
          <PatientTable patients={patients} userRole={userRole} />
        )}
      </main>
    </>
  )
}
