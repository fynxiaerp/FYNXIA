'use client'
// src/components/relatorios/PartnerShareFormDialog.tsx
// REP-03 (Plan 19-12): "Nova vigência" form — Plus-icon trigger (admin/superadmin
// only, gated by the caller in page.tsx), lists every sócio with a percentual input
// and blocks "Salvar" while the running sum ≠ 100% (D-22, T-19-09).
//
// Pattern: trigger wrapper mirrors CostCenterFormDialog.tsx (div + onClick, avoids
// nested <button>, @base-ui Button render-prop convention per CLAUDE.md). Plain
// React state (not RHF) is used for the dynamic per-sócio percentual list — mirrors
// BudgetGrid.tsx's approach for a same-shaped "list of numeric inputs" problem.
//
// Percentuais are collected as 0–100 in the UI but converted to the 0–1 decimal
// expected by partnerShareSetSchema (percentual .max(1)) before calling
// createPartnerShareVigencia — server re-validates sum-to-100% regardless
// (D-22 defense-in-depth, assertSharesValid).
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { createPartnerShareVigencia } from '@/actions/partner-shares'
import type { SocioRow } from '@/actions/partner-shares'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

const SUM_TOLERANCE = 0.01

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface PartnerShareFormDialogProps {
  socios: SocioRow[]
  trigger: React.ReactNode
}

export function PartnerShareFormDialog({ socios, trigger }: PartnerShareFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [vigenciaInicio, setVigenciaInicio] = useState(todayIso())
  const [percentuais, setPercentuais] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  function handleOpen(value: boolean) {
    if (value) {
      setVigenciaInicio(todayIso())
      setPercentuais({})
      setError(null)
    }
    setOpen(value)
  }

  function handlePercentualChange(socioId: string, value: string) {
    setPercentuais((prev) => ({ ...prev, [socioId]: value }))
  }

  const sum = Object.values(percentuais).reduce((total, v) => total + (Number(v) || 0), 0)
  const sumValid = Math.abs(sum - 100) < SUM_TOLERANCE

  function handleSubmit() {
    setError(null)

    const shares = socios
      .map((s) => ({ userId: s.id, percentual: (Number(percentuais[s.id]) || 0) / 100 }))
      .filter((s) => s.percentual > 0)

    if (shares.length === 0) {
      setError('Informe o percentual de ao menos um sócio.')
      return
    }
    if (!sumValid) {
      setError('A soma dos percentuais deve ser exatamente 100%. Ajuste os valores antes de salvar.')
      return
    }

    startSaving(async () => {
      const result = await createPartnerShareVigencia({ vigenciaInicio, shares })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <>
      {/* Trigger — wrapper div avoids nested button (D-14-05-01 pattern) */}
      <div
        className="contents"
        onClick={() => handleOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen(true)}
        role="presentation"
      >
        {trigger}
      </div>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-lg bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Nova vigência</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="vigencia-inicio">
                Início da vigência *
              </label>
              <Input
                id="vigencia-inicio"
                type="date"
                value={vigenciaInicio}
                onChange={(e) => setVigenciaInicio(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Percentuais por sócio *</span>
              {socios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado nesta clínica.</p>
              ) : (
                <div className="space-y-2">
                  {socios.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm truncate">{s.name}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={percentuais[s.id] ?? ''}
                          onChange={(e) => handlePercentualChange(s.id, e.target.value)}
                          className="w-24 bg-background border-border text-foreground text-right"
                          aria-label={`Percentual de ${s.name}`}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Soma dos percentuais</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  sumValid ? 'text-primary' : 'text-destructive'
                )}
              >
                {sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
              </span>
            </div>

            {!sumValid && (
              <p className="text-xs text-destructive">
                A soma dos percentuais deve ser exatamente 100%. Ajuste os valores antes de salvar.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!sumValid || isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
