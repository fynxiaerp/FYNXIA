// src/app/(dashboard)/clinica/societario/page.tsx
// REP-03: Societário screen — per-sócio R$ distribution (D-21/D-23/D-27),
// admin-all vs sócio-own-row view (D-24), "Nova vigência" form with the blocking
// 100% validation (D-22), "Encerrar vigência" destructive confirm (D-20 history),
// vigência history and PDF export (D-40). Server Component — data fetched via
// @/actions/partner-shares (Plan 06); access already RBAC-gated by proxy.ts
// (societario module).
//
// Role read from x-user-role header (set by proxy.ts, ROLE-02) — mirrors
// estoque/produtos/page.tsx's pattern. Used ONLY for UI gating (Nova vigência CTA
// + single-Card own-row rendering) — the real authority for both the write gate
// (SHARE_WRITE_ROLES) and the row-scoping (partner_shares RLS, T-19-02) lives
// server-side in partner-shares.ts.
import { headers } from 'next/headers'
import { Download, Plus } from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { getPartnerDistribution, listPartnerShares, listSocios } from '@/actions/partner-shares'
import { PartnerDistribution, SocietarioPeriodFilter } from '@/components/relatorios/PartnerDistribution'
import { PartnerShareFormDialog } from '@/components/relatorios/PartnerShareFormDialog'

interface SocietarioPageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

function lastDayOfMonth(ym: string): string {
  const parts = ym.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

export default async function SocietarioPage({ searchParams }: SocietarioPageProps) {
  const params = await searchParams
  const defaultYm = new Date().toISOString().slice(0, 7)
  const from = params.from ?? `${defaultYm}-01`
  const to = params.to ?? lastDayOfMonth(defaultYm)

  const hdrs = await headers()
  const role = hdrs.get('x-user-role') ?? 'socio'
  const isAdmin = role === 'admin' || role === 'superadmin'

  const [distResult, sharesResult, sociosResult] = await Promise.all([
    getPartnerDistribution({ from, to }),
    listPartnerShares(),
    listSocios(),
  ])

  const socios = sociosResult.success ? (sociosResult.socios ?? []) : []

  const pdfParams = new URLSearchParams({ from, to })
  const exportHref = `/api/societario/pdf?${pdfParams.toString()}`

  const actions = (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      <SocietarioPeriodFilter />
      {isAdmin && (
        <PartnerShareFormDialog
          socios={socios}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Nova vigência
            </Button>
          }
        />
      )}
      <Button variant="outline" size="sm" render={<a href={exportHref} target="_blank" rel="noopener noreferrer" />}>
        <Download className="size-4" />
        Exportar PDF
      </Button>
    </div>
  )

  return (
    <NuqsAdapter>
      <PageHeader title="Societário" breadcrumbs={[{ label: 'Societário' }]} actions={actions} />
      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <PartnerDistribution
          role={role}
          isAdmin={isAdmin}
          resultado={distResult.success ? (distResult.resultado ?? 0) : 0}
          distribution={distResult.success ? (distResult.distribution ?? []) : []}
          distError={!distResult.success ? (distResult.error ?? 'Erro ao carregar a distribuição societária') : null}
          shares={sharesResult.success ? (sharesResult.shares ?? []) : []}
          socios={socios}
        />
      </div>
    </NuqsAdapter>
  )
}
