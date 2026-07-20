// src/components/relatorios/BiAlertsSection.tsx
// BI-01/BI-02 (Plan 19-13): fixed "Alertas & Previsões" section — rendered by the
// page ABOVE <BiDashboard>/<Tabs> so it stays visible across every tab switch (D-38).
//
// Reads bi_alerts rows (Plan 07's listBiAlerts) produced by the nightly forecast
// agent (Plan 08). Severity color + LLM narrative per card; "Revisar sugestão" link
// to the conformidade ApprovalInbox ONLY when approval_request_id is set (D-35) —
// purely informational alerts (revenue_decline, kpi_off_target, payment_delay,
// non-persistent budget_deviation) never get an action link.
//
// D-32 "insufficient data" notice: the nightly agent (bi-forecast-agent.ts)
// silently SKIPS forecast alerts when fewer than 3 monthly points exist — no
// dedicated bi_alerts row is ever written for that case. The page computes
// `insufficientHistory` from the earliest financial_transactions row (< 3 months
// of history) and passes it down here; this section renders the neutral notice
// independently of whatever concrete alerts (budget/kpi-off-target/payment-delay)
// may also be present, since those don't require forecast history.
import Link from 'next/link'
import { AlertTriangle, Info, ShieldCheck, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChartCard } from '@/components/relatorios/charts'
import { EmptyState } from '@/components/shell/EmptyState'
import type { BiAlertRow } from '@/actions/bi-alerts'

// ─── Severity → icon/color mapping (verde/amarelo/vermelho/info, D-38) ────────

const SEVERITY_META: Record<
  string,
  { icon: typeof AlertTriangle; iconClass: string; borderClass: string }
> = {
  vermelho: { icon: AlertTriangle, iconClass: 'text-destructive', borderClass: 'border-l-destructive' },
  amarelo: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-l-amber-500 dark:border-l-amber-400',
  },
  verde: {
    icon: TrendingUp,
    iconClass: 'text-green-700 dark:text-green-400',
    borderClass: 'border-l-green-600 dark:border-l-green-400',
  },
  info: { icon: Info, iconClass: 'text-muted-foreground', borderClass: 'border-l-muted-foreground/40' },
}

function severityMeta(severity: string) {
  return SEVERITY_META[severity] ?? SEVERITY_META.info!
}

const TRIGGER_LABELS: Record<string, string> = {
  revenue_decline: 'Tendência de receita',
  budget_deviation: 'Desvio orçamentário',
  kpi_off_target: 'Indicador fora da meta',
  payment_delay: 'Atraso de pagamento',
}

// ─── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: BiAlertRow }) {
  const meta = severityMeta(alert.severity)
  const Icon = meta.icon
  const triggerLabel = TRIGGER_LABELS[alert.triggerType] ?? alert.triggerType

  return (
    <div className={cn('flex gap-3 rounded-lg border border-border border-l-4 p-4', meta.borderClass)}>
      <Icon className={cn('size-5 shrink-0', meta.iconClass)} />
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {alert.kpiKey} · {triggerLabel}
        </p>
        <p className="text-sm">{alert.narrative ?? `Alerta gerado para o indicador ${alert.kpiKey}.`}</p>
        {alert.approvalRequestId && (
          <Link
            href="/conformidade/aprovacoes"
            className="inline-block text-sm text-primary underline underline-offset-2 hover:no-underline"
          >
            Revisar sugestão
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Insufficient-forecast-data notice (D-32) ──────────────────────────────────

function InsufficientDataNotice() {
  const meta = severityMeta('info')
  const Icon = meta.icon
  return (
    <div className={cn('flex gap-3 rounded-lg border border-border border-l-4 p-4', meta.borderClass)}>
      <Icon className={cn('size-5 shrink-0', meta.iconClass)} />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">Dados insuficientes para previsão</p>
        <p className="text-xs text-muted-foreground">
          Previsões aparecem após pelo menos 3 meses de histórico. Os KPIs atuais continuam disponíveis
          normalmente.
        </p>
      </div>
    </div>
  )
}

// ─── BiAlertsSection ──────────────────────────────────────────────────────────

export interface BiAlertsSectionProps {
  alerts: BiAlertRow[]
  alertsError: string | null
  insufficientHistory: boolean
}

export function BiAlertsSection({ alerts, alertsError, insufficientHistory }: BiAlertsSectionProps) {
  if (alertsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Não foi possível carregar os indicadores. Tente novamente em instantes.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <ChartCard title="Alertas & Previsões" description="Narrativa gerada por IA a partir dos indicadores do período">
      <div className="space-y-3">
        {insufficientHistory && <InsufficientDataNotice />}

        {alerts.length > 0 ? (
          alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        ) : !insufficientHistory ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum alerta no momento"
            description="Os indicadores estão dentro do esperado."
          />
        ) : null}
      </div>
    </ChartCard>
  )
}
