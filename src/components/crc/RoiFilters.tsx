'use client'

// RoiFilters — campanha Select ("Todas") + date range (De/Até) for the ROI
// panel (CRC-02). URL state via nuqs useQueryState — mirrors
// CashFlowFilters.tsx. Not in the plan's files_modified list — added per
// task 2's explicit "nuqs filters (campanha Select, date range from/to)"
// instruction (Rule 2: missing-piece completion, the UI-SPEC's filter
// contract for this screen).

import { useQueryState } from 'nuqs'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface CampaignOption {
  id: string
  name: string
}

interface RoiFiltersProps {
  campaigns: CampaignOption[]
}

export function RoiFilters({ campaigns }: RoiFiltersProps) {
  const [campanha, setCampanha] = useQueryState('campanha', { defaultValue: '' })
  const [from, setFrom] = useQueryState('from', { defaultValue: '' })
  const [to, setTo] = useQueryState('to', { defaultValue: '' })

  function handleCampanhaChange(value: string | null) {
    void setCampanha(!value || value === 'all' ? '' : value)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Campanha:</span>
        <Select value={campanha || 'all'} onValueChange={handleCampanhaChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
