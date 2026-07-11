// src/app/(dashboard)/clinica/estoque/produtos/page.tsx
// Catálogo de Produtos — RSC (EST-01).
// Role/read-only via headers (x-user-role/x-read-only) — set by proxy.ts (ROLE-02).
// T-17-15: CTA de escrita condicionado a admin/superadmin na UI; gate real em
// createProduct/updateProduct (WRITER_ROLES) — Server Action é a autoridade.
// D-23: saldo calculado para a unidade padrão (listUnits ordenado is_default desc).

import { headers } from 'next/headers'
import { Package, Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { listUnits } from '@/actions/units'
import { listProducts } from '@/actions/products'
import { listSuppliers } from '@/actions/suppliers'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { ProductsTable } from '@/components/estoque/ProductsTable'
import { ProductFormDialog } from '@/components/estoque/ProductFormDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function ProdutosPage() {
  const hdrs = await headers()
  const role = hdrs.get('x-user-role') ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  const unitsResult = await listUnits()
  const units = unitsResult.success ? (unitsResult.units ?? []) : []
  const unitId = units[0]?.id

  const [productsResult, suppliersResult] = await Promise.all([
    listProducts({ unitId }),
    listSuppliers(),
  ])

  const products = productsResult.success ? (productsResult.data ?? []) : []
  const suppliers = suppliersResult.success ? (suppliersResult.suppliers ?? []) : []
  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: s.name }))

  const headerActions = isAdmin ? (
    <ProductFormDialog mode="create" suppliers={supplierOptions}>
      <Button size="sm">
        <Plus className="size-4" />
        Cadastrar Produto
      </Button>
    </ProductFormDialog>
  ) : null

  return (
    <NuqsAdapter>
      <PageHeader
        title="Catálogo de Produtos"
        breadcrumbs={[
          { label: 'Estoque', href: '/clinica/estoque' },
          { label: 'Produtos' },
        ]}
        actions={headerActions}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {!productsResult.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {productsResult.error ?? 'Erro ao carregar produtos. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre o primeiro produto para começar a controlar o estoque."
            cta={
              isAdmin ? (
                <ProductFormDialog mode="create" suppliers={supplierOptions}>
                  <Button size="sm">
                    <Plus className="size-4" />
                    Cadastrar Produto
                  </Button>
                </ProductFormDialog>
              ) : undefined
            }
          />
        ) : (
          <ProductsTable products={products} suppliers={supplierOptions} canWrite={isAdmin} />
        )}
      </main>
    </NuqsAdapter>
  )
}
