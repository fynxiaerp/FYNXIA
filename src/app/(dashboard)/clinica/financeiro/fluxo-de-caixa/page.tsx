import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listTransactions, listCategories } from '@/actions/transactions'
import { listCategoriesWithAccounts } from '@/actions/categories'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import { listCostCenters } from '@/actions/cost-centers'
import { listBankAccounts } from '@/actions/bank-accounts'
import { listUnits } from '@/actions/units'
import { CashFlowTotals } from '@/components/financeiro/CashFlowTotals'
import { TransactionList } from '@/components/financeiro/TransactionList'
import { TransactionModal } from '@/components/financeiro/TransactionModal'
import { CashFlowFilters } from '@/components/financeiro/CashFlowFilters'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AccountNode } from '@/lib/financeiro/chart-tree'

// ─── Cash Flow Page ───────────────────────────────────────────────────────────
// FIN-01: Server Component. Month navigation via ?month=YYYY-MM (nuqs URL state).
// FCAD-02: unit/CC filter via ?unit=<id>&cc=<id> (nuqs URL state via CashFlowFilters).
// Renders CashFlowTotals (primary focal point) + TransactionList.
// "+ Lançamento" opens TransactionModal with classification fields (FCAD-02).

interface CashFlowPageProps {
  searchParams: Promise<{ month?: string; unit?: string; cc?: string }>
}

function prevMonth(month: string): string {
  const parts = month.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextMonth(month: string): string {
  const parts = month.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function formatMonthLabel(month: string): string {
  try {
    const parts = month.split('-')
    const y = parseInt(parts[0] ?? '2026', 10)
    const m = parseInt(parts[1] ?? '1', 10)
    const date = new Date(y, m - 1, 1)
    return format(date, 'MMMM yyyy', { locale: ptBR })
  } catch {
    return month
  }
}

// Flatten AccountNode tree to leaf accounts (type !== 'grupo', ativo = true)
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

export default async function FluxoDeCaixaPage({ searchParams }: CashFlowPageProps) {
  const params = await searchParams
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7)
  const filterCostCenterId = params.cc
  const filterUnitId = params.unit

  // Fetch transactions with optional CC/unit filter (FCAD-02 SC2)
  const [txResult, catWithAccountsResult, accountsTreeResult, costCentersResult, bankAccountsResult, unitsResult] =
    await Promise.all([
      listTransactions(currentMonth, {
        costCenterId: filterCostCenterId,
        unitId: filterUnitId,
      }),
      listCategoriesWithAccounts(),
      listAccountsTree(),
      listCostCenters(),
      listBankAccounts(),
      listUnits(),
    ])

  const transactions = txResult.success ? (txResult.transactions ?? []) : []
  const totals = txResult.success
    ? (txResult.totals ?? { entradas: 0, saidas: 0, saldo: 0 })
    : { entradas: 0, saidas: 0, saldo: 0 }

  // Categories with account_id for auto-fill in TransactionModal
  const categoriesWithAccounts = catWithAccountsResult.success
    ? (catWithAccountsResult.categories ?? [])
    : []

  // Leaf accounts for Conta Contábil selector
  const leafAccounts = accountsTreeResult.success
    ? flattenToLeaves(accountsTreeResult.tree ?? [])
    : []

  // Active cost centers for Centro de Custo selector
  const allCostCenters = costCentersResult.success ? (costCentersResult.centers ?? []) : []
  const activeCostCenters = allCostCenters.filter((cc) => cc.ativo)

  // Bank accounts for optional Conta Corrente selector
  const bankAccounts = bankAccountsResult.success
    ? (bankAccountsResult.accounts ?? []).filter((ba) => ba.ativo)
    : []

  // Units for CashFlowFilters
  const units = unitsResult.success
    ? (unitsResult.units ?? []).map((u) => ({ id: u.id, name: u.name }))
    : []

  // Default CC: first is_default CC (for pre-selecting Centro de Custo in modal)
  const defaultCC = activeCostCenters.find((cc) => cc.is_default) ?? activeCostCenters[0]

  // Build categories list for the old TransactionList (needs only id/name/type)
  // Also fetch them from the categories-with-accounts result (same data)
  const categories = categoriesWithAccounts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }))

  const monthLabel = formatMonthLabel(currentMonth)
  const prev = prevMonth(currentMonth)
  const next = nextMonth(currentMonth)

  // Build month href — preserve unit/cc filters on month navigation
  function monthHref(m: string): string {
    const p = new URLSearchParams()
    p.set('month', m)
    if (filterUnitId) p.set('unit', filterUnitId)
    if (filterCostCenterId) p.set('cc', filterCostCenterId)
    return `?${p.toString()}`
  }

  const monthActions = (
    <div className="flex items-center gap-2">
      {/* Month navigation — @base-ui/react Button uses render prop (no asChild) */}
      <Button
        variant="outline"
        size="sm"
        render={<Link href={monthHref(prev)} aria-label="Mês anterior" />}
      >
        <ChevronLeft className="size-4" />
        Mês ant.
      </Button>
      <span className="min-w-[120px] text-center text-sm font-semibold capitalize">
        {monthLabel}
      </span>
      <Button
        variant="outline"
        size="sm"
        render={<Link href={monthHref(next)} aria-label="Próximo mês" />}
      >
        Próx.
        <ChevronRight className="size-4" />
      </Button>
      <TransactionModal
        categories={categoriesWithAccounts}
        leafAccounts={leafAccounts}
        costCenters={activeCostCenters}
        bankAccounts={bankAccounts}
        defaultCostCenterId={defaultCC?.id}
      >
        <Button size="sm">
          <Plus className="size-4" />
          Lançamento
        </Button>
      </TransactionModal>
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader
        title="Fluxo de Caixa"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Fluxo de Caixa' },
        ]}
        actions={monthActions}
      />
      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Error state */}
        {!txResult.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {txResult.error ?? 'Erro ao carregar transações.'}
            </AlertDescription>
          </Alert>
        )}

        {/* FCAD-02 SC2: unit/CC filters */}
        <CashFlowFilters units={units} costCenters={activeCostCenters} />

        {/* Primary focal point: cash flow totals */}
        <CashFlowTotals
          entradas={totals.entradas}
          saidas={totals.saidas}
          saldo={totals.saldo}
        />

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={`Nenhum lançamento em ${monthLabel}`}
            description="Lance a primeira transação do mês usando o botão acima."
          />
        ) : (
          <TransactionList transactions={transactions} categories={categories} />
        )}
      </main>
    </NuqsAdapter>
  )
}
