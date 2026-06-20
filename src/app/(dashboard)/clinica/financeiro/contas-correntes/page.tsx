// src/app/(dashboard)/clinica/financeiro/contas-correntes/page.tsx
// FCAD-01: Contas Correntes cadastro — RSC.
// UI-SPEC §"Page Structure /contas-correntes".
// T-14-17: canEdit={isAdmin} — UI hides controls; Server Actions enforce the real gate.
// T-14-18: listBankAccounts runs under RLS clinic_id isolation.

import { Landmark } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listBankAccounts } from '@/actions/bank-accounts'
import { PageHeader } from '@/components/shell/PageHeader'
import { BankAccountsTable } from '@/components/financeiro/BankAccountsTable'
import { BankAccountFormDialog } from '@/components/financeiro/BankAccountFormDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function ContasCorrentesPage() {
  // ─── Role fetch — mirrors plano-de-contas/page.tsx pattern ──────────────────
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
  const result = await listBankAccounts()
  const accounts = result.success ? (result.accounts ?? []) : []

  return (
    <>
      <PageHeader
        title="Contas Correntes"
        breadcrumbs={[
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Contas Correntes' },
        ]}
        actions={
          isAdmin ? (
            <BankAccountFormDialog
              mode="create"
              trigger={
                <Button size="sm">
                  <Landmark className="size-4 mr-1" />
                  Nova Conta Corrente
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
              {result.error ?? 'Erro ao carregar contas correntes.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <BankAccountsTable
            accounts={accounts}
            canEdit={isAdmin}
          />
        </div>
      </main>
    </>
  )
}
