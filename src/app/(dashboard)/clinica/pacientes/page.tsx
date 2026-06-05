import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PatientTable } from '@/components/patients/PatientTable'
import { buttonVariants } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function PacientesPage() {
  const headersList = await headers()
  const userRole = headersList.get('x-user-role') ?? 'receptionist'
  const userId = headersList.get('x-user-id') ?? ''

  const supabase = await createClient()

  // Get actor's tenant_id
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

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
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os pacientes da sua clínica
          </p>
        </div>
        {isStaff && (
          <Link
            href="/clinica/pacientes/novo"
            className={cn(buttonVariants({ variant: 'default' }), 'inline-flex items-center gap-2')}
          >
            <UserPlus className="h-4 w-4" />
            Novo Paciente
          </Link>
        )}
      </div>

      {!patients || patients.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-base font-semibold text-muted-foreground">
            Nenhum paciente cadastrado
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre o primeiro paciente da clínica para começar o atendimento.
          </p>
          {isStaff && (
            <Link
              href="/clinica/pacientes/novo"
              className={cn(buttonVariants({ variant: 'default' }), 'mt-4 inline-flex items-center gap-2')}
            >
              <UserPlus className="h-4 w-4" />
              Novo Paciente
            </Link>
          )}
        </div>
      ) : (
        <PatientTable patients={patients} userRole={userRole} />
      )}
    </div>
  )
}
