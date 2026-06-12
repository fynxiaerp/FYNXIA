import Link from 'next/link'
import { Plus, ReceiptText } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listReceivables } from '@/actions/receivables'
import { ReceivablesTable } from '@/components/financeiro/ReceivablesTable'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Contas a Receber Page ────────────────────────────────────────────────────
// FIN-03: Server Component. Renders ReceivablesTable with status + installment grouping.
// Status filter (pendente/pago/vencido) and date range are applied by ReceivablesTable
// client-side via nuqs. Page fetches all receivables (or pre-filtered by server-accessible params).

interface ContasAReceberPageProps {
  searchParams: Promise<{
    status?: string
    from?: string
    to?: string
  }>
}

export default async function ContasAReceberPage({ searchParams }: ContasAReceberPageProps) {
  const params = await searchParams

  // Fetch from server (RLS enforces tenant scope). Date range filters may be passed.
  // 'vencido' cannot be DB-filtered; ReceivablesTable derives it client-side.
  const result = await listReceivables({
    status: params.status && params.status !== 'vencido' ? params.status : null,
    from: params.from ?? null,
    to: params.to ?? null,
  })

  const receivables = result.success ? (result.receivables ?? []) : []

  return (
    <NuqsAdapter>
      <PageHeader
        title="Contas a Receber"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Contas a Receber' },
        ]}
        actions={
          <Button
            size="sm"
            render={<Link href="/clinica/financeiro/nova-cobranca" />}
          >
            <Plus className="mr-1 size-4" />
            Emitir Cobrança
          </Button>
        }
      />
      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Error state */}
        {!result.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {result.error ?? 'Erro ao carregar recebíveis.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Primary focal point: receivables table (UI-SPEC) */}
        {receivables.length === 0 && result.success ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhum recebível cadastrado"
            description="Emita a primeira cobrança para um paciente para começar a rastrear os recebíveis."
            cta={
              <Button
                size="sm"
                render={<Link href="/clinica/financeiro/nova-cobranca" />}
              >
                Emitir Cobrança
              </Button>
            }
          />
        ) : (
          <ReceivablesTable receivables={receivables} />
        )}
      </main>
    </NuqsAdapter>
  )
}
