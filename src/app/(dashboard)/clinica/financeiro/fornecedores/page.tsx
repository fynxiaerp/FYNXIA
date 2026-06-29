// src/app/(dashboard)/clinica/financeiro/fornecedores/page.tsx
// RSC page — fetches role + suppliers, renders SuppliersTable + SupplierFormDialog.
// Pattern mirrors centros-de-custo/page.tsx exactly.
// T-ivj-01: canEdit={isAdmin} is cosmetic; real gate is WRITER_ROLES in suppliers.ts.
// T-ivj-02: listSuppliers never accepts clinic_id from client — always from server session.

import { Truck } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listSuppliers } from '@/actions/suppliers'
import { PageHeader } from '@/components/shell/PageHeader'
import { SuppliersTable } from '@/components/financeiro/SuppliersTable'
import { SupplierFormDialog } from '@/components/financeiro/SupplierFormDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function FornecedoresPage() {
  // ─── Role fetch — mirrors centros-de-custo/page.tsx pattern ─────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  // ─── Fetch data — show all (including inactive) so admin can see history ─────
  const result = await listSuppliers()
  const suppliers = result.success ? (result.suppliers ?? []) : []

  return (
    <>
      <PageHeader
        title="Fornecedores"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Fornecedores' },
        ]}
        actions={
          isAdmin ? (
            <SupplierFormDialog
              mode="create"
              trigger={
                <Button size="sm">
                  <Truck className="size-4 mr-1" />
                  Novo Fornecedor
                </Button>
              }
            />
          ) : null
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full">
        {/* Error state */}
        {!result.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {result.error ?? 'Erro ao carregar fornecedores.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <SuppliersTable suppliers={suppliers} canEdit={isAdmin} />
        </div>
      </main>
    </>
  )
}
