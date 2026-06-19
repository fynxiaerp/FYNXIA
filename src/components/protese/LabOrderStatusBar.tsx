'use client'
/**
 * LabOrderStatusBar — Controle de status + lançamento de custo no financeiro (LAB-01/LAB-02)
 *
 * Props:
 *   order — { id, status, cost, financial_transaction_id, lab_name, prosthesis_type, order_number }
 *   onUpdate — callback após mudança de status ou custo lançado
 *
 * Status control: três etapas enviado→prova→concluído (Select).
 *   Chama updateLabOrderStatus(order.id, next); reflete o estado com Badge.
 *
 * Custo:
 *   - Se financial_transaction_id está definido → exibe "Custo lançado no financeiro: R$ X"
 *     como indicador bloqueado/read-only (SEM CTA de re-postagem — LAB-02 double-post prevention).
 *   - Senão → input numérico + botão "Lançar custo no financeiro" habilitado somente
 *     quando isCostPostable(valor). Chama setLabOrderCost(order.id, valor).
 *     Em sucesso exibe o estado "lançado". Em erro exibe Alert.
 *
 * @base-ui Button render-prop, NUNCA asChild.
 * Design tokens apenas. pt-BR.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 * Requirements: LAB-01, LAB-02
 * Threat: T-13-27 (double-post locked once financial_transaction_id set)
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { isCostPostable } from '@/lib/protese/lab-cost'
import { updateLabOrderStatus, setLabOrderCost } from '@/actions/lab-orders'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabOrderForStatusBar {
  id: string
  status: 'enviado' | 'prova' | 'concluido'
  cost: number | null
  financial_transaction_id: string | null
  lab_name: string
  prosthesis_type: string
  order_number: string | null
}

interface LabOrderStatusBarProps {
  order: LabOrderForStatusBar
  onUpdate?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function statusBadge(status: string): { label: string; variant: BadgeVariant; className: string } {
  switch (status) {
    case 'enviado':
      return { label: 'Enviado', variant: 'secondary', className: 'text-muted-foreground' }
    case 'prova':
      return {
        label: 'Em Prova',
        variant: 'outline',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
      }
    case 'concluido':
      return {
        label: 'Concluído',
        variant: 'default',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0',
      }
    default:
      return { label: status, variant: 'secondary', className: '' }
  }
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LabOrderStatusBar({ order, onUpdate }: LabOrderStatusBarProps) {
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<'enviado' | 'prova' | 'concluido'>(order.status)

  const [costValue, setCostValue] = useState<string>(
    order.cost !== null && order.cost !== undefined ? String(order.cost) : ''
  )
  const [costError, setCostError] = useState<string | null>(null)
  const [costLoading, setCostLoading] = useState(false)
  // Once posted, track locally so the UI locks without a page refresh
  const [posted, setPosted] = useState<{ transactionId: string; amount: number } | null>(
    order.financial_transaction_id
      ? { transactionId: order.financial_transaction_id, amount: order.cost ?? 0 }
      : null
  )

  // ── Status control ──────────────────────────────────────────────────────────

  async function handleStatusChange(next: string | null) {
    if (!next) return
    const nextStatus = next as 'enviado' | 'prova' | 'concluido'
    setStatusError(null)
    setStatusLoading(true)
    const result = await updateLabOrderStatus(order.id, nextStatus)
    setStatusLoading(false)

    if (!result.success) {
      setStatusError(result.error ?? 'Erro ao atualizar status.')
      return
    }

    setCurrentStatus(nextStatus)
    onUpdate?.()
  }

  // ── Cost posting ────────────────────────────────────────────────────────────

  const parsedCost = parseFloat(costValue)
  const canPost = isCostPostable(isNaN(parsedCost) ? null : parsedCost)

  async function handlePostCost() {
    setCostError(null)
    if (!canPost) return

    setCostLoading(true)
    const result = await setLabOrderCost(order.id, parsedCost)
    setCostLoading(false)

    if (!result.success) {
      setCostError(result.error ?? 'Erro ao lançar custo no financeiro.')
      return
    }

    setPosted({ transactionId: result.financialTransactionId ?? '', amount: parsedCost })
    onUpdate?.()
  }

  const badge = statusBadge(currentStatus)

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      {/* Header: tipo + n.º OS + lab */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{order.prosthesis_type}</p>
          <p className="text-xs text-muted-foreground">
            {order.order_number ? `OS ${order.order_number} · ` : ''}
            {order.lab_name}
          </p>
        </div>
        <Badge variant={badge.variant} className={badge.className}>
          {badge.label}
        </Badge>
      </div>

      {/* Status control */}
      <div className="space-y-1.5">
        <Label htmlFor={`status-${order.id}`} className="text-xs text-muted-foreground">
          Status da OS
        </Label>
        <Select
          value={currentStatus}
          onValueChange={handleStatusChange}
          disabled={statusLoading}
        >
          <SelectTrigger
            id={`status-${order.id}`}
            className="w-full bg-background border-border text-foreground text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            <SelectItem value="enviado" className="text-foreground">Enviado</SelectItem>
            <SelectItem value="prova" className="text-foreground">Em Prova</SelectItem>
            <SelectItem value="concluido" className="text-foreground">Concluído</SelectItem>
          </SelectContent>
        </Select>
        {statusError && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{statusError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Cost section */}
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Custo / Financeiro
        </p>

        {/* LAB-02: locked state — financial_transaction_id already set */}
        {posted ? (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              Lançado no financeiro:
            </span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
              {formatCurrency(posted.amount)}
            </span>
          </div>
        ) : (
          /* Pre-posting: cost input + CTA */
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`cost-${order.id}`} className="text-xs">
                  Custo (R$)
                </Label>
                <Input
                  id={`cost-${order.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={costValue}
                  onChange={(e) => {
                    setCostValue(e.target.value)
                    setCostError(null)
                  }}
                  className="bg-background border-border text-foreground text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!canPost || costLoading}
                onClick={handlePostCost}
              >
                {costLoading ? 'Lançando...' : 'Lançar no Financeiro'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao lançar, uma despesa será criada no módulo financeiro (LAB-02). Esta ação não pode ser desfeita por aqui.
            </p>
            {costError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{costError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
