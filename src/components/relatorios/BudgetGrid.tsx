'use client'
// src/components/relatorios/BudgetGrid.tsx
// REP-02 (Plan 11): 12-month editable meta grid per conta contábil, with realizado
// (read-only) and the desvio semáforo (D-15). Past-month cells are locked (D-13/D-18).
// "Copiar do ano anterior" (D-17) clones ano-1 → ano. "Salvar metas" (D-14) persists
// edits via saveBudgetTargets — one Server Action call per conta (accountId), since
// the action's contract is 1 payload = 1 conta × 1 unidade/rede × 12 meses.
//
// Copy source: 19-UI-SPEC.md §Copywriting Contract / §Orçamento-specific.
// Typography: exactly 2 weights (400/600) — no font-bold/font-medium anywhere below.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

import { saveBudgetTargets, copyBudgetFromPreviousYear } from '@/actions/budget-targets'
import type { BudgetVsRealizadoRow, BudgetVsRealizadoCell } from '@/actions/budget-targets'
import { budgetDeviationSemaphore, type DeviationSemaphore } from '@/lib/financeiro/dre-math'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── Client-side mirror of isMonthLocked (D-18) — pure duplicate, avoids an async
// Server Action round-trip just to shape a freshly-added row's initial lock state.
// Server (budget-targets.ts saveBudgetTargets) remains the enforced source of truth;
// this only drives the initial UI affordance for months added client-side.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3 fixo (sem DST desde 2019)

function isMonthLockedClient(ano: number, mes: number): boolean {
  const now = new Date()
  const sp = new Date(now.getTime() - SP_OFFSET_MS)
  const currentAno = sp.getUTCFullYear()
  const currentMes = sp.getUTCMonth() + 1
  if (ano < currentAno) return true
  if (ano > currentAno) return false
  return mes < currentMes
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function semaphoreClass(s: DeviationSemaphore): string {
  if (s === 'verde') return 'text-green-700 dark:text-green-400'
  if (s === 'amarelo') return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

function deviationPct(realizado: number, meta: number): number {
  if (meta === 0) return realizado === 0 ? 0 : 100
  return ((realizado - meta) / meta) * 100
}

interface AccountOption {
  id: string
  name: string
}

interface EditableRow {
  accountId: string
  accountName: string
  meses: BudgetVsRealizadoCell[]
}

interface BudgetGridProps {
  ano: number
  unitId?: string
  rows: BudgetVsRealizadoRow[]
  accountOptions: AccountOption[]
}

export function BudgetGrid({ ano, unitId, rows, accountOptions }: BudgetGridProps) {
  const router = useRouter()
  const [gridRows, setGridRows] = useState<EditableRow[]>(() =>
    rows.map((r) => ({ accountId: r.accountId, accountName: r.accountName, meses: r.meses.map((m) => ({ ...m })) }))
  )
  const [newAccountId, setNewAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()
  const [isCopying, startCopying] = useTransition()

  const usedAccountIds = new Set(gridRows.map((r) => r.accountId))
  const availableAccounts = accountOptions.filter((a) => !usedAccountIds.has(a.id))

  const sumMeta = gridRows.reduce((s, r) => s + r.meses.reduce((s2, m) => s2 + m.meta, 0), 0)
  const sumRealizado = gridRows.reduce((s, r) => s + r.meses.reduce((s2, m) => s2 + m.realizado, 0), 0)
  const overallSemaphore = budgetDeviationSemaphore(sumRealizado, sumMeta)
  const overallDeviation = deviationPct(sumRealizado, sumMeta)

  function handleMetaChange(accountId: string, mes: number, rawValue: string) {
    const parsed = rawValue === '' ? 0 : Number(rawValue)
    if (Number.isNaN(parsed)) return
    setGridRows((prev) =>
      prev.map((r) =>
        r.accountId !== accountId
          ? r
          : {
              ...r,
              meses: r.meses.map((m) =>
                m.mes !== mes ? m : { ...m, meta: parsed, semaphore: budgetDeviationSemaphore(m.realizado, parsed) }
              ),
            }
      )
    )
  }

  function handleAddAccount() {
    if (!newAccountId) return
    const account = accountOptions.find((a) => a.id === newAccountId)
    if (!account) return
    setGridRows((prev) => [
      ...prev,
      {
        accountId: account.id,
        accountName: account.name,
        meses: Array.from({ length: 12 }, (_, i) => ({
          mes: i + 1,
          meta: 0,
          realizado: 0,
          semaphore: 'verde' as DeviationSemaphore,
          locked: isMonthLockedClient(ano, i + 1),
        })),
      },
    ])
    setNewAccountId('')
  }

  function handleSave() {
    setError(null)
    startSaving(async () => {
      for (const row of gridRows) {
        const result = await saveBudgetTargets({
          accountId: row.accountId,
          unitId: unitId ?? null,
          ano,
          meses: row.meses.map((m) => ({ mes: m.mes, valor: m.meta })),
        })
        if (!result.success) {
          setError('Não foi possível salvar as metas. Verifique os valores e tente novamente.')
          return
        }
      }
      router.refresh()
    })
  }

  function handleCopyFromPreviousYear() {
    setError(null)
    startCopying(async () => {
      const result = await copyBudgetFromPreviousYear({ ano, unitId })
      if (!result.success) {
        setError('Não foi possível copiar as metas do ano anterior. Tente novamente.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* KPI row — visual anchor (Display role, 24px/600) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="gap-2">
          <div className="px-(--card-spacing)">
            <span className="text-sm text-muted-foreground">Meta (ano)</span>
          </div>
          <div className="px-(--card-spacing)">
            <span className="text-2xl font-semibold font-display tabular-nums">{formatBRL(sumMeta)}</span>
          </div>
        </Card>
        <Card className="gap-2">
          <div className="px-(--card-spacing)">
            <span className="text-sm text-muted-foreground">Realizado (ano)</span>
          </div>
          <div className="px-(--card-spacing)">
            <span className="text-2xl font-semibold font-display tabular-nums">{formatBRL(sumRealizado)}</span>
          </div>
        </Card>
        <Card className="gap-2">
          <div className="px-(--card-spacing)">
            <span className="text-sm text-muted-foreground">Desvio</span>
          </div>
          <div className="px-(--card-spacing)">
            <span
              className={`text-2xl font-semibold font-display tabular-nums ${semaphoreClass(overallSemaphore)}`}
            >
              {overallDeviation >= 0 ? '+' : ''}
              {overallDeviation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          </div>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions row: add conta / copiar do ano anterior / salvar metas */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {availableAccounts.length > 0 && (
            <>
              <Select value={newAccountId} onValueChange={(v) => setNewAccountId(v ?? '')}>
                <SelectTrigger className="w-[220px]" aria-label="Selecionar conta contábil">
                  <SelectValue placeholder="Adicionar conta contábil" />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" disabled={!newAccountId} onClick={handleAddAccount}>
                Adicionar conta
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isCopying} onClick={handleCopyFromPreviousYear}>
            {isCopying ? 'Copiando...' : 'Copiar do ano anterior'}
          </Button>
          <Button type="button" size="sm" disabled={isSaving || gridRows.length === 0} onClick={handleSave}>
            {isSaving ? 'Salvando...' : 'Salvar metas'}
          </Button>
        </div>
      </div>

      {/* Table section */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display text-xl font-semibold">Metas por conta contábil</h3>
          <p className="text-sm text-muted-foreground">
            Meta editável, realizado (calculado) e desvio por mês, para o ano de {ano}.
          </p>
        </div>

        {gridRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <h3 className="font-display text-xl font-semibold">
              Nenhum orçamento cadastrado para {ano}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie metas mensais por conta contábil ou copie os valores do ano anterior para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left text-xs text-muted-foreground min-w-[180px]">
                    Conta contábil
                  </th>
                  {MESES_LABEL.map((label) => (
                    <th key={label} className="px-2 py-2 text-center text-xs text-muted-foreground min-w-[104px]">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row) => (
                  <tr key={row.accountId} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm min-w-[180px]">
                      {row.accountName}
                    </td>
                    {row.meses.map((cell) => (
                      <td key={cell.mes} className="px-2 py-2 min-w-[104px]">
                        <div className="flex flex-col items-stretch gap-1">
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              disabled={cell.locked}
                              value={cell.meta === 0 ? '' : cell.meta}
                              placeholder="0"
                              aria-label={`Meta ${MESES_LABEL[cell.mes - 1]}`}
                              className={cell.locked ? 'bg-muted text-muted-foreground pr-6' : 'pr-6'}
                              onChange={(e) => handleMetaChange(row.accountId, cell.mes, e.target.value)}
                            />
                            {cell.locked && (
                              <Lock className="size-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums text-center">
                            {formatBRL(cell.realizado)}
                          </span>
                          <span
                            className={`text-xs tabular-nums text-center ${semaphoreClass(cell.semaphore)}`}
                          >
                            {deviationPct(cell.realizado, cell.meta) >= 0 ? '+' : ''}
                            {deviationPct(cell.realizado, cell.meta).toLocaleString('pt-BR', {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
