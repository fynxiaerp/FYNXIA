// src/app/(dashboard)/clinica/estoque/anvisa/page.tsx
// Relatório ANVISA de Rastreabilidade de Implantes — RSC (EST-03 / D-12/D-13).
//
// Busca listAnvisaTraceability() sem filtros (dataset completo — a Server
// Action já restringe a category='implante') e deixa AnvisaReportTable
// aplicar os filtros nuqs (produto/lote/paciente/from/to) 100% client-side,
// mirrors ProductsTable.tsx (17-06) — evita depender do refetch RSC do nuqs
// (v2 default shallow=true não dispara re-render de Server Component).
//
// AnvisaExportButton (client, definido em AnvisaReportTable.tsx) lê os mesmos
// filtros via useQueryState e monta o link para /api/estoque/anvisa-pdf em
// tempo real — vive como ação secundária do PageHeader.

import { ClipboardList } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listAnvisaTraceability } from '@/actions/stock-draws'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { AnvisaReportTable, AnvisaExportButton } from '@/components/estoque/AnvisaReportTable'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function AnvisaPage() {
  const reportResult = await listAnvisaTraceability()
  const rows = reportResult.success ? (reportResult.data ?? []) : []

  return (
    <NuqsAdapter>
      <PageHeader
        title="Relatório ANVISA"
        breadcrumbs={[
          { label: 'Estoque', href: '/clinica/estoque' },
          { label: 'Relatório ANVISA' },
        ]}
        actions={<AnvisaExportButton />}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {!reportResult.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {reportResult.error ?? 'Não foi possível carregar esta página. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {rows.length === 0 && reportResult.success ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum implante rastreado no período"
            description="Registre implantes nas entradas de estoque para gerar rastreabilidade ANVISA."
          />
        ) : (
          <AnvisaReportTable rows={rows} />
        )}
      </main>
    </NuqsAdapter>
  )
}
