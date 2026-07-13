'use client'

// KanbanColumn — single funil column (header + useDroppable drop zone).
// UI-SPEC §2: header bg-secondary/50, Convertido gets a subtle accent top-border
// (success indicator, not a full accent fill — accent is reserved), Perdido gets
// a subtle destructive top-border. Body is the dnd-kit drop target.

import { useDroppable } from '@dnd-kit/react'
import { Badge } from '@/components/ui/badge'
import { LeadCard } from '@/components/crc/LeadCard'
import { cn } from '@/lib/utils'
import type { LeadCardRow } from '@/actions/leads'
import type { LeadStage } from '@/lib/validators/crc'

const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  agendado: 'Agendado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

interface KanbanColumnProps {
  stage: LeadStage
  leads: LeadCardRow[]
  onCardClick: (lead: LeadCardRow) => void
}

export function KanbanColumn({ stage, leads, onCardClick }: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({ id: stage })

  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col">
      <header
        className={cn(
          'flex items-center justify-between rounded-t-lg bg-secondary/50 px-4 py-3',
          stage === 'convertido' && 'border-t-2 border-primary',
          stage === 'perdido' && 'border-t-2 border-destructive'
        )}
      >
        <span className="font-display text-sm font-semibold">{STAGE_LABELS[stage]}</span>
        <Badge variant="secondary">{leads.length}</Badge>
      </header>
      <div
        ref={ref}
        className={cn(
          'min-h-[400px] flex-1 space-y-2 rounded-b-lg bg-muted/30 p-3 transition-colors',
          isDropTarget && 'ring-2 ring-inset ring-primary/50'
        )}
      >
        {leads.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhum lead neste estágio.
          </p>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))
        )}
      </div>
    </div>
  )
}
