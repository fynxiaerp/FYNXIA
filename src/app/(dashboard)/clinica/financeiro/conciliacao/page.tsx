import { headers } from 'next/headers'
import { ArrowLeftRight } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listBankAccounts } from '@/actions/bank-accounts'
import { listStatementLines } from '@/actions/bank-statements'
import { cashFlowPrevistoVsRealizado } from '@/actions/reconciliation'
import { formatBRL } from '@/lib/format/money'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { StatementLinesTable } from '@/components/financeiro/StatementLinesTable'
import { ReconciliationUpload } from '@/components/financeiro/ReconciliationUpload'
import { PrevistoxRealizadoChart } from '@/components/financeiro/PrevistoxRealizadoChart'
import { ContaCorrenteSelector } from '@/components/financeiro/ContaCorrenteSelector'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatementLineRow = {
  id: string
  bank_account_id: string
  bank_statement_id: string
  transaction_date: string
  amount: number
  memo: string
  check_number: string | null
  reconciliation_status: string
  matched_transaction_ids: string[] | null
  fee_transaction_id: string | null
  fitid: string | null
  fitid_fallback: string | null
  match_score?: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// RSC — reads role/readOnly from proxy headers (D-23).
// Conta Corrente selection drives the statement data load.

interface ConciliacaoPageProps {
  searchParams: Promise<{
    conta?: string
    tab?: string
  }>
}

export default async function ConciliacaoPage({ searchParams }: ConciliacaoPageProps) {
  const hdrs = await headers()
  const readOnly = hdrs.get('x-read-only') === 'true'
  const canWrite = !readOnly

  const params = await searchParams
  const selectedContaId = params.conta ?? ''
  const activeTab = params.tab ?? 'extrato'

  // Fetch bank accounts for selector
  const bankAccountsResult = await listBankAccounts()
  const bankAccounts = bankAccountsResult.success
    ? (bankAccountsResult.accounts ?? []).filter((ba) => ba.ativo)
    : []

  // Load statement lines and cash flow only if a conta is selected
  let lines: StatementLineRow[] = []
  let linesError: string | null = null
  let cashFlowData = null

  if (selectedContaId) {
    const [linesResult, cfResult] = await Promise.all([
      listStatementLines({ bankAccountId: selectedContaId }),
      cashFlowPrevistoVsRealizado({}),
    ])

    if (linesResult.success) {
      lines = (linesResult.lines ?? []) as StatementLineRow[]
    } else {
      linesError = linesResult.error ?? 'Erro ao carregar extrato'
    }

    if (cfResult.success) {
      cashFlowData = cfResult
    }
  }

  // ── KPI derivation ─────────────────────────────────────────────────────────
  const totalExtrato = lines.reduce((sum, l) => sum + Math.abs(l.amount), 0)
  const conciliadosValor = lines
    .filter((l) => l.reconciliation_status === 'conciliado')
    .reduce((sum, l) => sum + Math.abs(l.amount), 0)
  const pendenteCount = lines.filter(
    (l) => l.reconciliation_status === 'pendente'
  ).length

  const allConciliated = lines.length > 0 && pendenteCount === 0

  // ── Header actions ──────────────────────────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      <ContaCorrenteSelector
        bankAccounts={bankAccounts}
        selectedContaId={selectedContaId}
      />
      {canWrite && selectedContaId && (
        <ReconciliationUpload
          bankAccounts={bankAccounts}
          defaultBankAccountId={selectedContaId}
          trigger={
            <Button size="sm">
              Importar OFX
            </Button>
          }
        />
      )}
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader
        title="Conciliação Bancária"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Conciliação' },
        ]}
        actions={headerActions}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {linesError && (
          <Alert variant="destructive">
            <AlertDescription>{linesError}</AlertDescription>
          </Alert>
        )}

        {/* No conta selected */}
        {!selectedContaId && (
          <EmptyState
            icon={ArrowLeftRight}
            title="Nenhum extrato importado"
            description="Selecione uma conta corrente e importe um arquivo OFX para iniciar a conciliação bancária."
          />
        )}

        {selectedContaId && (
          <>
            {/* KPI Row — 3 cards mirroring CashFlowTotals layout */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="min-h-[72px]" aria-label={`Total do Extrato: ${formatBRL(totalExtrato)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Total do Extrato
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold leading-tight tabular-nums text-foreground">
                    {formatBRL(totalExtrato)}
                  </p>
                </CardContent>
              </Card>

              <Card className="min-h-[72px]" aria-label={`Conciliados: ${formatBRL(conciliadosValor)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Conciliados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold leading-tight tabular-nums text-green-700">
                    {formatBRL(conciliadosValor)}
                  </p>
                </CardContent>
              </Card>

              <Card className="min-h-[72px]" aria-label={`Pendentes: ${pendenteCount}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold leading-tight tabular-nums text-amber-700">
                    {pendenteCount}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue={activeTab}>
              <TabsList>
                <TabsTrigger value="extrato">Extrato &amp; Matching</TabsTrigger>
                <TabsTrigger value="previsto">Previsto × Realizado</TabsTrigger>
              </TabsList>

              {/* Tab 1 — Extrato & Matching */}
              <TabsContent value="extrato" className="mt-4">
                {lines.length === 0 ? (
                  <EmptyState
                    icon={ArrowLeftRight}
                    title="Nenhum extrato importado"
                    description="Importe um arquivo OFX para iniciar a conciliação bancária."
                  />
                ) : allConciliated ? (
                  <EmptyState
                    icon={ArrowLeftRight}
                    title="Tudo conciliado"
                    description="Nenhuma linha pendente para este período."
                  />
                ) : (
                  <StatementLinesTable
                    lines={lines}
                    canWrite={canWrite}
                    bankAccountId={selectedContaId}
                  />
                )}
              </TabsContent>

              {/* Tab 2 — Previsto × Realizado */}
              <TabsContent value="previsto" className="mt-4">
                <PrevistoxRealizadoChart data={cashFlowData} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </NuqsAdapter>
  )
}
