// src/app/(dashboard)/clinica/estoque/entradas/page.tsx
// Entradas de Estoque — RSC (EST-01 / D-10).
// Role/read-only via headers (x-user-role) — mirrors produtos/page.tsx.
// D-23: saldo/lotes resolvidos para a unidade padrão (listUnits ordenado is_default desc).
//
// Query params (honram o link vindo de ProductsTable — Plan 06):
//   ?produto={id}              → abre StockEntryFormDialog com o produto pré-selecionado
//   ?produto={id}&acao=baixa   → abre ManualDrawDialog com o produto pré-selecionado

import { headers } from 'next/headers'
import { PackagePlus, Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listUnits } from '@/actions/units'
import { listProducts } from '@/actions/products'
import { listSuppliers } from '@/actions/suppliers'
import { listStockEntries } from '@/actions/stock-entries'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { StockEntriesTable } from '@/components/estoque/StockEntriesTable'
import { StockEntryFormDialog } from '@/components/estoque/StockEntryFormDialog'
import { ManualDrawDialog } from '@/components/estoque/ManualDrawDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EntradasPageProps {
  searchParams: Promise<{
    produto?: string
    from?: string
    to?: string
    acao?: string
  }>
}

export default async function EntradasPage({ searchParams }: EntradasPageProps) {
  const hdrs = await headers()
  const role = hdrs.get('x-user-role') ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  const params = await searchParams

  const unitsResult = await listUnits()
  const units = unitsResult.success ? (unitsResult.units ?? []) : []
  const unitId = units[0]?.id ?? ''

  const [entriesResult, productsResult, suppliersResult] = await Promise.all([
    listStockEntries({
      productId: params.produto || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    listProducts({ unitId }),
    listSuppliers(),
  ])

  const entries = entriesResult.success ? (entriesResult.data ?? []) : []
  const products = productsResult.success ? (productsResult.data ?? []) : []
  const suppliers = suppliersResult.success ? (suppliersResult.suppliers ?? []) : []

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as 'insumo' | 'medicamento' | 'implante',
    unidade_medida: p.unidade_medida,
    custo_medio: p.custo_medio,
    saldo: p.saldo,
  }))
  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: s.name }))

  // Query-param wiring (17-06 ProductsTable dropdown → esta rota)
  const isBaixaAction = params.acao === 'baixa'
  const autoOpenEntryProductId = params.produto && !isBaixaAction ? params.produto : undefined
  const autoOpenDrawProductId = params.produto && isBaixaAction ? params.produto : undefined

  const headerActions = isAdmin ? (
    <StockEntryFormDialog
      products={productOptions}
      suppliers={supplierOptions}
      unitId={unitId}
      autoOpen={Boolean(autoOpenEntryProductId)}
      initialProductId={autoOpenEntryProductId}
    >
      <Button size="sm">
        <Plus className="size-4" />
        Registrar Entrada
      </Button>
    </StockEntryFormDialog>
  ) : null

  return (
    <NuqsAdapter>
      <PageHeader
        title="Entradas de Estoque"
        breadcrumbs={[
          { label: 'Estoque', href: '/clinica/estoque' },
          { label: 'Entradas' },
        ]}
        actions={headerActions}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {!entriesResult.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {entriesResult.error ?? 'Não foi possível carregar esta página. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Baixa manual acessada via dropdown do catálogo (?produto=&acao=baixa) — Plan 06 */}
        {isAdmin && autoOpenDrawProductId && (
          <ManualDrawDialog products={productOptions} unitId={unitId} autoOpen initialProductId={autoOpenDrawProductId}>
            <span className="sr-only">Baixa manual</span>
          </ManualDrawDialog>
        )}

        {entries.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title="Nenhuma entrada registrada"
            description="Registre o recebimento de produtos para atualizar o estoque."
            cta={
              isAdmin ? (
                <StockEntryFormDialog products={productOptions} suppliers={supplierOptions} unitId={unitId}>
                  <Button size="sm">
                    <Plus className="size-4" />
                    Registrar Entrada
                  </Button>
                </StockEntryFormDialog>
              ) : undefined
            }
          />
        ) : (
          <StockEntriesTable entries={entries} products={productOptions} />
        )}
      </main>
    </NuqsAdapter>
  )
}
