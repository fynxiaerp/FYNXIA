// PROTÓTIPOS v2 — índice. Hub das telas de exploração para o próximo milestone.
// Server Component. Sem acesso a banco.
import Link from 'next/link'
import { Network, BarChart3, FileText, ShieldPlus, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { PrototypeBanner } from '@/components/prototipos/charts'

const PROTOTYPES = [
  {
    href: '/clinica/prototipos/dashboard-franquias',
    title: 'Dashboard de Franquias',
    description: 'Visão consolidada de rede multi-clínica: faturamento, ocupação, ranking de unidades.',
    icon: Network,
    ready: true,
  },
  {
    href: '/clinica/prototipos/relatorios',
    title: 'Relatórios / BI',
    description: 'Painéis gerenciais: receita × despesa, formas de pagamento, produtividade, procedimentos.',
    icon: BarChart3,
    ready: true,
  },
  {
    href: '/clinica/prototipos/nfse',
    title: 'NFSe Fiscal',
    description: 'Emissão de nota de serviço odontológica, ISS e histórico de notas.',
    icon: FileText,
    ready: true,
  },
  {
    href: '/clinica/prototipos/convenios',
    title: 'Convênios / Planos',
    description: 'Cadastro de convênios, guias TISS, faturamento por plano e glosas.',
    icon: ShieldPlus,
    ready: true,
  },
]

export default function PrototiposIndexPage() {
  return (
    <>
      <PageHeader
        title="Protótipos"
        breadcrumbs={[{ label: 'Protótipos' }]}
      />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <PrototypeBanner note="Telas de exploração para escopar o v2. Não fazem parte do produto v1.0 e usam apenas dados fictícios." />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROTOTYPES.map((p) => {
            const Icon = p.icon
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent/60">
                    <Icon className="size-5 text-primary" />
                  </span>
                  {p.ready ? (
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  ) : (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      Em breve
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-base font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </div>
              </>
            )

            return p.ready ? (
              <Link
                key={p.title}
                href={p.href}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={p.title}
                className="rounded-xl border border-dashed border-border bg-card p-5 opacity-70"
              >
                {inner}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
