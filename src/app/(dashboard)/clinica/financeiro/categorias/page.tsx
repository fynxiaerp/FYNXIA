// src/app/(dashboard)/clinica/financeiro/categorias/page.tsx
// FCAD-02: Category → Conta Contábil mapping screen — RSC.
// UI-SPEC §"Page Structure /categorias".
// T-14-21: canEdit={isAdmin} — UI hides controls; Server Action enforces the real gate.

import { createClient } from '@/lib/supabase/server'
import { listCategoriesWithAccounts } from '@/actions/categories'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import { CategoriesAccountMappingTable } from '@/components/financeiro/CategoriesAccountMappingTable'
import { PageHeader } from '@/components/shell/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { AccountNode } from '@/lib/financeiro/chart-tree'

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

export default async function CategoriasPage() {
  // ─── Role fetch ──────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  // ─── Fetch data ──────────────────────────────────────────────────────────────
  const [categoriesResult, accountsTreeResult] = await Promise.all([
    listCategoriesWithAccounts(),
    listAccountsTree(),
  ])

  const categories = categoriesResult.success ? (categoriesResult.categories ?? []) : []
  const leafAccounts = accountsTreeResult.success
    ? flattenToLeaves(accountsTreeResult.tree ?? [])
    : []

  return (
    <>
      <PageHeader
        title="Categorias de Lançamento"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Categorias' },
        ]}
      />

      <main className="p-6 max-w-5xl mx-auto w-full">
        {/* Error states */}
        {!categoriesResult.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {categoriesResult.error ?? 'Erro ao carregar categorias.'}
            </AlertDescription>
          </Alert>
        )}
        {!accountsTreeResult.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {accountsTreeResult.error ?? 'Erro ao carregar plano de contas.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructional alert per UI-SPEC */}
        <Alert variant="default" className="mb-4">
          <AlertDescription>
            Mapeie cada categoria a uma conta contábil folha. Lançamentos usarão essa conta por padrão.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border">
          <CategoriesAccountMappingTable
            categories={categories}
            leafAccounts={leafAccounts}
            canEdit={isAdmin}
          />
        </div>
      </main>
    </>
  )
}
