import Link from 'next/link'
import {
  ClipboardList,
  FileText,
  ShieldPlus,
  Building2,
  Scissors,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'

// Screen 6 — Faturamento Hub
// RSC. Icon-card grid (5 cards). Operadoras gated to admin/financeiro.
export default async function FaturamentoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const canSeeOperadoras = ['admin', 'superadmin', 'financeiro'].includes(role)

  const navItems = [
    {
      href: '/clinica/financeiro/faturamento/os',
      title: 'Ordens de Serviço',
      description: 'OS automáticas pós-atendimento e OS avulsas.',
      icon: ClipboardList,
      show: true,
    },
    {
      href: '/clinica/financeiro/faturamento/nfse',
      title: 'NFS-e Fiscal',
      description: 'Emissão de nota fiscal de serviço odontológica.',
      icon: FileText,
      show: true,
    },
    {
      href: '/clinica/financeiro/faturamento/convenios',
      title: 'Convênios / Planos',
      description: 'Guias TISS, lotes e tratamento de glosas por operadora.',
      icon: ShieldPlus,
      show: true,
    },
    {
      href: '/clinica/financeiro/faturamento/operadoras',
      title: 'Operadoras',
      description: 'Cadastro de operadoras de convênio e tabelas de preços.',
      icon: Building2,
      show: canSeeOperadoras,
    },
    {
      href: '/clinica/financeiro/faturamento/glosas',
      title: 'Glosas',
      description: 'Tratamento de glosas recebidas das operadoras.',
      icon: Scissors,
      show: true,
    },
  ].filter((item) => item.show)

  return (
    <>
      <PageHeader
        title="Faturamento"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Faturamento' },
        ]}
      />
      <main className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Gerencie ordens de serviço, notas fiscais, convênios e glosas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-6 text-muted-foreground group-hover:text-primary" />
                <div>
                  <h2 className="text-sm font-semibold group-hover:text-primary">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </>
  )
}
