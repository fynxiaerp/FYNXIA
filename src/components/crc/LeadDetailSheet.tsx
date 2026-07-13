'use client'

// LeadDetailSheet — right-side Sheet with lead detail + an accessible stage
// Select (UI-SPEC Acessibilidade: "LeadDetailSheet também expõe um Select de
// estágio como via alternativa 100% acessível — NUNCA depender apenas de
// drag-and-drop de mouse"). Any stage selection (including Convertido/Perdido)
// routes through the same onStageChangeRequest callback the kanban's drag-end
// handler uses, so the intercept-dialog behavior (D-04) is identical either way.

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEAD_STAGES, type LeadStage } from '@/lib/validators/crc'
import type { LeadCardRow } from '@/actions/leads'

const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  agendado: 'Agendado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

interface LeadDetailSheetProps {
  lead: LeadCardRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStageChangeRequest: (leadId: string, newStage: LeadStage) => void
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onStageChangeRequest,
}: LeadDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.full_name}</SheetTitle>
              <SheetDescription>Detalhes do lead e mudança de estágio</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{lead.source_name ?? 'Outro'}</Badge>
                <Badge
                  variant={
                    lead.stage === 'convertido'
                      ? 'default'
                      : lead.stage === 'perdido'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {STAGE_LABELS[lead.stage]}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm">{lead.phone ?? '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm">{lead.email ?? '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tempo no estágio</p>
                <p className="text-sm">{lead.diasNoEstagio} dia(s)</p>
              </div>

              <div className="space-y-1.5 border-t border-border pt-4">
                <Label htmlFor="lead-stage-select">Alterar Estágio</Label>
                <Select
                  value={lead.stage}
                  onValueChange={(value) => onStageChangeRequest(lead.id, value as LeadStage)}
                >
                  <SelectTrigger id="lead-stage-select" className="w-full">
                    <SelectValue>{STAGE_LABELS[lead.stage]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage} disabled={stage === lead.stage}>
                        {STAGE_LABELS[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Via 100% acessível — alternativa ao arrastar-e-soltar no funil.
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
