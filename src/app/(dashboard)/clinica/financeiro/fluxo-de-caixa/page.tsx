import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listTransactions, listCategories } from '@/actions/transactions'
import { CashFlowTotals } from '@/components/financeiro/CashFlowTotals'
import { TransactionList } from '@/components/financeiro/TransactionList'
import { TransactionModal } from '@/components/financeiro/TransactionModal'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Cash Flow Page ───────────────────────────────────────────────────────────
// FIN-01: Server Component. Month navigation via ?month=YYYY-MM (nuqs URL state).
// Renders CashFlowTotals (primary focal point) + TransactionList.
// "+ Lançamento" opens TransactionModal (FIN-02).

interface CashFlowPageProps {
  searchParams: Promise<{ month?: string }>
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

export default async function FluxoDeCaixaPage({ searchParams }: CashFlowPageProps) {
  const params = await searchParams
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7)

  const [txResult, catResult] = await Promise.all([
    listTransactions(currentMonth),
    listCategories(),
  ])

  const transactions = txResult.success ? (txResult.transactions ?? []) : []
  const totals = txResult.success
    ? (txResult.totals ?? { entradas: 0, saidas: 0, saldo: 0 })
    : { entradas: 0, saidas: 0, saldo: 0 }
  const categories = catResult.success ? (catResult.categories ?? []) : []

  const monthLabel = formatMonthLabel(currentMonth)
  const prev = prevMonth(currentMonth)
  const next = nextMonth(currentMonth)

  const monthActions = (
    <div className="flex items-center gap-2">
      {/* Month navigation — @base-ui/react Button uses render prop (no asChild) */}
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`?month=${prev}`} aria-label="Mês anterior" />}
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
        render={<Link href={`?month=${next}`} aria-label="Próximo mês" />}
      >
        Próx.
        <ChevronRight className="size-4" />
      </Button>
      <TransactionModal categories={categories}>
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
