import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'

export default async function ProfissionaisPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? ''
  const isReadOnly = headersList.get('x-read-only') === 'true'

  const supabase = await createClient()

  // Resolve actor tenant
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = actor?.tenant_id ?? ''

  // Fetch professionals for this tenant (excluding soft-deleted)
  const { data: professionals } = tenantId
    ? await supabase
        .from('professionals')
        .select('id, full_name, cro, cro_uf, vinculo, especialidades, ativo')
        .eq('clinic_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const rows = professionals ?? []

  const vinculos: Record<string, string> = {
    clt: 'CLT',
    pj: 'PJ',
    autonomo: 'Autônomo',
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Profissionais"
        breadcrumbs={[{ label: 'Clínica' }, { label: 'Profissionais' }]}
        actions={
          !isReadOnly ? (
            <Button size="sm" render={<Link href="/clinica/profissionais/novo" />}>
              <Plus />
              Novo Profissional
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 p-6">
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <EmptyState
              icon={Users}
              title="Nenhum profissional cadastrado"
              description="Cadastre os dentistas e profissionais da clínica para habilitar agendamentos."
              cta={
                !isReadOnly ? (
                  <Button render={<Link href="/clinica/profissionais/novo" />}>
                    <Plus />
                    Cadastrar Profissional
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-semibold text-foreground">Nome</th>
                  <th className="pb-2 pr-4 font-semibold text-foreground">CRO / UF</th>
                  <th className="pb-2 pr-4 font-semibold text-foreground">Vínculo</th>
                  <th className="pb-2 pr-4 font-semibold text-foreground">Especialidades</th>
                  <th className="pb-2 pr-4 font-semibold text-foreground">Status</th>
                  {!isReadOnly && (
                    <th className="pb-2 font-semibold text-foreground">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((pro) => (
                  <tr key={pro.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {pro.full_name}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {pro.cro}/{pro.cro_uf}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {vinculos[pro.vinculo] ?? pro.vinculo}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {(pro.especialidades ?? []).length > 0
                        ? pro.especialidades.join(', ')
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          pro.ativo
                            ? 'text-xs font-medium text-foreground'
                            : 'text-xs font-medium text-muted-foreground'
                        }
                      >
                        {pro.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {!isReadOnly && (
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/clinica/profissionais/${pro.id}`} />}
                        >
                          Editar
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
