// src/app/(dashboard)/config/servicos/page.tsx
// Catálogo de serviços — /config/servicos (D-21).
//
// RSC: PageHeader "Serviços" + tabela de serviços + ServiceForm (Dialog client
// component) em modo create (botão "Novo Serviço") e edit (por linha).
// Pattern mirrors config/unidades/page.tsx: auth gate + admin role gate inline
// (Alert, sem redirect), /config já coberto pelo módulo genérico em proxy.ts —
// nenhuma mudança de rota necessária.

import { Package } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listServices } from '@/actions/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { ServiceForm, type ServiceRow } from '@/components/config/ServiceForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatBRL } from '@/lib/format/money'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function ServicosPage() {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader
          title="Serviços"
          breadcrumbs={[{ label: 'Configurações', href: '/config' }, { label: 'Serviços' }]}
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
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()

  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin'

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          title="Serviços"
          breadcrumbs={[{ label: 'Configurações', href: '/config' }, { label: 'Serviços' }]}
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
  const result = await listServices()
  const services: ServiceRow[] = result.success ? (result.services ?? []) : []

  return (
    <>
      <PageHeader
        title="Serviços"
        breadcrumbs={[{ label: 'Configurações', href: '/config' }, { label: 'Serviços' }]}
        actions={
          <ServiceForm
            mode="create"
            trigger={
              <Button size="sm">
                <Package className="size-4 mr-1" />
                Novo Serviço
              </Button>
            }
          />
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full">
        {!result.success && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{result.error ?? 'Erro ao carregar serviços.'}</AlertDescription>
          </Alert>
        )}

        {services.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum serviço cadastrado"
            description="Cadastre o primeiro serviço para faturar procedimentos e configurar materiais consumidos."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor Particular</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="text-sm font-normal text-foreground">
                      {service.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {service.code ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatBRL(service.valor_particular)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </TableCell>
                    <TableCell>
                      <ServiceForm
                        mode="edit"
                        service={service}
                        trigger={
                          <Button size="sm" variant="outline">
                            Editar
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  )
}
