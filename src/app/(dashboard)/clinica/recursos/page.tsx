/**
 * /clinica/recursos — Resources list page (RSC)
 *
 * RES-01: Lists all active resources (not soft-deleted) for the tenant.
 * Status badges use tokens:
 *   ativo       → text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 (positive)
 *   manutencao  → text-amber-700  bg-amber-100  dark:text-amber-400  dark:bg-amber-900/30  (warning)
 *   inativo     → text-muted-foreground bg-muted (muted)
 *
 * Read-only roles (x-read-only header) see the list but no mutation CTAs.
 * Tenant resolved via x-user-id header (middleware sets this).
 */
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'

// ─── Status badge helper ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30">
        Ativo
      </span>
    )
  }
  if (status === 'manutencao') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30">
        Manutenção
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground bg-muted">
      Inativo
    </span>
  )
}

// ─── Tipo pt-BR label ────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  sala: 'Sala',
  cadeira: 'Cadeira',
  equipamento: 'Equipamento',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RecursosPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? ''
  const isReadOnly = headersList.get('x-read-only') === 'true'

  const supabase = await createClient()

  // Resolve tenant
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = actor?.tenant_id ?? ''

  // Fetch resources — tenant-scoped, not soft-deleted
  const { data: resources } = tenantId
    ? await supabase
        .from('resources')
        .select('id, nome, tipo, patrimonio, status, unit_id')
        .eq('clinic_id', tenantId)
        .is('deleted_at', null)
        .order('nome', { ascending: true })
    : { data: [] }

  const rows = resources ?? []

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Recursos"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Recursos' },
        ]}
        actions={
          !isReadOnly ? (
            <Button size="sm" render={<Link href="/clinica/recursos/novo" />}>
              <Plus className="size-4" />
              Novo Recurso
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <EmptyState
            icon={Wrench}
            title="Nenhum recurso cadastrado"
            description="Cadastre salas, cadeiras e equipamentos para controlar a disponibilidade na agenda."
            cta={
              !isReadOnly ? (
                <Button size="sm" render={<Link href="/clinica/recursos/novo" />}>
                  <Plus className="size-4" />
                  Novo Recurso
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="rounded-lg border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Patrimônio</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                  {!isReadOnly && (
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((resource) => (
                  <tr
                    key={resource.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{resource.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TIPO_LABEL[resource.tipo] ?? resource.tipo}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {resource.patrimonio ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={resource.status} />
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/clinica/recursos/${resource.id}`} />}
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
        </div>
      )}
    </div>
  )
}
