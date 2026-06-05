'use client'
import { useState, useTransition } from 'react'
import { createPublicAppointment, getBookedSlots, type PublicBookingInput } from '@/actions/public-booking'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, RefreshCw, Clock } from 'lucide-react'

// ─── PublicBookingForm ────────────────────────────────────────────────────────
// CLINIC-09: public self-booking form for /agendar/[clinic-slug].
// No auth required. Resolves clinic via slug in the Server Action.
//
// UI-SPEC Public Booking Page Layout:
// Step 1 → Dentista selection
// Step 2 → Data selection (date picker)
// Step 3 → Slot selection (available slots grid) — booked slots disabled
// Step 4 → Contact info (name/phone/email) + CTA "Confirmar Agendamento"
//
// Error state: 23P01 → "Horário indisponível" Alert + [Recarregar horários] button
// Empty state: "Sem horários disponíveis" when no slots
// Touch targets: min-h 44px for all interactive elements (WCAG 2.5.5)
//
// CLINIC-09 fix: datetimes sent with -03:00 offset (Brazil/São Paulo, no DST
// since 2019) so they satisfy publicBookingSchema z.string().datetime({offset:true}).
// Booked slots are fetched via getBookedSlots on date select and marked disabled.

interface Dentist {
  id: string
  full_name: string
}

interface TimeSlot {
  start_time: string  // ISO datetime with -03:00 offset
  end_time: string    // ISO datetime with -03:00 offset
  label: string       // e.g. "09:00 – 09:30"
}

interface PublicBookingFormProps {
  clinicSlug: string
  dentists: Dentist[]
}

// Generate 30-minute slots from 08:00 to 18:00 for a given date.
// CLINIC-09 fix: produces start_time/end_time with -03:00 offset so they pass
// publicBookingSchema z.string().datetime({offset:true}).
function generateSlots(dateStr: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [year, month, day] = dateStr.split('-').map(Number)
  const yy = String(year!).padStart(4, '0')
  const mm = String(month!).padStart(2, '0')
  const dd = String(day!).padStart(2, '0')
  let hour = 8
  let minute = 0
  while (hour < 18) {
    const startH = String(hour).padStart(2, '0')
    const startM = String(minute).padStart(2, '0')
    let endH = hour
    let endM = minute + 30
    if (endM >= 60) {
      endM = 0
      endH += 1
    }
    const endHStr = String(endH).padStart(2, '0')
    const endMStr = String(endM).padStart(2, '0')
    // -03:00 offset: Brazil/São Paulo fixed offset (no DST since 2019)
    const start = `${yy}-${mm}-${dd}T${startH}:${startM}:00-03:00`
    const end   = `${yy}-${mm}-${dd}T${endHStr}:${endMStr}:00-03:00`
    slots.push({ start_time: start, end_time: end, label: `${startH}:${startM} – ${endHStr}:${endMStr}` })
    minute += 30
    if (minute >= 60) {
      minute = 0
      hour += 1
    }
  }
  return slots
}

// Compare two ISO datetime strings by instant (handles mixed UTC/offset formats)
function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime()
}

// Format a date for display
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const m = parseInt(month ?? '1', 10) - 1
  return `${day} de ${months[m] ?? ''} de ${year}`
}

// Get today's date string in YYYY-MM-DD
function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PublicBookingForm({ clinicSlug, dentists }: PublicBookingFormProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedDentist, setSelectedDentist] = useState<Dentist | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slotConflict, setSlotConflict] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  // CLINIC-09: booked slots state — set of occupied start_time instants (ms)
  const [bookedInstants, setBookedInstants] = useState<Set<number>>(new Set())
  const [isFetchingSlots, setIsFetchingSlots] = useState(false)

  const slots = selectedDate ? generateSlots(selectedDate) : []

  function isSlotBooked(slot: TimeSlot): boolean {
    const slotMs = new Date(slot.start_time).getTime()
    return bookedInstants.has(slotMs)
  }

  function handleDentistSelect(d: Dentist) {
    setSelectedDentist(d)
    setStep(2)
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setSlotConflict(false)
    setStep(3)

    // CLINIC-09: fetch booked slots for this dentist/date so we can disable them
    if (selectedDentist && date) {
      setIsFetchingSlots(true)
      setBookedInstants(new Set())
      startTransition(async () => {
        const occupied = await getBookedSlots(clinicSlug, selectedDentist.id, date)
        // Normalise to ms instants for offset-agnostic comparison
        const instants = new Set(occupied.map((t) => new Date(t).getTime()))
        setBookedInstants(instants)
        setIsFetchingSlots(false)
      })
    }
  }

  function handleSlotSelect(slot: TimeSlot) {
    if (isSlotBooked(slot)) return // guard: disabled slots must not be selectable
    setSelectedSlot(slot)
    setSlotConflict(false)
    setStep(4)
  }

  function handleReloadSlots() {
    setSelectedSlot(null)
    setSlotConflict(false)
    // Re-fetch availability when reloading after 23P01
    if (selectedDentist && selectedDate) {
      setIsFetchingSlots(true)
      setBookedInstants(new Set())
      startTransition(async () => {
        const occupied = await getBookedSlots(clinicSlug, selectedDentist.id, selectedDate)
        const instants = new Set(occupied.map((t) => new Date(t).getTime()))
        setBookedInstants(instants)
        setIsFetchingSlots(false)
      })
    }
    setStep(3)
  }

  function handleSubmit() {
    if (!selectedDentist || !selectedSlot || !name.trim() || !phone.trim()) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }

    // Guard: slot may have been booked between selection and submit
    if (isSlotBooked(selectedSlot)) {
      setSlotConflict(true)
      setStep(3)
      return
    }

    const input: PublicBookingInput = {
      dentist_id: selectedDentist.id,
      // start_time and end_time now carry -03:00 offset — satisfies datetime({offset:true})
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      requester_name: name.trim(),
      requester_phone: phone.trim(),
      requester_email: email.trim() || undefined,
    }

    startTransition(async () => {
      const result = await createPublicAppointment(clinicSlug, input)
      if (result.success) {
        setSuccess(true)
        setError(null)
      } else {
        // 23P01: slot taken — show conflict alert with reload button
        if (result.error?.includes('acabou de ser reservado')) {
          setSlotConflict(true)
          setStep(3)
        }
        setError(result.error ?? 'Ocorreu um erro. Tente novamente.')
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <CheckCircle2 className="size-16 text-green-500" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Consulta agendada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu agendamento foi registrado com sucesso. Aguarde a confirmação da clínica.
          </p>
        </div>
        {selectedDentist && selectedSlot && (
          <div className="w-full rounded-md border border-input bg-card p-4 text-left text-sm">
            <p><span className="font-medium">Dentista:</span> {selectedDentist.full_name}</p>
            <p><span className="font-medium">Data:</span> {formatDateDisplay(selectedDate)}</p>
            <p><span className="font-medium">Horário:</span> {selectedSlot.label}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {(['Dentista', 'Data', 'Horário', 'Dados'] as const).map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-xs font-medium ${
                step > i + 1
                  ? 'bg-green-500 text-white'
                  : step === i + 1
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-border text-muted-foreground'
              }`}
            >
              {step > i + 1 ? '✓' : i + 1}
            </span>
            <span className={step === i + 1 ? 'text-foreground font-medium' : ''}>{label}</span>
            {i < 3 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select dentist */}
      {step >= 1 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Selecione o dentista</h2>
          {dentists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dentista disponível.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dentists.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleDentistSelect(d)}
                  className={`min-h-[44px] w-full rounded-md border px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedDentist?.id === d.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input bg-card hover:bg-accent/50'
                  }`}
                >
                  {d.full_name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 2: Select date */}
      {step >= 2 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Selecione a data</h2>
          <input
            type="date"
            min={todayString()}
            value={selectedDate}
            onChange={(e) => handleDateSelect(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {selectedDate && (
            <p className="mt-1 text-xs text-muted-foreground">{formatDateDisplay(selectedDate)}</p>
          )}
        </section>
      )}

      {/* Step 3: Select slot */}
      {step >= 3 && selectedDate && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Selecione o horário</h2>
            {slotConflict && (
              <button
                type="button"
                onClick={handleReloadSlots}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <RefreshCw className="size-3" />
                Recarregar horários
              </button>
            )}
          </div>

          {slotConflict && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="size-4" />
              <AlertTitle>Horário indisponível</AlertTitle>
              <AlertDescription>
                Este horário acabou de ser reservado. Por favor, escolha outro horário.
              </AlertDescription>
            </Alert>
          )}

          {isFetchingSlots ? (
            <p className="text-sm text-muted-foreground">Verificando disponibilidade...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem horários disponíveis.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const booked = isSlotBooked(slot)
                return (
                  <button
                    key={slot.start_time}
                    type="button"
                    onClick={() => handleSlotSelect(slot)}
                    disabled={booked}
                    aria-label={booked ? `${slot.label} — indisponível` : slot.label}
                    className={`min-h-[44px] flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      booked
                        ? 'cursor-not-allowed border-input bg-muted text-muted-foreground opacity-50'
                        : selectedSlot?.start_time === slot.start_time
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input bg-card hover:bg-accent/50'
                    }`}
                  >
                    <Clock className="size-3 shrink-0" />
                    {slot.label}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Step 4: Contact info + CTA */}
      {step >= 4 && selectedSlot && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Seus dados de contato</h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-name" className="text-xs font-medium text-foreground">
              Nome completo <span className="text-destructive">*</span>
            </label>
            <input
              id="booking-name"
              type="text"
              required
              placeholder="João da Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-phone" className="text-xs font-medium text-foreground">
              Telefone / WhatsApp <span className="text-destructive">*</span>
            </label>
            <input
              id="booking-phone"
              type="tel"
              required
              placeholder="(11) 9 9999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-email" className="text-xs font-medium text-foreground">
              E-mail (opcional)
            </label>
            <input
              id="booking-email"
              type="email"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && !slotConflict && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !phone.trim()}
            className="w-full min-h-[44px] rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Confirmando...' : 'Confirmar Agendamento'}
          </button>
        </section>
      )}
    </div>
  )
}
