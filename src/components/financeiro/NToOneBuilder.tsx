'use client'

// NToOneBuilder — N:1 bank reconciliation Sheet.
// Allows user to select N pending financial_transactions to match 1 OFX line.
// Tolerance gate: |lineAmount - selectedSum| <= R$5,00 enables Confirmar button.
// Fee > 0: shows "Taxa bancária de R$ X,XX será lançada como despesa".
// Pattern: shadcn Sheet side="right" — mirrors OsSheet.tsx.

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { matchNToOne } from '@/actions/reconciliation'
import { formatBRL } from '@/lib/format/money'
import type { StatementLineRow } from '@/components/financeiro/StatementLinesTable'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingTransaction = {
  id: string
  amount: number
  transaction_date: string
  description: string | null
  reconciliation_status: string
}

interface NToOneBuilderProps {
  line: StatementLineRow
  open: boolean
  onOpenChange: (open: boolean) => void
  bankAccountId: string
  onSuccess: () => void
}

// ─── NToOneBuilder ────────────────────────────────────────────────────────────

export function NToOneBuilder({
  line,
  open,
  onOpenChange,
  bankAccountId,
  onSuccess,
}: NToOneBuilderProps) {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load pending transactions when sheet opens
  useEffect(() => {
    if (!open || !bankAccountId) return

    async function loadTransactions() {
      setLoading(true)
      setError(null)
      try {
        // Fetch pending financial_transactions for this bank account via the API
        const res = await fetch(
          `/api/financeiro/transactions/pending?bankAccountId=${encodeURIComponent(bankAccountId)}`
        )
        if (res.ok) {
          const data = await res.json()
          setTransactions(data.transactions ?? [])
        } else {
          // Graceful fallback — show empty list
          setTransactions([])
        }
      } catch {
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    void loadTransactions()
    setSelected(new Set())
    setError(null)
  }, [open, bankAccountId])

  // Running sum of selected transaction amounts
  const selectedSum = transactions
    .filter((tx) => selected.has(tx.id))
    .reduce((sum, tx) => sum + tx.amount, 0)

  const lineAmount = Math.abs(line.amount)
  const difference = lineAmount - selectedSum
  const absDiff = Math.abs(difference)
  const withinTolerance = absDiff <= 5.0 && selected.size > 0
  const hasFee = difference > 0.005

  function toggleSelect(txId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }

  async function handleConfirm() {
    if (!withinTolerance) return
    setSubmitting(true)
    setError(null)

    const result = await matchNToOne({
      statementLineId: line.id,
      tolerance: 5.0,
    })

    setSubmitting(false)

    if (result.success) {
      onOpenChange(false)
      onSuccess()
    } else {
      setError(result.error ?? 'Erro ao conciliar N:1.')
    }
  }

  let dateDisplay = line.transaction_date
  try {
    dateDisplay = format(parseISO(line.transaction_date), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    // keep raw
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Conciliar N:1</SheetTitle>
          <SheetDescription>
            Selecione os lançamentos que correspondem a esta linha do extrato.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* OFX line details */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Linha do Extrato
            </p>
            <p className="text-sm font-medium">{line.memo || '—'}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{dateDisplay}</span>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  line.amount >= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {line.amount < 0
                  ? `−${formatBRL(Math.abs(line.amount))}`
                  : formatBRL(line.amount)}
              </span>
            </div>
          </div>

          {/* Transaction list */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Lançamentos Pendentes</p>

            {loading && (
              <p className="text-sm text-muted-foreground">Carregando lançamentos...</p>
            )}

            {!loading && transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento pendente para esta conta.
              </p>
            )}

            {!loading && transactions.map((tx) => {
              const isSelected = selected.has(tx.id)
              let txDate = tx.transaction_date
              try {
                txDate = format(parseISO(tx.transaction_date), 'dd/MM/yyyy', { locale: ptBR })
              } catch {
                // keep raw
              }

              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-accent/20'
                      : 'border-border hover:bg-accent/10'
                  }`}
                  onClick={() => toggleSelect(tx.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === ' ' && toggleSelect(tx.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(tx.id)}
                    aria-label={`Selecionar lançamento ${tx.description ?? ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{txDate}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-green-700">
                    {formatBRL(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Running total + difference */}
          {selected.size > 0 && (
            <div className="rounded-lg border border-border bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selecionado:</span>
                <span className="font-semibold tabular-nums">
                  {formatBRL(selectedSum)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Diferença:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    absDiff <= 5.0 ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  {difference < 0
                    ? `−${formatBRL(Math.abs(difference))}`
                    : formatBRL(Math.abs(difference))}
                </span>
              </div>
              {hasFee && withinTolerance && (
                <p className="text-xs text-amber-700">
                  Taxa bancária de {formatBRL(difference)} será lançada como despesa.
                </p>
              )}
              {!withinTolerance && selected.size > 0 && (
                <Badge className="border text-xs bg-red-100 text-red-800 border-red-200">
                  Diferença excede R$ 5,00
                </Badge>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!withinTolerance || submitting}
          >
            {submitting ? 'Conciliando...' : 'Conciliar N:1'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
