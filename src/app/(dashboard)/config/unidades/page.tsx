// src/app/(dashboard)/config/unidades/page.tsx
// Unidades (filiais) management page — SYS-01 / quick-260629-qji.
//
// Admin/superadmin: PageHeader + Nova Unidade button + UnitsTable.
// Non-admin: in-page Alert "Acesso restrito" — NO redirect (config-route convention).
// Unauthenticated: in-page Alert "Não autenticado."
//
// Pattern mirrors fornecedores/page.tsx + config/empresa/page.tsx exactly.
// No proxy.ts change needed: /config/unidades covered by existing /config → config module.

import { Building2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listUnits } from '@/actions/units'
import { PageHeader } from '@/components/shell/PageHeader'
import { UnitsTable } from '@/components/config/UnitsTable'
import { UnitFormDialog } from '@/components/config/UnitFormDialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function UnidadesPage() {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Unidades"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Unidades' },
          ]}
        />
        <main className="p-6 max-w-5xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>Não autenticado.</AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Role gate ─────────────────────────────────────────────────────────────
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin'

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          title="Unidades"
          breadcrumbs={[
            { label: 'Configurações', href: '/config' },
            { label: 'Unidades' },
          ]}
        />
        <main className="p-6 max-w-5xl mx-auto w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso restrito. Esta área é exclusiva para administradores da rede.
            </AlertDescription>
          </Alert>
        </main>
      </>
    )
  }

  // ── Fetch data ────────────────────────────────────────────────────────────
  const result = await listUnits()
  const units = result.success ? (result.units ?? []) : []

  return (
    <>
      <PageHeader
        title="Unidades"
        breadcrumbs={[
          { label: 'Configurações', href: '/config' },
          { label: 'Unidades' },
        ]}
        actions={
          <UnitFormDialog
            mode="create"
            trigger={
              <Button size="sm">
                <Building2 className="size-4 mr-1" />
                Nova Unidade
              </Button>
            }
          />
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full">
        {/* Error state */}
        {!result.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {result.error ?? 'Erro ao carregar unidades.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <UnitsTable units={units} canEdit={isAdmin} />
        </div>
      </main>
    </>
  )
}
