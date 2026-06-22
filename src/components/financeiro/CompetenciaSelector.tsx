'use client'

import * as React from 'react'
import { useQueryState } from 'nuqs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── CompetenciaSelector ──────────────────────────────────────────────────────
// Reusable prev/next month nav using nuqs URL state.
// Uses ?competencia=YYYY-MM; mirrors fluxo-de-caixa month nav pattern.
// Displayed as "Jun/2026" (capitalize class + date formatting).

function formatCompetenciaLabel(competencia: string): string {
  try {
    const parts = competencia.split('-')
    const y = parseInt(parts[0] ?? '2026', 10)
    const m = parseInt(parts[1] ?? '1', 10)
    const date = new Date(y, m - 1, 1)
    const monthName = date.toLocaleString('pt-BR', { month: 'short' })
    // Capitalize: "jun." → "Jun/2026"
    const capitalizedMonth = monthName.replace(/^\w/, (c) => c.toUpperCase()).replace('.', '')
    return `${capitalizedMonth}/${y}`
  } catch {
    return competencia
  }
}

function prevCompetencia(c: string): string {
  const parts = c.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextCompetencia(c: string): string {
  const parts = c.split('-')
  const y = parseInt(parts[0] ?? '2026', 10)
  const m = parseInt(parts[1] ?? '1', 10)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function CompetenciaSelector() {
  const [competencia, setCompetencia] = useQueryState('competencia', {
    defaultValue: currentYearMonth(),
  })

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="size-8 p-0"
        onClick={() => setCompetencia(prevCompetencia(competencia))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-semibold capitalize min-w-[80px] text-center">
        {formatCompetenciaLabel(competencia)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="size-8 p-0"
        onClick={() => setCompetencia(nextCompetencia(competencia))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
