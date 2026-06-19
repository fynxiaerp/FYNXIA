/**
 * /clinica/protese — Lista de Ordens de Serviço Protéticas (RSC)
 *
 * Gated pelo módulo 'protese' em proxy.ts MODULE_PERMISSIONS (Plan 06):
 *   - admin/superadmin/dentist: escrita (abrir OS, alterar status/custo)
 *   - auditor/dpo/socio: somente leitura (sem CTAs de mutação)
 *   - receptionist e demais: bloqueados pelo middleware
 *
 * Server Component — auth + read-only resolvidos no servidor.
 * runtime 'nodejs': Supabase + Server Actions requerem Node.js (não Edge).
 *
 * Colunas da tabela:
 *   N.º OS | Paciente | Laboratório | Tipo | Prazo | Status | Financeiro
 *
 * Por linha: LabOrderStatusBar (controle de status + custo) em expansão inline
 * (client wrapper separado para manter a página como Server Component puro).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 * Requirements: LAB-01, LAB-02
 */

import Link from 'next/link'
import { headers } from 'next/headers'
import { Boxes, CheckCircle2, Minus } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listLabOrders, listLabs } from '@/actions/lab-orders'
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
import { LabOrderFormDialog } from '@/components/protese/LabOrderFormDialog'
import { LabOrderStatusBarDialog } from '@/components/protese/LabOrderStatusBarDialog'
import type { LabOption, PatientOption } from '@/components/protese/LabOrderForm'

export const runtime = 'nodejs'

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

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function statusBadge(status: string): { label: string; variant: BadgeVariant; className: string } {
  switch (status) {
    case 'enviado':
      return { label: 'Enviado', variant: 'secondary', className: 'text-muted-foreground' }
    case 'prova':
      return {
        label: 'Em Prova',
        variant: 'outline',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
      }
    case 'concluido':
      return {
        label: 'Concluído',
        variant: 'default',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0',
      }
    default:
      return { label: status, variant: 'secondary', className: '' }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProtesePage() {
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

  // Fetch patients
  const { data: patientsRaw } = tenantId
    ? await supabase
        .from('patients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
    : { data: [] }

  const patients: PatientOption[] = (patientsRaw ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }))

  const patientMap = new Map(patients.map((p) => [p.id, p.full_name]))

  // Fetch labs
  const labsResult = await listLabs()
  const labsRaw = labsResult.success ? (labsResult.data ?? []) : []
  const labs: LabOption[] = labsRaw.map((l) => ({
    id: String(l.id),
    nome: String(l.nome),
  }))
  const labMap = new Map(labs.map((l) => [l.id, l.nome]))

  // Fetch lab orders
  const ordersResult = await listLabOrders()
  const orders = ordersResult.success ? (ordersResult.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Laboratório de Prótese"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Laboratório de Prótese' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <LabOrderFormDialog labs={labs} patients={patients} appointments={[]} />
            )}
            <Button size="sm" variant="outline" render={<Link href="/clinica/protese/laboratorios" />}>
              Laboratórios
            </Button>
          </div>
        }
      />

      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Acesso somente leitura. Seu papel não permite abrir ou alterar ordens de serviço.
          </div>
        )}

        {orders.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhuma ordem de serviço"
            description="Abra uma OS protética para enviar ao laboratório e acompanhar o status e o custo de cada trabalho."
            cta={
              !isReadOnly ? (
                <LabOrderFormDialog labs={labs} patients={patients} appointments={[]} />
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º OS</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Laboratório</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financeiro</TableHead>
                  {!isReadOnly && <TableHead className="w-[100px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const status = String(order.status ?? 'enviado')
                  const badge = statusBadge(status)
                  const hasFinancial = Boolean(order.financial_transaction_id)
                  const orderId = String(order.id)
                  const labName = labMap.get(String(order.lab_id)) ?? '—'

                  return (
                    <TableRow key={orderId}>
                      <TableCell className="font-mono text-sm">
                        {String(order.order_number ?? '—')}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {patientMap.get(String(order.patient_id)) ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{labName}</TableCell>
                      <TableCell className="text-sm">{String(order.prosthesis_type ?? '—')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(order.due_date as string | null)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasFinancial ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="size-3.5" />
                            Lançado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3.5" />
                            —
                          </span>
                        )}
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <LabOrderStatusBarDialog
                            order={{
                              id: orderId,
                              status: status as 'enviado' | 'prova' | 'concluido',
                              cost: order.cost as number | null,
                              financial_transaction_id: order.financial_transaction_id as string | null,
                              lab_name: labName,
                              prosthesis_type: String(order.prosthesis_type ?? ''),
                              order_number: order.order_number as string | null,
                            }}
                          />
                        </TableCell>
                      )}
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
