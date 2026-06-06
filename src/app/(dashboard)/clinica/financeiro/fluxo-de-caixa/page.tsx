import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listTransactions, listCategories } from '@/actions/transactions'
import { CashFlowTotals } from '@/components/financeiro/CashFlowTotals'
import { TransactionList } from '@/components/financeiro/TransactionList'
import { TransactionModal } from '@/components/financeiro/TransactionModal'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

  return (
    <NuqsAdapter>
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/clinica">Clínica</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/clinica/financeiro">Financeiro</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Fluxo de Caixa</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-semibold leading-tight">Fluxo de Caixa</h1>
            <div className="flex items-center gap-2">
              {/* Month navigation — Link wraps the button content.
                  @base-ui/react Button has no asChild; use render prop for anchor. */}
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`?month=${prev}`} aria-label="Mês anterior" />}
              >
                <ChevronLeft className="size-4" />
                Mês ant.
              </Button>
              <span className="min-w-[120px] text-center text-sm font-medium capitalize">
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
                  <Plus className="mr-1 size-4" />
                  Lançamento
                </Button>
              </TransactionModal>
            </div>
          </div>

          {/* Error state */}
          {!txResult.success && (
            <Alert variant="destructive">
              <AlertDescription>
                {txResult.error ?? 'Erro ao carregar transações.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Primary focal point: cash flow totals (UI-SPEC) */}
          <CashFlowTotals
            entradas={totals.entradas}
            saidas={totals.saidas}
            saldo={totals.saldo}
          />

          {/* Transaction list */}
          {transactions.length === 0 ? (
            <div className="rounded-md border border-dashed p-12 text-center">
              <p className="text-sm font-medium">
                Nenhum lançamento em {monthLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lance a primeira transação do mês usando o botão acima.
              </p>
            </div>
          ) : (
            <TransactionList transactions={transactions} categories={categories} />
          )}
        </div>
      </main>
    </NuqsAdapter>
  )
}
