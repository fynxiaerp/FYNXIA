/**
 * /clinica/recursos/[id] — Resource edit page (RSC)
 * /clinica/recursos/novo  — Resource create page (sentinel id='novo')
 *
 * RES-01: Renders ResourceForm pre-filled with existing resource data (edit)
 *         or blank (create). Units list is fetched server-side and passed as
 *         plain data to the client form component.
 *
 * Sentinel: id='novo' → create mode (no resource fetched).
 * Any other id → fetch resource, 404 if not found or wrong tenant.
 */
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { ResourceForm } from '@/components/resources/ResourceForm'

interface RecursoPageProps {
  params: Promise<{ id: string }>
}

export default async function RecursoPage({ params }: RecursoPageProps) {
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

  if (isNew) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title="Novo Recurso"
          breadcrumbs={[
            { label: 'Clínica', href: '/clinica' },
            { label: 'Recursos', href: '/clinica/recursos' },
            { label: 'Novo Recurso' },
          ]}
        />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <ResourceForm mode="create" units={units} />
          </div>
        </div>
      </div>
    )
  }

  // Edit mode — fetch the resource
  const { data: resource } = await supabase
    .from('resources')
    .select(
      'id, nome, tipo, unit_id, patrimonio, numero_serie, status, manutencao_prevista'
    )
    .eq('id', id)
    .eq('clinic_id', tenantId)
    .is('deleted_at', null)
    .single()

  if (!resource) {
    notFound()
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Editar Recurso"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Recursos', href: '/clinica/recursos' },
          { label: resource.nome },
        ]}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl">
          <ResourceForm
            mode="edit"
            resourceId={resource.id}
            units={units}
            defaultValues={{
              nome: resource.nome,
              tipo: resource.tipo as 'sala' | 'cadeira' | 'equipamento',
              unit_id: resource.unit_id,
              patrimonio: resource.patrimonio ?? '',
              numero_serie: resource.numero_serie ?? '',
              status: resource.status as 'ativo' | 'manutencao' | 'inativo',
              manutencao_prevista: resource.manutencao_prevista ?? '',
            }}
          />
        </div>
      </div>
    </div>
  )
}
