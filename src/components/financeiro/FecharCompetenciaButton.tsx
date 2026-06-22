'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { fecharCompetencia } from '@/actions/professional-payouts'

// ─── FecharCompetenciaButton ──────────────────────────────────────────────────
// Destructive AlertDialog that calls fecharCompetencia server action (D-26).
// Copy verbatim from 16-UI-SPEC.md "Destructive: Fechar Competência".

interface FecharCompetenciaButtonProps {
  competencia: string
  unitId?: string
}

function formatMesLabel(comp: string): string {
  const parts = comp.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

export function FecharCompetenciaButton({ competencia, unitId }: FecharCompetenciaButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const mesLabel = formatMesLabel(competencia)

  async function handleFechar() {
    if (!unitId) {
      setError('Selecione uma unidade antes de fechar a competência.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await fecharCompetencia({ competencia, unitId })
      if (r.success) {
        router.refresh()
      } else {
        setError(r.error ?? 'Erro ao fechar competência')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              size="sm"
              disabled={loading}
            />
          }
        >
          Fechar Competência
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Competência {mesLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Após fechar, novos recebimentos irão para a próxima competência. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFechar}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fechar Competência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
