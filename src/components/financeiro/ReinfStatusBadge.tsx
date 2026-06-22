'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── ReinfStatusBadge ─────────────────────────────────────────────────────────
// TRIB-03: EFD-Reinf stub status badge (D-18/D-22).
// When isStub=true, appends "STUB" badge with tooltip warning.

type ReinfStatus = 'pendente' | 'transmitido' | 'erro'

interface ReinfStatusBadgeProps {
  status: ReinfStatus
  isStub?: boolean
}

function statusClass(status: ReinfStatus): string {
  switch (status) {
    case 'transmitido':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'erro':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'pendente':
    default:
      return 'bg-amber-100 text-amber-800 border-amber-200'
  }
}

function statusLabel(status: ReinfStatus): string {
  const map: Record<ReinfStatus, string> = {
    pendente: 'Pendente',
    transmitido: 'Transmitido',
    erro: 'Erro',
  }
  return map[status]
}

export function ReinfStatusBadge({ status, isStub = false }: ReinfStatusBadgeProps) {
  return (
    <div className="flex items-center gap-1">
      <Badge className={`border text-xs ${statusClass(status)}`}>
        {statusLabel(status)}
      </Badge>
      {isStub && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Badge variant="outline" className="text-xs">
                STUB
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                EFD-Reinf em modo simulação. Conecte o provedor real no Hub de Integrações.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
