// src/app/(dashboard)/clinica/financeiro/plano-de-contas/page.tsx
// FCAD-01 SC1: Hierarchical chart of accounts tree — RSC.
// UI-SPEC §"Page Structure" /clinica/financeiro/plano-de-contas
// T-14-14: canEdit={isAdmin} — UI hides controls; Server Actions enforce the real gate.
// T-14-15: listAccountsTree runs under RLS — only own-tenant accounts returned.

import { GitBranch } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import { PageHeader } from '@/components/shell/PageHeader'
import { ChartOfAccountsTree } from '@/components/financeiro/ChartOfAccountsTree'
import { AccountFormDialog } from '@/components/financeiro/AccountFormDialog'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function PlanoDeContasPage() {
  // ─── Role fetch — mirrors financeiro/page.tsx pattern ───────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  // ─── Fetch tree ──────────────────────────────────────────────────────────────
  const result = await listAccountsTree()
  const tree = result.success ? (result.tree ?? []) : []

  // ─── Flatten for parent selector (used in AccountFormDialog) ────────────────
  // We pass tree to ChartOfAccountsTree which flattens internally for dialogs.

  return (
    <>
      <PageHeader
        title="Plano de Contas"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Plano de Contas' },
        ]}
        actions={
          isAdmin ? (
            <AccountFormDialog
              mode="create"
              parents={[]}
              trigger={
                <Button size="sm">
                  Nova Conta
                </Button>
              }
            />
          ) : null
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Error state */}
        {!result.success && (
          <Alert variant="destructive">
            <AlertDescription>
              {result.error ?? 'Erro ao carregar plano de contas.'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Estrutura Hierárquica</CardTitle>
            <CardDescription>
              Plano de contas odontológico. Grupos não aceitam lançamentos diretos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="Plano de contas não configurado"
                description="O plano de contas odontológico padrão será criado automaticamente. Edite ou adicione contas conforme a necessidade da sua clínica."
              />
            ) : (
              <ChartOfAccountsTree accounts={tree} canEdit={isAdmin} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
