'use client'

// LeadKanbanBoard — the Funil de Leads kanban (CRC-01, D-01/D-02). 5-column
// dnd-kit board (DragDropProvider default preset registers BOTH PointerSensor
// AND KeyboardSensor — see node_modules/@dnd-kit/dom's defaultPreset; never
// pass a custom `sensors` prop here, it would drop keyboard accessibility).
//
// Also exports `FunilHeaderActions` — the funil page's PageHeader actions
// (Novo Lead / Ver Conversão por Origem toggle / Gerenciar Origens). This
// plan's fixed file list has no dedicated header-actions file, so it lives
// here as a second export sharing the same 'use client' boundary and the
// nuqs `view` query key with the board below (both independently call
// useQueryState('view', ...) — nuqs keeps them in sync via the URL).
//
// Drag-end / accessible-Select-fallback (LeadDetailSheet) share one code path:
// requestStageChange(leadId, newStage). Non-terminal transitions persist
// immediately (optimistic + moveLeadStage, rollback on error). Convertido/
// Perdido transitions move the card optimistically THEN open
// LeadStageChangeDialog — persistence awaits confirm; Cancel reverts (D-04,
// T-18-24: server re-validates isValidStageTransition regardless of client
// pre-check, so this optimistic path never bypasses in the a hostile-client
// scenario).

import { useState } from 'react'
import { useQueryState } from 'nuqs'
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react'
import { Plus, Users } from 'lucide-react'

import { moveLeadStage } from '@/actions/leads'
import type { LeadCardRow, ConversionByOriginRow } from '@/actions/leads'
import type { LeadSourceRow } from '@/actions/lead-sources'
import { LEAD_STAGES, isValidStageTransition, type LeadStage } from '@/lib/validators/crc'

import { KanbanColumn } from '@/components/crc/KanbanColumn'
import { LeadDetailSheet } from '@/components/crc/LeadDetailSheet'
import {
  LeadStageChangeDialog,
  type PendingStageChange,
} from '@/components/crc/LeadStageChangeDialog'
import { LeadFormDialog } from '@/components/crc/LeadFormDialog'
import { LeadSourceManager } from '@/components/crc/LeadSourceManager'
import { ConversionByOriginTable } from '@/components/crc/ConversionByOriginTable'
import { EmptyState } from '@/components/shell/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface PatientOption {
  id: string
  full_name: string
  cpf: string
}

type LeadsByStage = Record<LeadStage, LeadCardRow[]>

function findStage(leadsByStage: LeadsByStage, leadId: string): LeadStage | null {
  for (const stage of LEAD_STAGES) {
    if (leadsByStage[stage].some((l) => l.id === leadId)) return stage
  }
  return null
}

function moveLeadLocally(
  prev: LeadsByStage,
  leadId: string,
  fromStage: LeadStage,
  toStage: LeadStage
): LeadsByStage {
  const lead = prev[fromStage].find((l) => l.id === leadId)
  if (!lead) return prev
  return {
    ...prev,
    [fromStage]: prev[fromStage].filter((l) => l.id !== leadId),
    [toStage]: [{ ...lead, stage: toStage, diasNoEstagio: 0 }, ...prev[toStage]],
  }
}

interface LeadKanbanBoardProps {
  leadsByStage: LeadsByStage
  conversionData: ConversionByOriginRow[]
  patients: PatientOption[]
}

export function LeadKanbanBoard({
  leadsByStage: initialLeadsByStage,
  conversionData,
  patients,
}: LeadKanbanBoardProps) {
  const [view] = useQueryState('view', { defaultValue: 'kanban' })
  const [leadsByStage, setLeadsByStage] = useState<LeadsByStage>(initialLeadsByStage)
  const [detailLead, setDetailLead] = useState<LeadCardRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [pending, setPending] = useState<PendingStageChange | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)

  const totalLeads = LEAD_STAGES.reduce((sum, s) => sum + leadsByStage[s].length, 0)

  function requestStageChange(leadId: string, toStage: LeadStage) {
    setDragError(null)
    const fromStage = findStage(leadsByStage, leadId)
    if (!fromStage || fromStage === toStage) return

    if (!isValidStageTransition(fromStage, toStage)) {
      setDragError('Transição de estágio inválida.')
      return
    }

    const lead = leadsByStage[fromStage].find((l) => l.id === leadId)
    if (!lead) return

    if (toStage === 'convertido' || toStage === 'perdido') {
      setLeadsByStage((prev) => moveLeadLocally(prev, leadId, fromStage, toStage))
      setDetailOpen(false)
      setPending({ leadId, leadName: lead.full_name, fromStage, toStage })
      return
    }

    setLeadsByStage((prev) => moveLeadLocally(prev, leadId, fromStage, toStage))
    setDetailOpen(false)
    moveLeadStage(leadId, toStage).then((result) => {
      if (!result.success) {
        setLeadsByStage((prev) => moveLeadLocally(prev, leadId, toStage, fromStage))
        setDragError(result.error ?? 'Erro ao mover lead.')
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { source, target } = event.operation
    if (!source || !target) return
    requestStageChange(String(source.id), String(target.id) as LeadStage)
  }

  function handlePendingCancel() {
    if (pending) {
      setLeadsByStage((prev) =>
        moveLeadLocally(prev, pending.leadId, pending.toStage, pending.fromStage)
      )
    }
    setPending(null)
  }

  function handlePendingConfirmed() {
    setPending(null)
  }

  function openDetail(lead: LeadCardRow) {
    setDetailLead(lead)
    setDetailOpen(true)
  }

  if (view === 'conversao') {
    return <ConversionByOriginTable data={conversionData} />
  }

  return (
    <>
      {dragError && (
        <Alert variant="destructive">
          <AlertDescription>{dragError}</AlertDescription>
        </Alert>
      )}

      {totalLeads === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead no funil"
          description="Cadastre o primeiro lead para começar a acompanhar o funil de conversão."
        />
      ) : (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {LEAD_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                leads={leadsByStage[stage]}
                onCardClick={openDetail}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

      <LeadDetailSheet
        lead={detailLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStageChangeRequest={requestStageChange}
      />

      <LeadStageChangeDialog
        pending={pending}
        patients={patients}
        onCancel={handlePendingCancel}
        onConfirmed={handlePendingConfirmed}
      />
    </>
  )
}

// ─── FunilHeaderActions ─────────────────────────────────────────────────────
// PageHeader actions slot for /clinica/crc/funil (UI-SPEC §2 "Header actions").

interface FunilHeaderActionsProps {
  sources: LeadSourceRow[]
  patients: PatientOption[]
  canWrite: boolean
  canManageSources: boolean
}

export function FunilHeaderActions({
  sources,
  patients,
  canWrite,
  canManageSources,
}: FunilHeaderActionsProps) {
  const [view, setView] = useQueryState('view', { defaultValue: 'kanban' })
  const activeSources = sources.filter((s) => s.ativo)

  return (
    <div className="flex items-center gap-2">
      {canWrite && (
        <LeadFormDialog sources={activeSources} patients={patients}>
          <Button size="sm">
            <Plus className="size-4" />
            Novo Lead
          </Button>
        </LeadFormDialog>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setView(view === 'conversao' ? null : 'conversao')}
      >
        {view === 'conversao' ? 'Ver Funil' : 'Ver Conversão por Origem'}
      </Button>
      <LeadSourceManager sources={sources} canManage={canManageSources}>
        <Button variant="outline" size="sm">
          Gerenciar Origens
        </Button>
      </LeadSourceManager>
    </div>
  )
}
