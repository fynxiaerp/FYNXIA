import Link from 'next/link'
import { TrendingUp, Receipt, CreditCard, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

// Financeiro module hub — mirrors /clinica hub pattern (icon card grid).
// Régua de Cobrança card is admin-only (role check for display; action-level gates enforce writes).
export default async function FinanceiroPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }
  const role = me?.role ?? 'receptionist'
  const isAdmin = role === 'admin' || role === 'superadmin'

  const navItems = [
    {
      href: '/clinica/financeiro/fluxo-de-caixa',
      title: 'Fluxo de Caixa',
      description: 'Entradas, saídas e saldo do mês. Lance transações manuais.',
      icon: TrendingUp,
      show: true,
    },
    {
      href: '/clinica/financeiro/contas-a-receber',
      title: 'Contas a Receber',
      description: 'Recebíveis por paciente, parcelas e status de pagamento.',
      icon: Receipt,
      show: true,
    },
    {
      href: '/clinica/financeiro/nova-cobranca',
      title: 'Nova Cobrança',
      description: 'Emita cobranças via PIX, boleto ou cartão pelo Asaas.',
      icon: CreditCard,
      show: true,
    },
    {
      href: '/clinica/financeiro/regua-de-cobranca',
      title: 'Régua de Cobrança',
      description: 'Configure lembretes automáticos por e-mail para recebíveis vencidos.',
      icon: Bell,
      show: isAdmin,
    },
  ].filter((item) => item.show)

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/clinica">Clínica</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Financeiro</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-xl font-semibold leading-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie cobranças, recebíveis e o fluxo de caixa da clínica.
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
                <Icon className="size-6 text-primary" />
                <div>
                  <h2 className="text-base font-semibold group-hover:text-primary">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
