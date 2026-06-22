import { headers } from 'next/headers'
import { CreditCard, Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listPayables } from '@/actions/payables'
import { listSuppliers } from '@/actions/suppliers'
import { listBankAccounts } from '@/actions/bank-accounts'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import { listCostCenters } from '@/actions/cost-centers'
import { listUnits } from '@/actions/units'
import { formatBRL } from '@/lib/format/money'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PayablesTable } from '@/components/financeiro/PayablesTable'
import { PayableFormDialog } from '@/components/financeiro/PayableFormDialog'
import type { AccountNode } from '@/lib/financeiro/chart-tree'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenToLeaves(
  nodes: AccountNode[]
): { id: string; name: string; code: string; type: string }[] {
  const leaves: { id: string; name: string; code: string; type: string }[] = []
  for (const node of nodes) {
    if (node.type !== 'grupo' && node.ativo) {
      leaves.push({ id: node.id, name: node.name, code: node.code, type: node.type })
    }
    if (node.children.length > 0) {
      leaves.push(...flattenToLeaves(node.children))
    }
  }
  return leaves
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// RSC — reads role/readOnly from proxy headers (D-23).
// KPI derivation: 'vencido' computed at read-time (D-04 pattern).

interface ContasAPagarPageProps {
  searchParams: Promise<{
    status?: string
    supplier?: string
    from?: string
    to?: string
    unit?: string
  }>
}

export default async function ContasAPagarPage({ searchParams }: ContasAPagarPageProps) {
  const hdrs = await headers()
  const role = hdrs.get('x-user-role') ?? 'receptionist'
  const readOnly = hdrs.get('x-read-only') === 'true'
  const canWrite = !readOnly

  const params = await searchParams
  const today = new Date()

  // Parallel data fetch
  const [payablesResult, suppliersResult, bankAccountsResult, accountsTreeResult, costCentersResult, unitsResult] =
    await Promise.all([
      listPayables({
        status: params.status || null,
        supplierId: params.supplier || null,
        from: params.from || null,
        to: params.to || null,
        unitId: params.unit || null,
      }),
      listSuppliers(),
      listBankAccounts(),
      listAccountsTree(),
      listCostCenters(),
      listUnits(),
    ])

  const payables = payablesResult.success ? (payablesResult.payables ?? []) : []
  const suppliers = suppliersResult.success ? (suppliersResult.suppliers ?? []) : []
  const bankAccounts = bankAccountsResult.success
    ? (bankAccountsResult.accounts ?? []).filter((ba) => ba.ativo)
    : []
  const leafAccounts = accountsTreeResult.success
    ? flattenToLeaves(accountsTreeResult.tree ?? [])
    : []
  const costCenters = costCentersResult.success
    ? (costCentersResult.centers ?? []).filter((cc) => cc.ativo)
    : []
  const units = unitsResult.success ? (unitsResult.units ?? []) : []

  // ── KPI derivation (D-04 pattern: vencido = past due_date AND !pago/!cancelado) ──
  let aVencer = 0
  let vencido = 0
  let pagoNoMes = 0

  const nowMs = today.getTime()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).getTime()

  for (const p of payables) {
    if (p.status === 'cancelado') continue

    for (const inst of p.installments ?? []) {
      if (inst.status === 'cancelado') continue

      if (inst.status === 'pago') {
        // Check if paid this month (use due_date as proxy; ideal = paid_at but not available here)
        const dueMs = new Date(inst.due_date).getTime()
        if (dueMs >= firstOfMonth && dueMs <= lastOfMonth) {
          pagoNoMes += inst.valor
        }
        continue
      }

      const dueMs = new Date(inst.due_date).getTime()
      if (dueMs < nowMs) {
        // Overdue
        vencido += inst.valor - (inst.valor_pago ?? 0)
      } else {
        // Not yet due
        aVencer += inst.valor - (inst.valor_pago ?? 0)
      }
    }
  }

  // ── Header actions ────────────────────────────────────────────────────────
  const headerActions = canWrite ? (
    <PayableFormDialog
      mode="create"
      suppliers={suppliers}
      leafAccounts={leafAccounts}
      costCenters={costCenters}
      units={units}
    >
      <Button size="sm">
        <Plus className="size-4" />
        Nova Conta a Pagar
      </Button>
    </PayableFormDialog>
  ) : null

  return (
    <NuqsAdapter>
      <PageHeader
        title="Contas a Pagar"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Contas a Pagar' },
        ]}
        actions={headerActions}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Error state */}
        {!payablesResult.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {payablesResult.error ?? 'Erro ao carregar contas a pagar. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Row — 3 cards mirroring CashFlowTotals */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="min-h-[72px]" aria-label={`A Vencer: ${formatBRL(aVencer)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                A Vencer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-foreground">
                {formatBRL(aVencer)}
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[72px]" aria-label={`Vencido: ${formatBRL(vencido)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Vencido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-red-600">
                {vencido > 0 ? `−${formatBRL(vencido)}` : formatBRL(vencido)}
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[72px]" aria-label={`Pago no Mês: ${formatBRL(pagoNoMes)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Pago no Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-tight tabular-nums text-green-700">
                {formatBRL(pagoNoMes)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table or empty state */}
        {payables.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma conta a pagar"
            description="Cadastre a primeira conta para controlar os pagamentos."
            cta={
              canWrite ? (
                <PayableFormDialog
                  mode="create"
                  suppliers={suppliers}
                  leafAccounts={leafAccounts}
                  costCenters={costCenters}
                  units={units}
                >
                  <Button size="sm">
                    <Plus className="size-4" />
                    Nova Conta a Pagar
                  </Button>
                </PayableFormDialog>
              ) : undefined
            }
          />
        ) : (
          <PayablesTable
            payables={payables}
            suppliers={suppliers}
            bankAccounts={bankAccounts}
            leafAccounts={leafAccounts}
            costCenters={costCenters}
            units={units}
            canWrite={canWrite}
            role={role}
          />
        )}
      </main>
    </NuqsAdapter>
  )
}
