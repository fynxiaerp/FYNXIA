'use client'
// src/components/relatorios/DreFilters.tsx
// REP-01 (D-02/D-03): seletor de período (mês/ano padrão + intervalo customizado)
// + seletor de unidade (Todas/individual). URL state via nuqs — compartilhável,
// refletido no botão "Exportar PDF" (D-07) que lê os mesmos ?from&to&unit.
//
// Deviation (Rule 2): not listed in 19-10-PLAN.md's `<files>` for Task 1, but the
// task's own <action> requires a period+unit selector living in the PageHeader
// actions slot — a 'use client' selector cannot live in the same file as the
// async Server Component page.tsx, so it is split out here (mirrors the existing
// CashFlowFilters.tsx pattern).
import { useState } from 'react'
import { useQueryState } from 'nuqs'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface UnitOption {
  id: string
  name: string
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

export function DreFilters({ units }: { units: UnitOption[] }) {
  const defaultYm = currentYearMonth()
  const [from, setFrom] = useQueryState('from', { defaultValue: `${defaultYm}-01` })
  const [to, setTo] = useQueryState('to', { defaultValue: lastDayOfMonth(defaultYm) })
  const [unit, setUnit] = useQueryState('unit', { defaultValue: '' })
  const [mode, setMode] = useState<'mes' | 'custom'>('mes')

  function handleMonthChange(value: string) {
    if (!value) return
    void setFrom(`${value}-01`)
    void setTo(lastDayOfMonth(value))
  }

  function handleUnitChange(value: string | null) {
    void setUnit(!value || value === 'all' ? '' : value)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        <Button
          type="button"
          size="sm"
          variant={mode === 'mes' ? 'secondary' : 'ghost'}
          onClick={() => setMode('mes')}
        >
          Mês
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'custom' ? 'secondary' : 'ghost'}
          onClick={() => setMode('custom')}
        >
          Período
        </Button>
      </div>

      {mode === 'mes' ? (
        <input
          type="month"
          defaultValue={from.slice(0, 7)}
          onChange={(e) => handleMonthChange(e.target.value)}
          aria-label="Selecionar mês"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => void setFrom(e.target.value)}
            aria-label="Data inicial"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="text-sm text-muted-foreground">até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => void setTo(e.target.value)}
            aria-label="Data final"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {units.length > 0 && (
        <Select value={unit || 'all'} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
