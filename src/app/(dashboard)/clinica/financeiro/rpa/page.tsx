import { headers } from 'next/headers'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { FileText } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CompetenciaSelector } from '@/components/financeiro/CompetenciaSelector'
import { RpaTable } from '@/components/financeiro/RpaTable'
import { RpaPageActions } from '@/components/financeiro/RpaPageActions'
import { listRpas } from '@/actions/rpa'
import { listSuppliers } from '@/actions/suppliers'
import { listPayables } from '@/actions/payables'
import { formatBRL } from '@/lib/format/money'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── RPA Page (RSC) ────────────────────────────────────────────────────────────
// TRIB-02: RPA & Tributos por competência.
// Read role/x-read-only → canWrite gate (D-23).

interface RpaPageProps {
  searchParams: Promise<{ competencia?: string; unit?: string; supplier?: string }>
}

export default async function RpaPage({ searchParams }: RpaPageProps) {
  const params = await searchParams
  const competencia = params.competencia ?? new Date().toISOString().slice(0, 7)
  const unitId = params.unit
  const defaultSupplierId = params.supplier

  // D-23: read-only gate
  const headersList = await headers()
  const role = headersList.get('x-user-role') ?? 'receptionist'
  const readOnly = headersList.get('x-read-only') === 'true'
  const canWrite = !readOnly && (role === 'admin' || role === 'superadmin' || role === 'financeiro')

  // Load data in parallel
  const [rpasResult, suppliersResult, tributosResult] = await Promise.all([
    listRpas({ competencia }),
    listSuppliers({ tipo: 'autonomo' }),
    listPayables({ status: 'pendente' }),
  ])

  type RpaRecord = {
    id: string
    numero: string
    competencia: string
    data_pagamento: string
    valor_bruto: number
    valor_inss: number
    valor_irrf: number
    valor_iss: number
    valor_liquido: number
    status: string
    supplier_id: string | null
    unit_id: string | null
  }

  type SupplierRecord = {
    id: string
    name: string
    tipo?: string
    iss_retido_fonte?: boolean
  }

  type PayableRecord = {
    id: string
    descricao: string
    valor_total: number
    status: string
    origem: string
    competencia: string | null
    supplier_name: string | null
    installments: { id: string; numero: number; valor: number; due_date: string; status: string; valor_pago: number | null }[]
  }

  const rpas = (rpasResult.rpas ?? []) as RpaRecord[]
  const suppliers = (suppliersResult.suppliers ?? []) as SupplierRecord[]
  const allPayables = (tributosResult.payables ?? []) as PayableRecord[]

  // Filter tributos: origem='tributo' for current competencia
  const tributos = allPayables.filter(
    (p) => p.origem === 'tributo' && p.competencia === competencia,
  )

  // KPI aggregates
  const totalInss = rpas.reduce((s, r) => s + r.valor_inss, 0)
  const totalIrrf = rpas.reduce((s, r) => s + r.valor_irrf, 0)

  // Month label for section heading
  function formatMes(comp: string): string {
    const parts = comp.split('-')
    const y = parseInt(parts[0] ?? '2026', 10)
    const m = parseInt(parts[1] ?? '1', 10)
    const date = new Date(y, m - 1, 1)
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  }

  const mesLabel = formatMes(competencia)

  // Capitalize first letter
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)

  return (
    <NuqsAdapter>
      <PageHeader
        title="RPA & Tributos"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'RPA & Tributos' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <CompetenciaSelector />
            {canWrite && (
              <RpaPageActions
                suppliers={suppliers}
                unitId={unitId}
                defaultSupplierId={defaultSupplierId}
                defaultCompetencia={competencia}
              />
            )}
          </div>
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {rpasResult.error && (
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar RPAs. Tente novamente.
            </AlertDescription>
          </Alert>
        )}

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              RPAs Emitidos
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {rpas.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              INSS Total
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatBRL(totalInss)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              IRRF Total
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatBRL(totalIrrf)}
            </p>
          </div>
        </div>

        {/* RPA table or empty state */}
        {rpas.length > 0 ? (
          <RpaTable rows={rpas} canWrite={canWrite} />
        ) : !rpasResult.error ? (
          <EmptyState
            icon={FileText}
            title="Nenhum RPA emitido"
            description="Emita o primeiro RPA para um autônomo nesta competência."
          />
        ) : null}

        {/* Tributos a Recolher section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            Obrigações a Recolher — {mesLabelCap}
          </h2>
          {tributos.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tributos.map((t) => {
                    const installment = t.installments[0]
                    const dueDate = installment?.due_date
                    const formattedDue = dueDate
                      ? format(parseISO(dueDate), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'
                    const isPago = t.status === 'pago'
                    return (
                      <tr key={t.id} className="border-t border-border">
                        <td className="px-4 py-3">{t.descricao}</td>
                        <td className="px-4 py-3 tabular-nums">{formattedDue}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatBRL(t.valor_total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                              isPago
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isPago ? 'Recolhido' : 'A Recolher'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canWrite && !isPago && (
                            <a
                              href={`/clinica/financeiro/contas-a-pagar?highlight=${t.id}`}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              Baixar
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma obrigação tributária a recolher nesta competência.
            </p>
          )}
        </div>
      </main>
    </NuqsAdapter>
  )
}
