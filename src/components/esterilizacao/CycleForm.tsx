'use client'
/**
 * CycleForm — Registrar ciclo de esterilização (CME-01)
 *
 * RHF + zodResolver(sterilizationCycleSchema).
 * Props:
 *   autoclaves — recursos do tipo 'equipamento' da clínica (fonte D-01)
 *   onSuccess  — callback chamado após registro bem-sucedido
 *
 * Campos:
 *   autoclave_id   — Select/combobox dos autoclaves disponíveis
 *   cycle_number   — número do ciclo (opcional)
 *   temperatura    — °C (opcional)
 *   tempo_minutos  — minutos (opcional)
 *   pressao        — kPa (opcional)
 *   biological_result — pendente/aprovado/reprovado
 *   cycle_date     — data do ciclo (padrão: hoje)
 *   validade       — data de validade do material (opcional)
 *   notes          — observações (opcional)
 *
 * Quando biological_result === 'reprovado' exibe aviso inline (ciclo bloqueado).
 * @base-ui Button render-prop, NUNCA asChild.
 * Design tokens apenas. Zod v3. No .default() nas schemas (D-133).
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 06
 * Requirements: CME-01
 */

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  sterilizationCycleSchema,
  type SterilizationCycleInput,
} from '@/lib/validators/sterilization'
import { registerSterilizationCycle } from '@/actions/sterilization'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoclaveOption {
  id: string
  nome: string
}

interface CycleFormProps {
  autoclaves: AutoclaveOption[]
  onSuccess?: (cycleId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CycleForm({ autoclaves, onSuccess }: CycleFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SterilizationCycleInput>({
    resolver: zodResolver(sterilizationCycleSchema),
    defaultValues: {
      autoclave_id: '',
      cycle_number: '',
      temperatura: undefined,
      tempo_minutos: undefined,
      pressao: undefined,
      biological_result: 'pendente',
      cycle_date: todayIso(),
      validade: '',
      notes: '',
    },
  })

  const biologicalResult = watch('biological_result')

  async function onSubmit(data: SterilizationCycleInput) {
    setServerError(null)
    setSuccessMessage(null)

    const result = await registerSterilizationCycle({
      ...data,
      // Convert empty strings to undefined for optional fields
      cycle_number: data.cycle_number || undefined,
      validade: data.validade || undefined,
      notes: data.notes || undefined,
      temperatura: data.temperatura === undefined || isNaN(data.temperatura as number) ? undefined : data.temperatura,
      tempo_minutos: data.tempo_minutos === undefined || isNaN(data.tempo_minutos as number) ? undefined : data.tempo_minutos,
      pressao: data.pressao === undefined || isNaN(data.pressao as number) ? undefined : data.pressao,
    })

    if (!result.success) {
      setServerError(result.error ?? 'Erro ao registrar ciclo de esterilização.')
      return
    }

    setSuccessMessage('Ciclo registrado com sucesso.')
    reset({
      autoclave_id: '',
      cycle_number: '',
      temperatura: undefined,
      tempo_minutos: undefined,
      pressao: undefined,
      biological_result: 'pendente',
      cycle_date: todayIso(),
      validade: '',
      notes: '',
    })

    if (result.id) {
      onSuccess?.(result.id)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Autoclave */}
      <div className="space-y-1.5">
        <Label htmlFor="autoclave_id">Autoclave *</Label>
        <Controller
          control={control}
          name="autoclave_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger id="autoclave_id" className="w-full bg-background border-border text-foreground">
                <SelectValue placeholder="Selecione a autoclave" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {autoclaves.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id} className="text-foreground">
                    {ac.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.autoclave_id && (
          <p className="text-xs text-destructive">{errors.autoclave_id.message}</p>
        )}
        {autoclaves.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum equipamento cadastrado. Cadastre autoclaves em Recursos.
          </p>
        )}
      </div>

      {/* Número do ciclo + Data do ciclo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cycle_number">N.º do Ciclo</Label>
          <Input
            id="cycle_number"
            placeholder="Ex.: 001/2025"
            className="bg-background border-border text-foreground"
            {...register('cycle_number')}
          />
          {errors.cycle_number && (
            <p className="text-xs text-destructive">{errors.cycle_number.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cycle_date">Data do Ciclo *</Label>
          <Input
            id="cycle_date"
            type="date"
            className="bg-background border-border text-foreground"
            {...register('cycle_date')}
          />
          {errors.cycle_date && (
            <p className="text-xs text-destructive">{errors.cycle_date.message}</p>
          )}
        </div>
      </div>

      {/* Parâmetros físicos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="temperatura">Temperatura (°C)</Label>
          <Input
            id="temperatura"
            type="number"
            step="0.1"
            placeholder="Ex.: 134"
            className="bg-background border-border text-foreground"
            {...register('temperatura', { valueAsNumber: true })}
          />
          {errors.temperatura && (
            <p className="text-xs text-destructive">{errors.temperatura.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tempo_minutos">Tempo (min)</Label>
          <Input
            id="tempo_minutos"
            type="number"
            placeholder="Ex.: 18"
            className="bg-background border-border text-foreground"
            {...register('tempo_minutos', { valueAsNumber: true })}
          />
          {errors.tempo_minutos && (
            <p className="text-xs text-destructive">{errors.tempo_minutos.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pressao">Pressão (kPa)</Label>
          <Input
            id="pressao"
            type="number"
            step="0.1"
            placeholder="Ex.: 206.8"
            className="bg-background border-border text-foreground"
            {...register('pressao', { valueAsNumber: true })}
          />
          {errors.pressao && (
            <p className="text-xs text-destructive">{errors.pressao.message}</p>
          )}
        </div>
      </div>

      {/* Indicador biológico + Validade */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="biological_result">Indicador Biológico *</Label>
          <Controller
            control={control}
            name="biological_result"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? 'pendente')}
              >
                <SelectTrigger id="biological_result" className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione o resultado" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="pendente" className="text-foreground">Pendente</SelectItem>
                  <SelectItem value="aprovado" className="text-foreground">Aprovado</SelectItem>
                  <SelectItem value="reprovado" className="text-foreground">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.biological_result && (
            <p className="text-xs text-destructive">{errors.biological_result.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="validade">Validade do Material</Label>
          <Input
            id="validade"
            type="date"
            className="bg-background border-border text-foreground"
            {...register('validade')}
          />
          {errors.validade && (
            <p className="text-xs text-destructive">{errors.validade.message}</p>
          )}
        </div>
      </div>

      {/* Aviso inline: indicador reprovado → ciclo bloqueado para uso */}
      {biologicalResult === 'reprovado' && (
        <Alert variant="destructive">
          <AlertDescription>
            Indicador biológico <strong>reprovado</strong>: este ciclo será bloqueado para uso de
            kits. Nenhum kit poderá ser vinculado a este lote até que o indicador seja atualizado.
          </AlertDescription>
        </Alert>
      )}

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Observações sobre o ciclo (opcional)"
          rows={3}
          className="bg-background border-border text-foreground resize-y"
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Registrando...' : 'Registrar Ciclo'}
      </Button>
    </form>
  )
}
