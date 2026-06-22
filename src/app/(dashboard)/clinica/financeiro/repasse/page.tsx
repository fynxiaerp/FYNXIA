import { headers } from 'next/headers'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Users, Lock } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CompetenciaSelector } from '@/components/financeiro/CompetenciaSelector'
import { PayoutTable } from '@/components/financeiro/PayoutTable'
import { FecharCompetenciaButton } from '@/components/financeiro/FecharCompetenciaButton'
import { listPayouts } from '@/actions/professional-payouts'
import { formatBRL } from '@/lib/format/money'

// ─── Repasse Page (RSC) ───────────────────────────────────────────────────────
// TRIB-01: Repasse de Profissionais por competência.
// Read role/x-read-only → canWrite gate (D-23).

interface RepassePageProps {
  searchParams: Promise<{ competencia?: string; unit?: string }>
}

export default async function RepassePage({ searchParams }: RepassePageProps) {
  const params = await searchParams
  const competencia = params.competencia ?? new Date().toISOString().slice(0, 7)
  const unitId = params.unit

  // D-23: read-only gate
  const headersList = await headers()
  const role = headersList.get('x-user-role') ?? 'receptionist'
  const readOnly = headersList.get('x-read-only') === 'true'
  const canWrite = !readOnly && (role === 'admin' || role === 'superadmin' || role === 'financeiro')

  // Load payouts
  const { payouts = [], error } = await listPayouts({ competencia, unitId }).then((r) => ({
    payouts: (r.payouts ?? []) as Array<{
      id: string
      competencia: string
      valor_bruto: number
      deducoes: Record<string, number> | null
      valor_base: number
      percentual: number
      valor_repasse: number
      status: string
      payable_id: string | null
      professionals: { id: string; users: { id: string } | null } | null
    }>,
    error: r.error,
  }))

  // KPI aggregates
  const totalBruto = payouts.reduce((s, p) => s + p.valor_bruto, 0)
  const totalRepasse = payouts.reduce((s, p) => s + p.valor_repasse, 0)
  const countProfissionais = new Set(payouts.map((p) => p.professionals?.id)).size

  // Sem regra alert: payouts with valor_repasse === 0 and valor_bruto > 0
  const semRegraCount = payouts.filter((p) => p.valor_repasse === 0 && p.valor_bruto > 0).length

  // Format month for alert copy
  function formatMes(comp: string): string {
    const parts = comp.split('-')
    const y = parseInt(parts[0] ?? '2026', 10)
    const m = parseInt(parts[1] ?? '1', 10)
    const date = new Date(y, m - 1, 1)
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  }

  const mesLabel = formatMes(competencia)

  return (
    <NuqsAdapter>
      <PageHeader
        title="Repasse de Profissionais"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Financeiro', href: '/clinica/financeiro' },
          { label: 'Repasse' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <CompetenciaSelector />
            {canWrite && (
              <FecharCompetenciaButton competencia={competencia} unitId={unitId} />
            )}
          </div>
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar repasses. Tente novamente.
            </AlertDescription>
          </Alert>
        )}

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total Bruto Recebido
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatBRL(totalBruto)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Total a Repassar
            </p>
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {formatBRL(totalRepasse)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Profissionais
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {countProfissionais}
            </p>
          </div>
        </div>

        {/* Sem regra alert */}
        {semRegraCount > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {semRegraCount} procedimento{semRegraCount > 1 ? 's' : ''} sem regra de comissão
              configurada. Repasse zerado nesses itens.
            </AlertDescription>
          </Alert>
        )}

        {/* Competência fechada alert — would be driven by a fechamento query in production */}

        {/* Payout table or empty state */}
        {payouts.length > 0 ? (
          <PayoutTable
            rows={payouts}
            canWrite={canWrite}
            competencia={competencia}
          />
        ) : !error ? (
          <EmptyState
            icon={Users}
            title="Nenhum repasse calculado"
            description="Concilie os recebimentos do período para calcular os repasses automaticamente."
          />
        ) : null}

        {/* Competência fechada info */}
        <Alert>
          <Lock className="size-4" />
          <AlertDescription>
            Exibindo repasses de {mesLabel}. Use os controles acima para navegar entre competências.
          </AlertDescription>
        </Alert>
      </main>
    </NuqsAdapter>
  )
}
