'use client'
// src/components/relatorios/OrcamentoFilters.tsx
// REP-02 (Plan 11): ano/unidade selector for the Orçamento screen, URL state via nuqs —
// shareable, reflected by "Exportar PDF" (D-19/D-40) which reads the same ?ano&unit.
//
// Deviation (Rule 2, mirrors D-310 precedent from Plan 19-10/DreFilters.tsx): not listed
// in 19-11-PLAN.md's <files> for Task 1, but the task's own <action> requires an ano/unit
// selector living in the PageHeader actions slot — a 'use client' selector cannot live in
// the same file as the async Server Component page.tsx.
import { useQueryState } from 'nuqs'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UnitOption {
  id: string
  name: string
}

interface OrcamentoFiltersProps {
  units: UnitOption[]
  currentAno: number
}

export function OrcamentoFilters({ units, currentAno }: OrcamentoFiltersProps) {
  const [ano, setAno] = useQueryState('ano', { defaultValue: String(currentAno) })
  const [unit, setUnit] = useQueryState('unit', { defaultValue: '' })

  const thisYear = new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => thisYear - 3 + i)

  function handleAnoChange(value: string | null) {
    if (!value) return
    void setAno(value)
  }

  function handleUnitChange(value: string | null) {
    void setUnit(!value || value === 'all' ? '' : value)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <Select value={ano} onValueChange={handleAnoChange}>
        <SelectTrigger className="w-[100px]" aria-label="Selecionar ano">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anos.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {units.length > 0 && (
        <Select value={unit || 'all'} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[180px]" aria-label="Selecionar unidade">
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
