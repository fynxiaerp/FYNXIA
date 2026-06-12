import Link from 'next/link'
import { Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listReceivables } from '@/actions/receivables'
import { ReceivablesTable } from '@/components/financeiro/ReceivablesTable'
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
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-5xl space-y-8">
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
                <BreadcrumbPage>Contas a Receber</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-semibold leading-tight">Contas a Receber</h1>
            {/* @base-ui/react Button: use render prop instead of asChild */}
            <Button
              size="sm"
              render={<Link href="/clinica/financeiro/nova-cobranca" />}
            >
              <Plus className="mr-1 size-4" />
              Cobrança
            </Button>
          </div>

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
            <div className="rounded-md border border-dashed p-12 text-center">
              <p className="text-sm font-semibold">Nenhum recebível cadastrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Emita a primeira cobrança para um paciente para começar a rastrear os recebíveis.
              </p>
            </div>
          ) : (
            <ReceivablesTable receivables={receivables} />
          )}
        </div>
      </main>
    </NuqsAdapter>
  )
}
