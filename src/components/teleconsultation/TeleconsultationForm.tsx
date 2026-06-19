'use client'
/**
 * TeleconsultationForm — create teleconsultation session + start/end controls
 *
 * TEL-01 (Phase 12):
 * - RHF v7 + zodResolver(teleconsultationSchema); defaultValues (NO .default() on schema)
 * - Fields: patient selector, optional appointment link, optional professional, external_link (URL),
 *   consent_given checkbox (CFO Resolução 226/2020)
 * - On success: renders session controls (Iniciar / Encerrar)
 * - Start is disabled/shows error when consent_given is false
 *
 * Security:
 *   - consent_ip and consent_given_at are set SERVER-SIDE in createTeleconsultation (T-12-30)
 *   - No IP collected client-side
 *
 * Design: @base-ui Button render-prop (NEVER asChild), design tokens, pt-BR, Alert for errors.
 *
 * Phase: 12-receitu-rio-teleodontologia (TEL-01)
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink } from 'lucide-react'
import { teleconsultationSchema, type TeleconsultationInput } from '@/lib/validators/teleconsultation'
import {
  createTeleconsultation,
  startTeleconsultation,
  endTeleconsultation,
} from '@/actions/teleconsultations'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  full_name: string
}

interface Appointment {
  id: string
  start_time: string
  patient_id: string
}

interface Professional {
  id: string
  full_name: string
}

interface SessionState {
  id: string
  consent_given: boolean
  status: string
  started_at: string | null
  ended_at: string | null
  external_link: string
}

interface TeleconsultationFormProps {
  patients: Patient[]
  appointments?: Appointment[]
  professionals?: Professional[]
  isReadOnly?: boolean
  /** When provided, form renders in session-control mode (existing session). */
  existingSession?: SessionState
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

// ─── Session Controls (rendered after creation or for existing sessions) ───────

interface SessionControlsProps {
  session: SessionState
  isReadOnly?: boolean
  onStatusChange: (updatedStatus: string, startedAt?: string | null, endedAt?: string | null) => void
}

function SessionControls({ session, isReadOnly, onStatusChange }: SessionControlsProps) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  async function handleStart() {
    if (!session.consent_given) {
      setActionError('O consentimento do paciente é obrigatório para iniciar a teleconsulta (CFO 226/2020).')
      return
    }
    setActionError(null)
    setIsStarting(true)
    try {
      const result = await startTeleconsultation(session.id)
      if (result.success) {
        onStatusChange('em_andamento', new Date().toISOString(), null)
      } else {
        setActionError(result.error ?? 'Erro ao iniciar a teleconsulta.')
      }
    } finally {
      setIsStarting(false)
    }
  }

  async function handleEnd() {
    setActionError(null)
    setIsEnding(true)
    try {
      const result = await endTeleconsultation(session.id)
      if (result.success) {
        onStatusChange('concluida', session.started_at, new Date().toISOString())
      } else {
        setActionError(result.error ?? 'Erro ao encerrar a teleconsulta.')
      }
    } finally {
      setIsEnding(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Status da sessão</span>
        <Badge variant="outline">{STATUS_LABELS[session.status] ?? session.status}</Badge>
      </div>

      {/* External link */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Link da reunião</span>
        <a
          href={session.external_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline break-all"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          {session.external_link}
        </a>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-xs text-muted-foreground block">Início</span>
          <span className="text-foreground">{formatDateTime(session.started_at)}</span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Encerramento</span>
          <span className="text-foreground">{formatDateTime(session.ended_at)}</span>
        </div>
      </div>

      {/* Consent indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Consentimento CFO:</span>
        {session.consent_given ? (
          <Badge variant="outline" className="text-green-700 border-green-500 dark:text-green-400 dark:border-green-700">
            Registrado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-destructive border-destructive/50">
            Não registrado
          </Badge>
        )}
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {!isReadOnly && (
        <div className="flex gap-2">
          {session.status === 'agendada' && (
            <Button
              disabled={!session.consent_given || isStarting}
              onClick={handleStart}
              size="sm"
              aria-disabled={!session.consent_given || isStarting}
            >
              {isStarting ? 'Iniciando…' : 'Iniciar teleconsulta'}
            </Button>
          )}
          {session.status === 'em_andamento' && (
            <Button
              variant="outline"
              disabled={isEnding}
              onClick={handleEnd}
              size="sm"
            >
              {isEnding ? 'Encerrando…' : 'Encerrar'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeleconsultationForm({
  patients,
  appointments = [],
  professionals = [],
  isReadOnly = false,
  existingSession,
}: TeleconsultationFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionState | null>(existingSession ?? null)

  const form = useForm<TeleconsultationInput>({
    resolver: zodResolver(teleconsultationSchema),
    defaultValues: {
      patient_id: '',
      appointment_id: undefined,
      professional_id: undefined,
      external_link: '',
      consent_given: false,
      notes: undefined,
    },
  })

  const selectedPatientId = form.watch('patient_id')
  const patientAppointments = appointments.filter((a) => a.patient_id === selectedPatientId)

  async function onSubmit(values: TeleconsultationInput) {
    setServerError(null)
    const result = await createTeleconsultation(values)
    if (result.success && result.id) {
      setSession({
        id: result.id,
        consent_given: values.consent_given,
        status: 'agendada',
        started_at: null,
        ended_at: null,
        external_link: values.external_link,
      })
      form.reset()
    } else {
      setServerError(result.error ?? 'Erro ao criar teleconsulta.')
    }
  }

  function handleSessionStatusChange(
    updatedStatus: string,
    startedAt?: string | null,
    endedAt?: string | null
  ) {
    if (!session) return
    setSession({
      ...session,
      status: updatedStatus,
      started_at: startedAt ?? session.started_at,
      ended_at: endedAt ?? session.ended_at,
    })
  }

  // If an existing session is provided (edit mode), show controls directly
  if (session) {
    return (
      <div className="space-y-4">
        <SessionControls
          session={session}
          isReadOnly={isReadOnly}
          onStatusChange={handleSessionStatusChange}
        />
        {session.status === 'agendada' && !isReadOnly && (
          <p className="text-xs text-muted-foreground">
            Para iniciar a teleconsulta, o consentimento CFO deve ter sido registrado no momento da criação.
          </p>
        )}
      </div>
    )
  }

  if (isReadOnly) {
    return (
      <Alert>
        <AlertDescription>
          Acesso somente leitura. Seu papel não permite criar teleconsultas.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Patient selector */}
        <FormField
          control={form.control}
          name="patient_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paciente *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Optional appointment link */}
        {patientAppointments.length > 0 && (
          <FormField
            control={form.control}
            name="appointment_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Atendimento vinculado (opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val || undefined)}
                  value={field.value ?? ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o atendimento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {patientAppointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {new Date(a.start_time).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Optional professional */}
        {professionals.length > 0 && (
          <FormField
            control={form.control}
            name="professional_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profissional responsável (opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val || undefined)}
                  value={field.value ?? ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {professionals.map((pro) => (
                      <SelectItem key={pro.id} value={pro.id}>
                        {pro.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* External meeting link */}
        <FormField
          control={form.control}
          name="external_link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link da reunião *</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Cole o link da reunião (Google Meet, Zoom, Jitsi). O FYNXIA não hospeda o vídeo.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* CFO consent checkbox */}
        <FormField
          control={form.control}
          name="consent_given"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 rounded-lg border border-border p-4 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-tight">
                <FormLabel className="cursor-pointer text-sm font-medium">
                  Consentimento para teleconsulta (CFO 226/2020)
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  O paciente foi informado e consente com a realização da teleconsulta
                  (Resolução CFO 226/2020). O consentimento e o horário são registrados.
                </p>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Criando…' : 'Criar teleconsulta'}
        </Button>
      </form>
    </Form>
  )
}
