'use client'
// src/components/financeiro/CashFlowFilters.tsx
// FCAD-02 SC2: unit/CC filter controls for Fluxo de Caixa.
// URL state via nuqs useQueryState — filter persists across refreshes and is shareable.
// T-14-20: filtering by cc/unit id only narrows already-tenant-scoped rows via RLS.

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

interface CostCenterOption {
  id: string
  name: string
  unit_id?: string | null
}

interface CashFlowFiltersProps {
  units: UnitOption[]
  costCenters: CostCenterOption[]
}

export function CashFlowFilters({ units, costCenters }: CashFlowFiltersProps) {
  const [unitId, setUnitId] = useQueryState('unit', { defaultValue: '' })
  const [ccId, setCcId] = useQueryState('cc', { defaultValue: '' })

  // When a unit is selected, narrow CC options to that unit's CCs
  const filteredCostCenters =
    unitId && unitId !== ''
      ? costCenters.filter((cc) => cc.unit_id === unitId)
      : costCenters

  function handleUnitChange(value: string | null) {
    const newUnit = !value || value === 'all' ? '' : value
    void setUnitId(newUnit)
    // Reset CC filter if it no longer belongs to the newly selected unit
    if (newUnit && ccId) {
      const ccStillValid = costCenters.some(
        (cc) => cc.id === ccId && cc.unit_id === newUnit
      )
      if (!ccStillValid) {
        void setCcId('')
      }
    }
  }

  function handleCcChange(value: string | null) {
    void setCcId(!value || value === 'all' ? '' : value)
  }

  // Don't render if there's nothing to filter by (no units + no CCs)
  if (units.length === 0 && costCenters.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {units.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Unidade:</span>
          <Select
            value={unitId || 'all'}
            onValueChange={handleUnitChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {costCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Centro de Custo:</span>
          <Select
            value={ccId || 'all'}
            onValueChange={handleCcChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filteredCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
