// src/app/(dashboard)/clinica/crc/page.tsx
// CRC & Marketing module hub — mirrors /clinica/financeiro hub pattern (icon card grid).
// Pure navigation, no data fetching (UI-SPEC §1 "Header actions: Nenhum").

import Link from 'next/link'
import { Kanban, TrendingUp, Send, Smile, Gift } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'

const NAV_ITEMS = [
  {
    href: '/clinica/crc/funil',
    title: 'Funil de Leads',
    description: 'Acompanhe leads do primeiro contato até a conversão em paciente.',
    icon: Kanban,
  },
  {
    href: '/clinica/crc/roi',
    title: 'ROI de Campanhas',
    description: 'Analise custo por lead (CPL), custo de aquisição (CAC) e conversão por origem.',
    icon: TrendingUp,
  },
  {
    href: '/clinica/crc/campanhas',
    title: 'Campanhas de Reativação',
    description: 'Reative pacientes inativos com campanhas segmentadas por WhatsApp e e-mail.',
    icon: Send,
  },
  {
    href: '/clinica/crc/nps',
    title: 'NPS',
    description: 'Acompanhe a satisfação dos pacientes pós-consulta e trate detratores.',
    icon: Smile,
  },
  {
    href: '/clinica/crc/indicacoes',
    title: 'Programa de Indicação',
    description: 'Gerencie indicações de pacientes e o saldo de recompensas creditadas.',
    icon: Gift,
  },
]

export default function CrcHubPage() {
  return (
    <>
      <PageHeader
        title="CRC & Marketing"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'CRC & Marketing' },
        ]}
      />
      <main className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Gerencie o funil de leads, campanhas de marketing, satisfação de pacientes e o
            programa de indicação.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-6 text-muted-foreground group-hover:text-primary" />
                <div>
                  <h2 className="text-sm font-semibold group-hover:text-primary">{item.title}</h2>
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
