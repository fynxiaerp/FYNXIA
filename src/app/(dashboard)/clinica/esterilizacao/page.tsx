/**
 * /clinica/esterilizacao — Esterilização / CME list page (RSC)
 *
 * Gated pelo módulo 'esterilizacao' em proxy.ts MODULE_PERMISSIONS (Plan 06):
 *   - admin/superadmin/dentist/receptionist: acesso de escrita
 *   - auditor/dpo/socio: somente leitura (sem CTA de registro)
 *   - outros papéis: bloqueados pelo middleware
 *
 * Server Component — auth + read-only resolvidos no servidor.
 * Header x-read-only definido pelo middleware (proxy.ts).
 * runtime 'nodejs': Server Actions + Supabase requerem Node.js (não Edge).
 *
 * Fontes de dados:
 *   - listSterilizationCycles: ciclos tenant-scoped ordenados por data DESC
 *   - resources WHERE tipo='equipamento': mapa de id→nome para o CycleForm
 *
 * CTA "Registrar Ciclo" abre Dialog com CycleForm (Client Component).
 * Badge de status: aprovado=success, reprovado=destructive, vencido=warning, pendente=muted.
 * Papéis somente leitura não veem o CTA de registro.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 06
 * Requirements: CME-01, CME-02, CME-03
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { ShieldCheck, Plus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listSterilizationCycles } from '@/actions/sterilization'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CycleFormDialog } from '@/components/esterilizacao/CycleFormDialog'

export const runtime = 'nodejs'

// ─── Status badge ─────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function statusBadge(status: string): { label: string; variant: BadgeVariant; className: string } {
  switch (status) {
    case 'aprovado':
      return {
        label: 'Aprovado',
        variant: 'default',
        className:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0',
      }
    case 'reprovado':
      return { label: 'Reprovado', variant: 'destructive', className: '' }
    case 'vencido':
      return {
        label: 'Vencido',
        variant: 'outline',
        className:
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
      }
    case 'pendente':
    default:
      return { label: 'Pendente', variant: 'secondary', className: 'text-muted-foreground' }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const BIO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EsterilizacaoPage() {
  const headerStore = await headers()
  const userId = headerStore.get('x-user-id') ?? ''
  const isReadOnly = headerStore.get('x-read-only') === 'true'

  const supabase = await createClient()

  // Resolve tenant
  const { data: actor } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  const tenantId = actor?.tenant_id ?? ''

  // Fetch autoclaves (resources of tipo 'equipamento') for the CycleForm combobox
  const { data: resources } = tenantId
    ? await supabase
        .from('resources')
        .select('id, nome')
        .eq('clinic_id', tenantId)
        .eq('tipo', 'equipamento')
        .is('deleted_at', null)
        .order('nome', { ascending: true })
    : { data: [] }

  const autoclaves = (resources ?? []).map((r) => ({ id: r.id, nome: r.nome }))

  // Fetch sterilization cycles
  const cyclesResult = await listSterilizationCycles()
  const cycles = cyclesResult.success ? (cyclesResult.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Esterilização / CME"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Esterilização' },
        ]}
        actions={
          !isReadOnly ? (
            <div className="flex items-center gap-2">
              <CycleFormDialog autoclaves={autoclaves} />
              <Button size="sm" variant="outline" render={<Link href="/clinica/esterilizacao/uso-kit" />}>
                Uso de Kit
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" render={<Link href="/clinica/esterilizacao/uso-kit" />}>
              Rastreabilidade
            </Button>
          )
        }
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Acesso somente leitura. Seu papel não permite registrar ciclos de esterilização.
          </div>
        )}

        {cycles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum ciclo registrado"
            description="Registre ciclos de esterilização em autoclave com o indicador biológico para garantir a segurança do paciente (CME-01)."
            cta={
              !isReadOnly ? (
                <CycleFormDialog autoclaves={autoclaves} />
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º Ciclo</TableHead>
                  <TableHead>Data do Ciclo</TableHead>
                  <TableHead>Indicador Biológico</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => {
                  const status = String(cycle.status ?? 'pendente')
                  const badge = statusBadge(status)
                  return (
                    <TableRow key={String(cycle.id)}>
                      <TableCell className="font-mono text-sm">
                        {String(cycle.cycle_number ?? '—')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(cycle.cycle_date as string | null)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {BIO_LABELS[String(cycle.biological_result)] ?? String(cycle.biological_result)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cycle.validade as string | null)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  )
}
