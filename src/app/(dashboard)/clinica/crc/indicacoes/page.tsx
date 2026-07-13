// src/app/(dashboard)/clinica/crc/indicacoes/page.tsx
// Programa de Indicação (CRC-05, D-16..D-19) — Server Component.
// Read-only: linking a referral happens in LeadFormDialog (Plan 07, D-16).
// This page is consultation/management of rewards, fed by listReferrals +
// listRewardsBalance (Plan 04). D-19: internal view now, data modeled for the
// Phase 20 patient portal.

import { Gift } from 'lucide-react'

import { listReferrals, listRewardsBalance } from '@/actions/referrals'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReferralsTable } from '@/components/crc/ReferralsTable'
import { PatientRewardsBalanceTable } from '@/components/crc/PatientRewardsBalanceTable'
import { formatBRL } from '@/lib/format/money'

export default async function IndicacoesPage() {
  const [referralsResult, balanceResult] = await Promise.all([
    listReferrals(),
    listRewardsBalance(),
  ])

  const referrals = referralsResult.success ? (referralsResult.data ?? []) : []
  const balance = balanceResult.success ? (balanceResult.data ?? []) : []

  const hasError = !referralsResult.success || !balanceResult.success
  const hasReferrals = referrals.length > 0

  const totalIndicacoes = referrals.length
  const totalConvertidas = referrals.filter((r) => r.creditedAt !== null).length
  const totalCreditado = referrals.reduce(
    (sum, r) => sum + (r.creditedAt ? (r.rewardAmount ?? 0) : 0),
    0
  )

  return (
    <>
      <PageHeader
        title="Programa de Indicação"
        breadcrumbs={[
          { label: 'CRC & Marketing', href: '/clinica/crc' },
          { label: 'Programa de Indicação' },
        ]}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>
              {referralsResult.error ?? balanceResult.error ?? 'Erro ao carregar o programa de indicação. Tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {!hasReferrals ? (
          <EmptyState
            icon={Gift}
            title="Nenhuma indicação registrada"
            description="Vincule pacientes indicados ao cadastrar um novo lead para começar a acompanhar recompensas."
          />
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="min-h-[72px]" aria-label={`Indicações Registradas: ${totalIndicacoes}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Indicações Registradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{totalIndicacoes}</p>
                </CardContent>
              </Card>

              <Card className="min-h-[72px]" aria-label={`Indicações Convertidas: ${totalConvertidas}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Indicações Convertidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{totalConvertidas}</p>
                </CardContent>
              </Card>

              <Card
                className="min-h-[72px]"
                aria-label={`Total em Recompensas Creditadas: ${formatBRL(totalCreditado)}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Total em Recompensas Creditadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{formatBRL(totalCreditado)}</p>
                </CardContent>
              </Card>
            </div>

            <section className="space-y-3">
              <h2 className="font-display text-sm font-semibold">Indicações</h2>
              <ReferralsTable data={referrals} />
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-sm font-semibold">Saldo por Paciente Indicador</h2>
              <PatientRewardsBalanceTable data={balance} referrals={referrals} />
            </section>
          </>
        )}
      </main>
    </>
  )
}
