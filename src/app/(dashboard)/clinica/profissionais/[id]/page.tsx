/**
 * /clinica/profissionais/[id] — Professional edit page (RSC)
 * /clinica/profissionais/novo  — Professional create page (sentinel id='novo')
 *
 * PRO-01: Renders ProfessionalForm (tabbed: Ficha + Horários + Comissão) pre-filled
 *         with existing professional data (edit) or blank (create).
 * PRO-03: commission_rules loaded from JSONB and passed to form for editing — stored only.
 *
 * Sentinel: id='novo' → create mode (no professional fetched).
 * Any other id → fetch professional + availability + exceptions, 404 if not found / wrong tenant.
 */
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { ProfessionalForm } from '@/components/professionals/ProfessionalForm'
import type { ProfessionalInput, AvailabilityWindowInput, AvailabilityExceptionInput, CommissionRules } from '@/lib/validators/professional'

interface ProfissionalPageProps {
  params: Promise<{ id: string }>
}

export default async function ProfissionalPage({ params }: ProfissionalPageProps) {
  const { id } = await params
  const isNew = id === 'novo'

  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? ''

  const supabase = await createClient()

  // Resolve tenant
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = actor?.tenant_id ?? ''

  // Fetch units for the unit_id Select
  const { data: unitRows } = tenantId
    ? await supabase
        .from('units')
        .select('id, name')
        .eq('clinic_id', tenantId)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('name', { ascending: true })
    : { data: [] }

  const units = (unitRows ?? []).map((u) => ({ id: u.id, name: u.name }))

  // Fetch dentist users for the login Select
  const { data: dentistRows } = tenantId
    ? await supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('role', 'dentist')
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const dentistUsers = (dentistRows ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name ?? '',
  }))

  if (isNew) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title="Novo Profissional"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Profissionais', href: '/clinica/profissionais' },
            { label: 'Novo Profissional' },
          ]}
        />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <ProfessionalForm
              mode="create"
              units={units}
              dentistUsers={dentistUsers}
            />
          </div>
        </div>
      </div>
    )
  }

  // Edit mode — fetch the professional
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, full_name, cro, cro_uf, especialidades, vinculo, unit_id, user_id, commission_rules, ativo')
    .eq('id', id)
    .eq('clinic_id', tenantId)
    .is('deleted_at', null)
    .single()

  if (!professional) {
    notFound()
  }

  // Fetch availability grade
  const { data: availabilityRows } = await supabase
    .from('professional_availability')
    .select('weekday, start_time, end_time')
    .eq('professional_id', id)
    .eq('clinic_id', tenantId)

  // Fetch exceptions
  const { data: exceptionRows } = await supabase
    .from('professional_availability_exceptions')
    .select('exception_date, exception_type, start_time, end_time, reason')
    .eq('professional_id', id)
    .eq('clinic_id', tenantId)
    .order('exception_date', { ascending: true })

  const defaultValues: Partial<ProfessionalInput> = {
    full_name: professional.full_name,
    cro: professional.cro,
    cro_uf: professional.cro_uf,
    especialidades: professional.especialidades ?? [],
    vinculo: professional.vinculo as 'clt' | 'pj' | 'autonomo',
    unit_id: professional.unit_id ?? undefined,
    user_id: professional.user_id ?? null,
    commission_rules: (professional.commission_rules ?? []) as CommissionRules,
    ativo: professional.ativo,
  }

  const defaultAvailability: AvailabilityWindowInput[] = (availabilityRows ?? []).map((w) => ({
    weekday: w.weekday,
    start_time: w.start_time,
    end_time: w.end_time,
  }))

  const defaultExceptions: AvailabilityExceptionInput[] = (exceptionRows ?? []).map((e) => ({
    exception_date: e.exception_date,
    exception_type: e.exception_type as 'folga' | 'extra',
    start_time: e.start_time ?? null,
    end_time: e.end_time ?? null,
    reason: e.reason ?? null,
  }))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Editar Profissional"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Profissionais', href: '/clinica/profissionais' },
          { label: professional.full_name },
        ]}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl">
          <ProfessionalForm
            mode="edit"
            professionalId={professional.id}
            units={units}
            dentistUsers={dentistUsers}
            defaultValues={defaultValues}
            defaultAvailability={defaultAvailability}
            defaultExceptions={defaultExceptions}
          />
        </div>
      </div>
    </div>
  )
}
