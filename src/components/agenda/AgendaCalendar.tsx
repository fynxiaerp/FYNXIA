'use client'

import { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg, DateSelectArg } from '@fullcalendar/core'
import { useQueryState } from 'nuqs'
import { filterEventsByDentist, type CalendarEvent } from '@/lib/validators/appointment'
import { updateAppointment, cancelAppointment, createAppointment } from '@/actions/appointments'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dentist {
  id: string
  full_name: string
}

interface AgendaCalendarProps {
  dentists: Dentist[]
  events: CalendarEvent[]
  tenantId: string
}

// ─── Calendar Event Status Colors (UI-SPEC) ───────────────────────────────────
// Applied via eventClassNames — Tailwind utility classes on event blocks.

const STATUS_CLASS_MAP: Record<string, string> = {
  agendado: 'bg-blue-100 text-blue-800 border-l-2 border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700',
  confirmado: 'bg-green-100 text-green-800 border-l-2 border-green-500 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700',
  em_atendimento: 'bg-amber-100 text-amber-800 border-l-2 border-amber-500 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
  concluido: 'bg-muted text-muted-foreground border-l-2 border-border',
  cancelado: 'bg-red-50 text-red-500 line-through border-l-2 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
}

// ─── New Appointment Dialog ───────────────────────────────────────────────────

interface NewAppointmentDialogProps {
  open: boolean
  onClose: () => void
  startTime: string
  endTime: string
  dentistId: string
  dentists: Dentist[]
  onCreated: (event: CalendarEvent) => void
}

function NewAppointmentDialog({
  open,
  onClose,
  startTime,
  endTime,
  dentistId,
  dentists,
  onCreated,
}: NewAppointmentDialogProps) {
  const [patientName, setPatientName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate() {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await createAppointment({
        dentist_id: dentistId,
        start_time: startTime,
        end_time: endTime,
        status: 'agendado',
        notes: notes || undefined,
      })
      if (result.success && result.id) {
        onCreated({
          id: result.id,
          start: startTime,
          end: endTime,
          dentistId,
          status: 'agendado',
          title: patientName || 'Novo Agendamento',
        })
        onClose()
      } else {
        setError(result.error ?? 'Erro ao criar agendamento')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label className="font-semibold">Dentista</Label>
            <p className="text-sm text-muted-foreground">
              {dentists.find((d) => d.id === dentistId)?.full_name ?? dentistId}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="font-semibold">Início</Label>
              <p className="text-sm font-mono text-muted-foreground">
                {new Date(startTime).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="font-semibold">Fim</Label>
              <p className="text-sm font-mono text-muted-foreground">
                {new Date(endTime).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="patient-name" className="font-semibold">
              Nome do Paciente (opcional)
            </Label>
            <Input
              id="patient-name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Buscar paciente..."
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="font-semibold">
              Observações
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar Agendamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── AgendaCalendar ───────────────────────────────────────────────────────────

export function AgendaCalendar({ dentists, events: initialEvents, tenantId }: AgendaCalendarProps) {
  // D-01: dentista selecionado via nuqs URL state (compartilhável, browser history funcional)
  // T-2-03: queryKey incluiria tenantId se data fosse buscada client-side — aqui vem via props do Server Component
  const [dentistId, setDentistId] = useQueryState('dentist')

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialEvents)
  const [conflictError, setConflictError] = useState<string | null>(null)

  // New appointment dialog state
  const [newApptDialog, setNewApptDialog] = useState<{
    open: boolean
    startTime: string
    endTime: string
  }>({ open: false, startTime: '', endTime: '' })

  // Filter events by selected dentist (Pitfall 3 — only show selected dentist's events)
  const filteredEvents = dentistId
    ? filterEventsByDentist(calendarEvents, dentistId)
    : calendarEvents

  // Map CalendarEvent to FullCalendar EventInput
  const fcEvents = filteredEvents.map((e) => ({
    id: e.id,
    start: e.start,
    end: e.end,
    title: e.title,
    extendedProps: { status: e.status, dentistId: e.dentistId },
    // Accessibility: aria-label on event element (Accessibility Contract)
    'aria-label': `Consulta ${e.status} — ${e.title} — ${new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}-${new Date(e.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
  }))

  // eventDrop: drag-to-reschedule (D-01)
  // On 23P01 conflict: revert the event and show Alert (UI-SPEC)
  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      setConflictError(null)
      const result = await updateAppointment(info.event.id, {
        start_time: info.event.start?.toISOString() ?? '',
        end_time: info.event.end?.toISOString() ?? '',
      })
      if (!result.success) {
        info.revert() // Revert the drag (FullCalendar built-in)
        setConflictError(result.error ?? 'Erro ao mover agendamento')
      } else {
        // Update local state to reflect new times
        setCalendarEvents((prev) =>
          prev.map((e) =>
            e.id === info.event.id
              ? {
                  ...e,
                  start: info.event.start?.toISOString() ?? e.start,
                  end: info.event.end?.toISOString() ?? e.end,
                }
              : e
          )
        )
      }
    },
    []
  )

  // select: click on empty slot opens new appointment dialog
  const handleSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      if (!dentistId) {
        setConflictError('Selecione um dentista antes de criar um agendamento.')
        return
      }
      setNewApptDialog({
        open: true,
        startTime: selectInfo.startStr,
        endTime: selectInfo.endStr,
      })
    },
    [dentistId]
  )

  function handleEventCreated(event: CalendarEvent) {
    setCalendarEvents((prev) => [...prev, event])
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header row: dentist dropdown + conflict alert */}
      <div className="flex h-14 items-center gap-4 border-b px-4">
        <Select
          value={dentistId ?? '__all__'}
          onValueChange={(v) => setDentistId(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecionar dentista..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os dentistas</SelectItem>
            {dentists.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {conflictError && (
          <Alert variant="destructive" className="flex-1 py-2" role="alert">
            <AlertDescription className="text-sm">{conflictError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* FullCalendar — Configuration Contract (UI-SPEC) */}
      <div className="flex-1 overflow-hidden p-4">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="pt-br"
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          nowIndicator={true}
          height="calc(100vh - 112px)"
          editable={true}
          selectable={true}
          events={fcEvents}
          eventDrop={handleEventDrop}
          select={handleSelect}
          eventClassNames={(arg) => {
            const status = (arg.event.extendedProps.status as string) ?? 'agendado'
            const cls = STATUS_CLASS_MAP[status] ?? STATUS_CLASS_MAP['agendado'] ?? ''
            return [cls]
          }}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: 'Hoje',
            week: 'Semana',
            day: 'Dia',
          }}
        />
      </div>

      {/* New Appointment Dialog */}
      {newApptDialog.open && dentistId && (
        <NewAppointmentDialog
          open={newApptDialog.open}
          onClose={() => setNewApptDialog({ open: false, startTime: '', endTime: '' })}
          startTime={newApptDialog.startTime}
          endTime={newApptDialog.endTime}
          dentistId={dentistId}
          dentists={dentists}
          onCreated={handleEventCreated}
        />
      )}
    </div>
  )
}
