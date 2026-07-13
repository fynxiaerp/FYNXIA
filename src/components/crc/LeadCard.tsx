'use client'

// LeadCard — draggable lead card for the Funil kanban (CRC-01, D-02).
// useDraggable (@dnd-kit/react) makes the card draggable by mouse AND keyboard
// (KeyboardSensor is auto-registered by DragDropProvider's default preset —
// see LeadKanbanBoard.tsx). tabIndex + role="button" make it Tab-focusable so
// Space/Enter can activate the keyboard drag sequence (UI-SPEC Acessibilidade).
// Click (no pointer movement) opens LeadDetailSheet via onClick — PointerSensor's
// distance-activation-constraint means a plain click never triggers a drag.

import { useDraggable } from '@dnd-kit/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LeadCardRow } from '@/actions/leads'

interface LeadCardProps {
  lead: LeadCardRow
  onClick: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { ref, isDragging } = useDraggable({ id: lead.id })

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Lead ${lead.full_name} — ${lead.diasNoEstagio} dia(s) no estágio. Pressione Espaço para mover de estágio via teclado, ou Enter para ver detalhes.`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      className={cn(
        'min-h-[88px] cursor-grab select-none rounded-xl border border-transparent bg-card p-3 text-sm ring-1 ring-foreground/10 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold">{lead.full_name}</p>
        <Badge variant="outline" className="shrink-0 text-xs">
          {lead.source_name ?? 'Outro'}
        </Badge>
      </div>
      {lead.phone && <p className="mt-1 text-xs text-muted-foreground">{lead.phone}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{lead.diasNoEstagio} dia(s) no estágio</p>
    </div>
  )
}
