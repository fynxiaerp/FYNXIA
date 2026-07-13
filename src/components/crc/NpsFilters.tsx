'use client'

// NpsFilters — date range (De/Até) + unit Select (only when multi-unit) for
// the NPS panel (CRC-04). URL state via nuqs — mirrors RoiFilters.tsx.
// Not in Plan 10's files_modified list — added per UI-SPEC §5 filter contract
// ("Filtros (nuqs): Date range + Select de unidade se multi-unidade") — Rule 2
// missing-piece completion, same precedent as RoiFilters in Plan 05.

import { useQueryState } from 'nuqs'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface UnitOption {
  id: string
  name: string
}

interface NpsFiltersProps {
  units: UnitOption[]
}

export function NpsFilters({ units }: NpsFiltersProps) {
  const [unidade, setUnidade] = useQueryState('unidade', { defaultValue: '' })
  const [from, setFrom] = useQueryState('from', { defaultValue: '' })
  const [to, setTo] = useQueryState('to', { defaultValue: '' })

  function handleUnidadeChange(value: string | null) {
    void setUnidade(!value || value === 'all' ? '' : value)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {units.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Unidade:</span>
          <Select value={unidade || 'all'} onValueChange={handleUnidadeChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">De:</span>
        <Input
          type="date"
          className="w-[160px]"
          value={from}
          onChange={(e) => void setFrom(e.target.value || '')}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Até:</span>
        <Input
          type="date"
          className="w-[160px]"
          value={to}
          onChange={(e) => void setTo(e.target.value || '')}
        />
      </div>
    </div>
  )
}
