'use client'

/**
 * CheckinControls — Reception-side check-in control component (RES-03)
 *
 * Prop-driven: given an appointment's current presence_status, renders
 * the contextually correct next-step button(s) in Portuguese.
 *
 * Self-contained — does NOT import or modify AgendaCalendar.tsx.
 * Embed anywhere in the reception/agenda UI by passing the appointment id
 * and its current presence_status.
 *
 * State machine (PRESENCE_FLOW):
 *   null         → Chegou      (markArrived)
 *   aguardando   → Chamar      (callPatient)
 *   chamado      → Iniciar     (startTreatment)
 *   em_atendimento → Finalizar (finishTreatment)
 *   finalizado   → (nothing)
 */

import { useState, useTransition } from 'react'
import { markArrived, callPatient, startTreatment, finishTreatment } from '@/actions/checkin'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresenceStatus = 'aguardando' | 'chamado' | 'em_atendimento' | 'finalizado' | null

export interface CheckinControlsProps {
  /** Appointment UUID */
  appointmentId: string
  /** Current presence_status — null means patient has not arrived yet */
  presenceStatus: PresenceStatus
  /** If true, all buttons are disabled (read-only role guard at the UI layer) */
  readOnly?: boolean
  /** Callback fired after a successful transition — use to invalidate parent queries */
  onSuccess?: (newStatus: string) => void
}

// ─── Step config ─────────────────────────────────────────────────────────────

interface Step {
  label: string
  nextStatus: string
  action: (id: string) => Promise<{ success: boolean; error?: string }>
  variant: 'primary' | 'warning' | 'success' | 'neutral'
}

function getNextStep(status: PresenceStatus): Step | null {
  switch (status) {
    case null:
      return {
        label: 'Chegou',
        nextStatus: 'aguardando',
        action: markArrived,
        variant: 'neutral',
      }
    case 'aguardando':
      return {
        label: 'Chamar',
        nextStatus: 'chamado',
        action: callPatient,
        variant: 'primary',
      }
    case 'chamado':
      return {
        label: 'Iniciar Atendimento',
        nextStatus: 'em_atendimento',
        action: startTreatment,
        variant: 'warning',
      }
    case 'em_atendimento':
      return {
        label: 'Finalizar',
        nextStatus: 'finalizado',
        action: finishTreatment,
        variant: 'success',
      }
    case 'finalizado':
      return null
  }
}

// ─── Variant styling (design tokens) ─────────────────────────────────────────

const VARIANT_CLASSES: Record<string, string> = {
  neutral:
    'bg-muted text-foreground hover:bg-muted/80 border border-border',
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90',
  warning:
    'bg-amber-500 text-white hover:bg-amber-600',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckinControls({
  appointmentId,
  presenceStatus,
  readOnly = false,
  onSuccess,
}: CheckinControlsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const step = getNextStep(presenceStatus)

  // No action available (finalizado or unknown)
  if (!step) {
    if (presenceStatus === 'finalizado') {
      return (
        <span className="text-xs text-muted-foreground font-medium">
          Atendimento finalizado
        </span>
      )
    }
    return null
  }

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      const result = await step.action(appointmentId)
      if (result.success) {
        onSuccess?.(step.nextStatus)
      } else {
        setError(result.error ?? 'Erro ao atualizar status')
      }
    })
  }

  const variantClass = VARIANT_CLASSES[step.variant] ?? VARIANT_CLASSES.neutral!
  const isDisabled = readOnly || isPending

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isPending}
        className={[
          'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClass,
        ].join(' ')}
      >
        {isPending ? 'Aguardando...' : step.label}
      </button>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
