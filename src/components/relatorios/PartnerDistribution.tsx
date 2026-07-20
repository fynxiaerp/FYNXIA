'use client'
// src/components/relatorios/PartnerDistribution.tsx
// REP-03 (Plan 19-12): Societário distribution view + vigência history + "Encerrar
// vigência" destructive confirm + period filter (D-23/D-24/D-27, T-19-02).
//
// - Admin/superadmin (D-23): list of every sócio's percentual (Badge secondary) +
//   R$ calculado (Display 24px/600, tabular-nums). Negative valores render in
//   `text-destructive` — Intl currency formatting already prepends the minus sign
//   (D-27), never hidden/zeroed.
// - Sócio own-row (D-24): a single Card (no table chrome implying hidden rows) —
//   distribution already arrives RLS-scoped to just the caller's own row (T-19-02).
// - Vigência history: read-only expandable list (Accordion) grouped by
//   vigencia_inicio — editing = creating a new vigência (never mutates a closed
//   one). Admin/superadmin can "Encerrar vigência" (destructive AlertDialog) on the
//   currently open group.
//
// Deviation (Rule 2): the UI-SPEC's literal "Encerrar vigência de {nome_sócio}?"
// copy assumes one sócio per confirm, but closePartnerShareVigencia(vigenciaInicio)
// closes the WHOLE vigência set (every sócio active on that date) at once — the
// confirm below fills {nome_sócio} with the joined names of every sócio in that
// vigência group, preserving the rest of the copy verbatim.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/shell/EmptyState'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { closePartnerShareVigencia } from '@/actions/partner-shares'
import type { PartnerDistributionRow, PartnerShareRow, SocioRow } from '@/actions/partner-shares'

// ─── Helpers ────────────────────────────────────────────────────────────────

function BRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pctLabel(percentual: number): string {
  return `${(percentual * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function formatDateBR(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR')
}

function lastDayOfMonth(ym: string): string {
  const parts = ym.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

// ─── Period filter (D-40 "Exportar PDF" reads the same ?from&to) ─────────────
// Deviation (Rule 2, mirrors D-310/DreFilters.tsx precedent): not a separate file
// since 19-12-PLAN.md's <files> does not declare one — this module is already
// 'use client', so the interactive selector lives here instead of a new file.

export function SocietarioPeriodFilter() {
  const defaultYm = currentYearMonth()
  const [from, setFrom] = useQueryState('from', { defaultValue: `${defaultYm}-01` })
  const [to, setTo] = useQueryState('to', { defaultValue: lastDayOfMonth(defaultYm) })

  function handleMonthChange(value: string) {
    if (!value) return
    void setFrom(`${value}-01`)
    void setTo(lastDayOfMonth(value))
  }

  return (
    <input
      type="month"
      defaultValue={from.slice(0, 7)}
      onChange={(e) => handleMonthChange(e.target.value)}
      aria-label="Selecionar mês"
      className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  )
}

// ─── Vigência grouping (client-side, from listPartnerShares rows) ────────────

interface VigenciaMemberRow {
  userId: string
  name: string
  percentual: number
}

interface VigenciaGroup {
  inicio: string
  fim: string | null
  rows: VigenciaMemberRow[]
}

function groupShares(shares: PartnerShareRow[], nameMap: Map<string, string>): VigenciaGroup[] {
  const groups = new Map<string, VigenciaGroup>()
  for (const row of shares) {
    const key = row.vigenciaInicio
    const entry: VigenciaMemberRow = {
      userId: row.userId,
      name: nameMap.get(row.userId) ?? '—',
      percentual: row.percentual,
    }
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(entry)
      if (row.vigenciaFim !== null) existing.fim = row.vigenciaFim
    } else {
      groups.set(key, { inicio: key, fim: row.vigenciaFim, rows: [entry] })
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.inicio.localeCompare(a.inicio))
}

// ─── "Encerrar vigência" — destructive AlertDialog (D-20 history, T-19-10) ───

function EncerrarVigenciaButton({
  vigenciaInicio,
  sociosLabel,
}: {
  vigenciaInicio: string
  sociosLabel: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClose() {
    setLoading(true)
    setError(null)
    const result = await closePartnerShareVigencia({ vigenciaInicio })
    setLoading(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao encerrar vigência.')
    }
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={loading} />}>
          Encerrar vigência
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar vigência de {sociosLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              A cota deixará de valer a partir de hoje. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Encerrar vigência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Vigência history section (shared by both admin and sócio views) ────────

function VigenciaHistorySection({
  shares,
  nameMap,
  isAdmin,
}: {
  shares: PartnerShareRow[]
  nameMap: Map<string, string>
  isAdmin: boolean
}) {
  if (shares.length === 0) return null
  const vigencias = groupShares(shares, nameMap)

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-display text-xl font-semibold">Histórico de vigências</h3>
        <p className="text-sm text-muted-foreground">
          Somente leitura — editar significa criar uma nova vigência.
        </p>
      </div>
      <div className="px-4 py-1">
        <Accordion multiple className="w-full">
          {vigencias.map((v) => {
            const sociosLabel = v.rows.map((r) => r.name).join(', ')
            return (
              <AccordionItem key={v.inicio} value={v.inicio}>
                <AccordionTrigger>
                  <div className="flex flex-1 items-center justify-between pr-2">
                    <span className="text-sm">
                      {formatDateBR(v.inicio)}
                      {v.fim ? ` até ${formatDateBR(v.fim)}` : ' — vigente'}
                    </span>
                    {v.fim === null && <Badge variant="secondary">Vigente</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-4">
                    {v.rows.map((r) => (
                      <div key={r.userId} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">{r.name}</span>
                        <span className="tabular-nums">{pctLabel(r.percentual)}</span>
                      </div>
                    ))}
                  </div>
                  {isAdmin && v.fim === null && (
                    <div className="pl-4 pt-2">
                      <EncerrarVigenciaButton vigenciaInicio={v.inicio} sociosLabel={sociosLabel} />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </div>
  )
}

// ─── PartnerDistribution ──────────────────────────────────────────────────────

export interface PartnerDistributionProps {
  role: string
  isAdmin: boolean
  resultado: number
  distribution: PartnerDistributionRow[]
  distError: string | null
  shares: PartnerShareRow[]
  socios: SocioRow[]
}

export function PartnerDistribution({
  role,
  isAdmin,
  resultado,
  distribution,
  distError,
  shares,
  socios,
}: PartnerDistributionProps) {
  const nameMap = new Map(socios.map((s) => [s.id, s.name]))

  if (distError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{distError}</AlertDescription>
      </Alert>
    )
  }

  // ── Sócio own-row-only view (D-24) — single Card, no table chrome ─────────
  if (role === 'socio') {
    const own = distribution[0]
    return (
      <div className="space-y-6">
        {!own ? (
          <EmptyState
            icon={Users}
            title="Nenhuma cota societária cadastrada"
            description="Cadastre os sócios e seus percentuais para visualizar a distribuição de lucro."
          />
        ) : (
          <Card className="gap-2 max-w-sm">
            <div className="px-(--card-spacing) flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sua cota — {own.name}</span>
              <Badge variant="secondary">{pctLabel(own.percentual)}</Badge>
            </div>
            <div className="px-(--card-spacing)">
              <span
                className={cn(
                  'text-2xl font-semibold font-display tabular-nums',
                  own.valor < 0 && 'text-destructive'
                )}
              >
                {BRL(own.valor)}
              </span>
            </div>
            <p className="px-(--card-spacing) text-xs text-muted-foreground">
              Resultado do período: {BRL(resultado)}
            </p>
          </Card>
        )}

        <VigenciaHistorySection shares={shares} nameMap={nameMap} isAdmin={isAdmin} />
      </div>
    )
  }

  // ── Admin/superadmin: full distribution list (D-23) ──────────────────────
  return (
    <div className="space-y-6">
      {distribution.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhuma cota societária cadastrada"
          description="Cadastre os sócios e seus percentuais para visualizar a distribuição de lucro."
        />
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display text-xl font-semibold">Distribuição por sócio</h3>
            <p className="text-sm text-muted-foreground">Resultado do período: {BRL(resultado)}</p>
          </div>
          <div className="divide-y divide-border">
            {distribution.map((d) => (
              <div key={d.userId} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="truncate text-sm">{d.name}</span>
                  <Badge variant="secondary">{pctLabel(d.percentual)}</Badge>
                </div>
                <span
                  className={cn(
                    'text-2xl font-semibold font-display tabular-nums',
                    d.valor < 0 && 'text-destructive'
                  )}
                >
                  {BRL(d.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <VigenciaHistorySection shares={shares} nameMap={nameMap} isAdmin={isAdmin} />
    </div>
  )
}
