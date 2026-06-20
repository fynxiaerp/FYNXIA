import Link from 'next/link'
import { TrendingUp, Receipt, FilePlus, Settings2, GitBranch, Building2, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'

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
      icon: FilePlus,
      show: true,
    },
    {
      href: '/clinica/financeiro/regua-de-cobranca',
      title: 'Régua de Cobrança',
      description: 'Configure lembretes automáticos por e-mail para recebíveis vencidos.',
      icon: Settings2,
      show: isAdmin,
    },
    {
      href: '/clinica/financeiro/plano-de-contas',
      title: 'Plano de Contas',
      description: 'Estrutura hierárquica de contas contábeis da clínica.',
      icon: GitBranch,
      show: true,
    },
    {
      href: '/clinica/financeiro/centros-de-custo',
      title: 'Centros de Custo',
      description: 'Agrupamentos de lançamentos por unidade ou área.',
      icon: Building2,
      show: true,
    },
    {
      href: '/clinica/financeiro/contas-correntes',
      title: 'Contas Correntes',
      description: 'Contas bancárias vinculadas aos lançamentos para conciliação.',
      icon: Landmark,
      show: true,
    },
  ].filter((item) => item.show)

  return (
    <>
      <PageHeader
        title="Financeiro"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro' },
        ]}
        actions={
          <Button
            size="sm"
            render={<Link href="/clinica/financeiro/nova-cobranca" />}
          >
            Nova Cobrança
          </Button>
        }
      />
      <main className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
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
