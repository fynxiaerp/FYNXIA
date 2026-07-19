'use client'

import { useState, useCallback, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg, DateSelectArg, EventClickArg } from '@fullcalendar/core'
import { useQueryState } from 'nuqs'
import { filterEventsByDentist, type CalendarEvent, type AppointmentInput } from '@/lib/validators/appointment'
import { updateAppointment, cancelAppointment, createAppointment } from '@/actions/appointments'
import { useNewAppointmentStore } from '@/lib/stores/new-appointment-store'
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

interface Patient {
  id: string
  full_name: string
}

interface AgendaCalendarProps {
  dentists: Dentist[]
  patients: Patient[]
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

// ─── Status Labels (pt-BR) — used by AppointmentDetailDialog's Select ─────────

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em Atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

// ─── Default Slot Computation ─────────────────────────────────────────────────
// Used when the "Nova Consulta" header button opens the dialog with no
// pre-selected calendar slot — rounds up to the next 15-min boundary, clamped
// into business hours [07:00, 19:45]. Duration default 30 min.

function computeNextSlot(): { start: string; end: string } {
  const now = new Date()
  const businessStartMin = 7 * 60 // 07:00
  const businessEndMin = 19 * 60 + 45 // 19:45 (last bookable start)

  const start = new Date(now)
  // Round UP to next 15-min boundary
  const minutes = start.getMinutes()
  const remainder = minutes % 15
  if (remainder !== 0 || start.getSeconds() > 0 || start.getMilliseconds() > 0) {
    start.setMinutes(minutes - remainder + 15, 0, 0)
  } else {
    start.setSeconds(0, 0)
  }

  const nowMinutesOfDay = start.getHours() * 60 + start.getMinutes()

  if (nowMinutesOfDay < businessStartMin) {
    // Before 07:00 → today 08:00
    start.setHours(8, 0, 0, 0)
  } else if (nowMinutesOfDay >= businessEndMin) {
    // At/after 19:45 → next day 08:00
    start.setDate(start.getDate() + 1)
    start.setHours(8, 0, 0, 0)
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000)

  return { start: start.toISOString(), end: end.toISOString() }
}

// ─── New Appointment Dialog ───────────────────────────────────────────────────
// Local-time (wall-clock) helpers for <input type="date"/time"> — these inputs
// need YYYY-MM-DD / HH:mm in the browser's local timezone, not UTC.

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

interface NewAppointmentDialogProps {
  open: boolean
  onClose: () => void
  startTime: string
  endTime: string
  initialDentistId: string | null
  dentists: Dentist[]
  patients: Patient[]
  onCreated: (event: CalendarEvent) => void
}

function NewAppointmentDialog({
  open,
  onClose,
  startTime,
  endTime,
  initialDentistId,
  dentists,
  patients,
  onCreated,
}: NewAppointmentDialogProps) {
  const [selectedDentistId, setSelectedDentistId] = useState<string | null>(initialDentistId)
  const [dateStr, setDateStr] = useState(() => toDateInputValue(startTime))
  const [startHm, setStartHm] = useState(() => toTimeInputValue(startTime))
  const [endHm, setEndHm] = useState(() => toTimeInputValue(endTime))
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate() {
    setError(null)
    if (!selectedDentistId) {
      setError('Selecione um dentista')
      return
    }
    setIsSubmitting(true)
    try {
      const start = new Date(`${dateStr}T${startHm}:00`).toISOString()
      const end = new Date(`${dateStr}T${endHm}:00`).toISOString()
      const result = await createAppointment({
        dentist_id: selectedDentistId,
        patient_id: selectedPatientId ?? undefined,
        start_time: start,
        end_time: end,
        status: 'agendado',
        notes: notes || undefined,
      })
      if (result.success && result.id) {
        onCreated({
          id: result.id,
          start,
          end,
          dentistId: selectedDentistId,
          status: 'agendado',
          title:
            (selectedPatientId
              ? patients.find((p) => p.id === selectedPatientId)?.full_name
              : null) || 'Novo Agendamento',
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
            <Select
              value={selectedDentistId ?? undefined}
              onValueChange={(v) => setSelectedDentistId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar dentista...">
                  {selectedDentistId
                    ? (dentists.find((d) => d.id === selectedDentistId)?.full_name ?? 'Selecionar dentista...')
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {dentists.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="appt-date" className="font-semibold">
              Data
            </Label>
            <Input
              id="appt-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="appt-start" className="font-semibold">
                Início
              </Label>
              <Input
                id="appt-start"
                type="time"
                value={startHm}
                onChange={(e) => setStartHm(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="appt-end" className="font-semibold">
                Fim
              </Label>
              <Input
                id="appt-end"
                type="time"
                value={endHm}
                onChange={(e) => setEndHm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Paciente</Label>
            <Select
              value={selectedPatientId ?? '__none__'}
              onValueChange={(v) => setSelectedPatientId(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar paciente...">
                  {selectedPatientId
                    ? (patients.find((p) => p.id === selectedPatientId)?.full_name ?? 'Selecionar paciente...')
                    : 'Sem paciente vinculado'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem paciente vinculado</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// ─── Appointment Detail Dialog ────────────────────────────────────────────────
// Opens on eventClick (existing appointment). Status-only edit — reuses
// updateAppointment exactly as-is (no new server action, no availability logic
// duplicated here; that already lives inside updateAppointment).

interface AppointmentDetailDialogProps {
  open: boolean
  onClose: () => void
  appointmentId: string
  patientTitle: string
  dentistId: string
  startTime: string
  endTime: string
  currentStatus: string
  dentists: Dentist[]
  onStatusUpdated: (id: string, newStatus: string) => void
}

function AppointmentDetailDialog({
  open,
  onClose,
  appointmentId,
  patientTitle,
  dentistId,
  startTime,
  endTime,
  currentStatus,
  dentists,
  onStatusUpdated,
}: AppointmentDetailDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dentistName = dentists.find((d) => d.id === dentistId)?.full_name ?? 'Não informado'

  const dateTimeLabel = startTime
    ? `${new Date(startTime).toLocaleDateString('pt-BR')} ${new Date(startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${
        endTime ? ` - ${new Date(endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''
      }`
    : 'Não informado'

  async function handleSave() {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await updateAppointment(appointmentId, { status: selectedStatus as AppointmentInput['status'] })
      if (result.success) {
        onStatusUpdated(appointmentId, selectedStatus)
        onClose()
      } else {
        setError(result.error ?? 'Erro ao atualizar status')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes da Consulta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label className="font-semibold">Paciente</Label>
            <p className="text-sm">{patientTitle}</p>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Dentista</Label>
            <p className="text-sm">{dentistName}</p>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Data/Hora</Label>
            <p className="text-sm">{dateTimeLabel}</p>
          </div>

          <div className="space-y-1">
            <Label className="font-semibold">Status</Label>
            <Select value={selectedStatus} onValueChange={(v) => v && setSelectedStatus(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar status...">
                  {STATUS_LABELS[selectedStatus] ?? selectedStatus}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── AgendaCalendar ───────────────────────────────────────────────────────────

export function AgendaCalendar({ dentists, patients, events: initialEvents, tenantId }: AgendaCalendarProps) {
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

  // Appointment detail dialog state (eventClick — existing appointment)
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean
    appointmentId: string
    patientTitle: string
    dentistId: string
    startTime: string
    endTime: string
    currentStatus: string
  } | null>(null)

  // Trigger store — connects the (Server Component) "Nova Consulta" header
  // button to this client component's dialog state.
  const headerOpen = useNewAppointmentStore((s) => s.open)
  const resetHeaderTrigger = useNewAppointmentStore((s) => s.reset)

  useEffect(() => {
    if (!headerOpen) return
    const { start, end } = computeNextSlot()
    setNewApptDialog({ open: true, startTime: start, endTime: end })
    resetHeaderTrigger()
  }, [headerOpen, resetHeaderTrigger])

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
  // (dentist is chosen inside the dialog — no pre-selected dentist required)
  const handleSelect = useCallback((selectInfo: DateSelectArg) => {
    setNewApptDialog({
      open: true,
      startTime: selectInfo.startStr,
      endTime: selectInfo.endStr,
    })
  }, [])

  function handleEventCreated(event: CalendarEvent) {
    setCalendarEvents((prev) => [...prev, event])
  }

  // eventClick: open the detail dialog for an existing appointment (status-only edit)
  const handleEventClick = useCallback((info: EventClickArg) => {
    setDetailDialog({
      open: true,
      appointmentId: info.event.id,
      patientTitle: info.event.title,
      dentistId: String(info.event.extendedProps.dentistId ?? ''),
      startTime: info.event.start?.toISOString() ?? '',
      endTime: info.event.end?.toISOString() ?? '',
      currentStatus: String(info.event.extendedProps.status ?? 'agendado'),
    })
  }, [])

  // Reflects the new status locally so eventClassNames recolors the event
  // without a page reload (mirrors handleEventDrop's local-state pattern).
  function handleStatusUpdated(id: string, newStatus: string) {
    setCalendarEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    )
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
            <SelectValue placeholder="Selecionar dentista...">
              {dentistId && dentistId !== '__all__' ? (dentists.find(d => d.id === dentistId)?.full_name ?? 'Selecionar dentista...') : null}
            </SelectValue>
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
        {calendarEvents.length === 0 && (
          <p className="mb-2 text-sm text-muted-foreground">
            Nenhuma consulta esta semana — clique em um horário ou em &quot;Nova Consulta&quot; para agendar.
          </p>
        )}
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
          eventClick={handleEventClick}
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
      {newApptDialog.open && (
        <NewAppointmentDialog
          open={newApptDialog.open}
          onClose={() => setNewApptDialog({ open: false, startTime: '', endTime: '' })}
          startTime={newApptDialog.startTime}
          endTime={newApptDialog.endTime}
          initialDentistId={dentistId}
          dentists={dentists}
          patients={patients}
          onCreated={handleEventCreated}
        />
      )}

      {/* Appointment Detail Dialog */}
      {detailDialog?.open && (
        <AppointmentDetailDialog
          open={detailDialog.open}
          onClose={() => setDetailDialog(null)}
          appointmentId={detailDialog.appointmentId}
          patientTitle={detailDialog.patientTitle}
          dentistId={detailDialog.dentistId}
          startTime={detailDialog.startTime}
          endTime={detailDialog.endTime}
          currentStatus={detailDialog.currentStatus}
          dentists={dentists}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  )
}
