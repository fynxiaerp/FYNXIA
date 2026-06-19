'use client'
/**
 * KitUsageForm — Registrar uso de kit (CME-02 / CME-03)
 *
 * RHF + zodResolver(kitUsageSchema).
 *
 * Props:
 *   cycles       — lista de ciclos com status, biological_result, validade
 *   patients     — lista de pacientes da clínica
 *   appointments — lista de atendimentos recentes (opcional)
 *
 * Comportamento do bloco de segurança (CME-02):
 *   - O Select de ciclos desabilita itens não utilizáveis via isCycleUsable()
 *     APENAS POR CONVENIÊNCIA — o servidor é a fonte de verdade.
 *   - Após submit, se registerKitUsage retornar { blocked:true } ou { error },
 *     um Alert destrutivo exibe o motivo do bloqueio e NÃO exibe estado de sucesso.
 *   - O servidor re-executa isCycleUsable sobre a linha FRESCA do DB (T-13-12/T-13-13).
 *     Nenhum campo do cliente pode contornar esse bloqueio.
 *
 * @base-ui Button render-prop, NUNCA asChild.
 * Design tokens apenas. Zod v3. No .default() nas schemas (D-133).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 06
 * Requirements: CME-02, CME-03
 */

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { kitUsageSchema, type KitUsageInput } from '@/lib/validators/sterilization'
import { isCycleUsable, type BiologicalResult } from '@/lib/esterilizacao/cycle-status'
import { registerKitUsage } from '@/actions/sterilization'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CycleOption {
  id: string
  cycle_number: string | null
  cycle_date: string
  biological_result: BiologicalResult
  validade: string | null
  status: string
}

export interface PatientOption {
  id: string
  full_name: string
}

export interface AppointmentOption {
  id: string
  scheduled_at: string
  patient_id: string
}

interface KitUsageFormProps {
  cycles: CycleOption[]
  patients: PatientOption[]
  appointments?: AppointmentOption[]
  onSuccess?: (usageId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function cycleBadgeLabel(status: string): string {
  const map: Record<string, string> = {
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    vencido: 'Vencido',
    pendente: 'Pendente',
  }
  return map[status] ?? status
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KitUsageForm({
  cycles,
  patients,
  appointments = [],
  onSuccess,
}: KitUsageFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<KitUsageInput>({
    resolver: zodResolver(kitUsageSchema),
    defaultValues: {
      sterilization_cycle_id: '',
      patient_id: '',
      appointment_id: undefined,
      kit_label: '',
    },
  })

  const selectedPatientId = watch('patient_id')
  const filteredAppointments = appointments.filter(
    (a) => !selectedPatientId || a.patient_id === selectedPatientId
  )

  async function onSubmit(data: KitUsageInput) {
    setServerError(null)
    setIsBlocked(false)
    setSuccessMessage(null)

    const result = await registerKitUsage({
      ...data,
      appointment_id: data.appointment_id || undefined,
      kit_label: data.kit_label || undefined,
    })

    // ── SAFETY BLOCK: the SERVER is authoritative (CME-02) ──────────────────
    // The client-side isCycleUsable filter is CONVENIENCE only.
    // registerKitUsage re-fetches the cycle server-side and runs isCycleUsable
    // against the FRESH row (T-13-12 / T-13-13). If the server blocks the usage,
    // we display the block reason prominently and do NOT show a success state.
    if (!result.success) {
      if (result.blocked) {
        setIsBlocked(true)
      }
      setServerError(result.error ?? 'Erro ao registrar uso de kit.')
      return
    }

    setSuccessMessage('Uso de kit registrado com sucesso.')
    reset({
      sterilization_cycle_id: '',
      patient_id: '',
      appointment_id: undefined,
      kit_label: '',
    })

    if (result.id) {
      onSuccess?.(result.id)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* SAFETY BLOCK alert — shown when server blocks the usage (CME-02) */}
      {isBlocked && serverError && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Uso bloqueado pelo servidor:</strong> {serverError}
          </AlertDescription>
        </Alert>
      )}

      {/* Generic server error (not a block) */}
      {!isBlocked && serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Ciclo de esterilização */}
      <div className="space-y-1.5">
        <Label htmlFor="sterilization_cycle_id">Ciclo de Esterilização (Lote) *</Label>
        <Controller
          control={control}
          name="sterilization_cycle_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger
                id="sterilization_cycle_id"
                className="w-full bg-background border-border text-foreground"
              >
                <SelectValue placeholder="Selecione o ciclo" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {cycles.map((cycle) => {
                  // Client-side convenience filter: pre-warn on non-usable cycles.
                  // The SERVER block is authoritative — this only improves UX.
                  const check = isCycleUsable({
                    biologicalResult: cycle.biological_result,
                    validade: cycle.validade,
                  })
                  const label = cycle.cycle_number
                    ? `Ciclo ${cycle.cycle_number} — ${formatDate(cycle.cycle_date)}`
                    : `Ciclo de ${formatDate(cycle.cycle_date)}`

                  return (
                    <SelectItem
                      key={cycle.id}
                      value={cycle.id}
                      disabled={!check.usable}
                      className="text-foreground"
                    >
                      <span className="flex items-center gap-2">
                        {label}
                        <Badge
                          variant={
                            cycle.status === 'aprovado'
                              ? 'default'
                              : cycle.status === 'reprovado' || cycle.status === 'vencido'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {cycleBadgeLabel(cycle.status)}
                        </Badge>
                        {!check.usable && (
                          <span className="text-xs text-destructive">
                            — bloqueado: {check.reason}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        />
        {errors.sterilization_cycle_id && (
          <p className="text-xs text-destructive">{errors.sterilization_cycle_id.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Apenas ciclos aprovados e dentro da validade podem ser selecionados. O servidor
          re-verifica o status no momento do registro (CME-02).
        </p>
      </div>

      {/* Paciente */}
      <div className="space-y-1.5">
        <Label htmlFor="patient_id">Paciente *</Label>
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger
                id="patient_id"
                className="w-full bg-background border-border text-foreground"
              >
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-foreground">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.patient_id && (
          <p className="text-xs text-destructive">{errors.patient_id.message}</p>
        )}
      </div>

      {/* Atendimento (opcional) */}
      {filteredAppointments.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="appointment_id">Atendimento (opcional)</Label>
          <Controller
            control={control}
            name="appointment_id"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(value) => field.onChange(value || undefined)}
              >
                <SelectTrigger
                  id="appointment_id"
                  className="w-full bg-background border-border text-foreground"
                >
                  <SelectValue placeholder="Selecione o atendimento" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {filteredAppointments.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-foreground">
                      {formatDate(a.scheduled_at)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.appointment_id && (
            <p className="text-xs text-destructive">{errors.appointment_id.message}</p>
          )}
        </div>
      )}

      {/* Etiqueta do kit */}
      <div className="space-y-1.5">
        <Label htmlFor="kit_label">Etiqueta do Kit</Label>
        <Input
          id="kit_label"
          placeholder="Ex.: KIT-001 / Bandeja cirúrgica"
          className="bg-background border-border text-foreground"
          {...register('kit_label')}
        />
        {errors.kit_label && (
          <p className="text-xs text-destructive">{errors.kit_label.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Registrando...' : 'Registrar Uso de Kit'}
      </Button>
    </form>
  )
}
