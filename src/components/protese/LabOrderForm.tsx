'use client'
/**
 * LabOrderForm — Abrir OS protética (LAB-01)
 *
 * RHF + zodResolver(labOrderSchema). Zod v3 — sem .default() (D-133).
 * useFieldArray para o editor de etapas de prova (stages JSONB).
 *
 * Props:
 *   labs         — lista de laboratórios cadastrados (id + nome)
 *   patients     — lista de pacientes da clínica (id + full_name)
 *   appointments — consultas recentes (opcional)
 *   onSuccess    — callback após OS criada (recebe o id)
 *
 * Campos:
 *   lab_id          Select (por nome do laboratório)
 *   patient_id      Select
 *   appointment_id  Select (opcional)
 *   prosthesis_type texto livre (coroa, PPR, protocolo, etc.)
 *   order_number    texto livre (opcional)
 *   due_date        data (opcional)
 *   status          Select: enviado/prova/concluido (padrão: enviado)
 *   stages          useFieldArray: lista de etapas de prova (nome + prevista)
 *   cost            número opcional — hint: "lança despesa no financeiro"
 *   notes           textarea (opcional)
 *
 * Ao submeter chama createLabOrder; em sucesso mostra confirmação.
 * @base-ui Button render-prop, NUNCA asChild.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 * Requirements: LAB-01, LAB-02
 */

import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'

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

import { labOrderSchema, type LabOrderInput } from '@/lib/validators/lab-order'
import { createLabOrder } from '@/actions/lab-orders'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabOption {
  id: string
  nome: string
}

export interface PatientOption {
  id: string
  full_name: string
}

export interface AppointmentOption {
  id: string
  label: string
  patient_id?: string
}

interface LabOrderFormProps {
  labs: LabOption[]
  patients: PatientOption[]
  appointments?: AppointmentOption[]
  onSuccess?: (orderId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LabOrderForm({ labs, patients, appointments = [], onSuccess }: LabOrderFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LabOrderInput>({
    resolver: zodResolver(labOrderSchema),
    defaultValues: {
      lab_id: '',
      patient_id: '',
      appointment_id: undefined,
      prosthesis_type: '',
      order_number: '',
      due_date: '',
      status: 'enviado',
      stages: [],
      cost: undefined,
      notes: '',
    },
  })

  const { fields: stageFields, append: appendStage, remove: removeStage } = useFieldArray({
    control,
    name: 'stages',
  })

  const selectedPatientId = watch('patient_id')

  // Filter appointments by selected patient (if patient_id is available on appointment)
  const filteredAppointments = selectedPatientId
    ? appointments.filter((a) => !a.patient_id || a.patient_id === selectedPatientId)
    : appointments

  async function onSubmit(data: LabOrderInput) {
    setServerError(null)
    setSuccessMessage(null)

    const input: LabOrderInput = {
      ...data,
      appointment_id: data.appointment_id || undefined,
      order_number: data.order_number || undefined,
      due_date: data.due_date || undefined,
      notes: data.notes || undefined,
      cost: data.cost !== undefined && !isNaN(data.cost) ? data.cost : undefined,
      stages: (data.stages ?? []).map((s) => ({
        nome: s.nome,
        prevista: s.prevista || undefined,
      })),
    }

    const result = await createLabOrder(input)

    if (!result.success) {
      setServerError(result.error ?? 'Erro ao criar ordem de serviço.')
      return
    }

    let msg = 'Ordem de serviço criada com sucesso.'
    if (result.financialTransactionId) {
      msg += ' Despesa lançada no financeiro.'
    }
    setSuccessMessage(msg)

    reset({
      lab_id: '',
      patient_id: '',
      appointment_id: undefined,
      prosthesis_type: '',
      order_number: '',
      due_date: '',
      status: 'enviado',
      stages: [],
      cost: undefined,
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

      {/* Laboratório */}
      <div className="space-y-1.5">
        <Label htmlFor="order-lab-id">Laboratório *</Label>
        <Controller
          control={control}
          name="lab_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger id="order-lab-id" className="w-full bg-background border-border text-foreground">
                <SelectValue placeholder="Selecione o laboratório" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {labs.map((lab) => (
                  <SelectItem key={lab.id} value={lab.id} className="text-foreground">
                    {lab.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.lab_id && (
          <p className="text-xs text-destructive">{errors.lab_id.message}</p>
        )}
        {labs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum laboratório cadastrado. Cadastre em Laboratórios (Fornecedores) primeiro.
          </p>
        )}
      </div>

      {/* Paciente */}
      <div className="space-y-1.5">
        <Label htmlFor="order-patient-id">Paciente *</Label>
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger id="order-patient-id" className="w-full bg-background border-border text-foreground">
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

      {/* Consulta (opcional) */}
      {filteredAppointments.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="order-appointment-id">Consulta (opcional)</Label>
          <Controller
            control={control}
            name="appointment_id"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(value) => field.onChange(value || undefined)}
              >
                <SelectTrigger id="order-appointment-id" className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Vincular a uma consulta (opcional)" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {filteredAppointments.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-foreground">
                      {a.label}
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

      {/* Tipo de prótese + N.º OS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="order-prosthesis-type">Tipo de Prótese *</Label>
          <Input
            id="order-prosthesis-type"
            placeholder="Ex.: Coroa, PPR, Protocolo"
            className="bg-background border-border text-foreground"
            {...register('prosthesis_type')}
          />
          {errors.prosthesis_type && (
            <p className="text-xs text-destructive">{errors.prosthesis_type.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="order-number">N.º da OS</Label>
          <Input
            id="order-number"
            placeholder="Ex.: OS-2025-001 (opcional)"
            className="bg-background border-border text-foreground"
            {...register('order_number')}
          />
          {errors.order_number && (
            <p className="text-xs text-destructive">{errors.order_number.message}</p>
          )}
        </div>
      </div>

      {/* Prazo + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="order-due-date">Prazo de Entrega</Label>
          <Input
            id="order-due-date"
            type="date"
            className="bg-background border-border text-foreground"
            {...register('due_date')}
          />
          {errors.due_date && (
            <p className="text-xs text-destructive">{errors.due_date.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="order-status">Status *</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value ?? 'enviado')}
              >
                <SelectTrigger id="order-status" className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Status da OS" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="enviado" className="text-foreground">Enviado</SelectItem>
                  <SelectItem value="prova" className="text-foreground">Prova</SelectItem>
                  <SelectItem value="concluido" className="text-foreground">Concluído</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.status && (
            <p className="text-xs text-destructive">{errors.status.message}</p>
          )}
        </div>
      </div>

      {/* Etapas de Prova (stages editor) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Etapas de Prova</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => appendStage({ nome: '', prevista: '' })}
          >
            <Plus className="size-3.5" />
            Adicionar Etapa
          </Button>
        </div>

        {stageFields.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma etapa adicionada. Clique em &ldquo;Adicionar Etapa&rdquo; para incluir provas intermediárias.
          </p>
        )}

        {stageFields.map((stageField, index) => (
          <div key={stageField.id} className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`stage-nome-${index}`} className="text-xs">
                  Nome da Etapa *
                </Label>
                <Input
                  id={`stage-nome-${index}`}
                  placeholder="Ex.: Prova de Estrutura"
                  className="bg-background border-border text-foreground text-sm"
                  {...register(`stages.${index}.nome`)}
                />
                {errors.stages?.[index]?.nome && (
                  <p className="text-xs text-destructive">{errors.stages[index]?.nome?.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={`stage-prevista-${index}`} className="text-xs">
                  Data Prevista
                </Label>
                <Input
                  id={`stage-prevista-${index}`}
                  type="date"
                  className="bg-background border-border text-foreground text-sm"
                  {...register(`stages.${index}.prevista`)}
                />
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-5 text-muted-foreground hover:text-destructive"
              onClick={() => removeStage(index)}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Remover etapa</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Custo */}
      <div className="space-y-1.5">
        <Label htmlFor="order-cost">Custo (R$)</Label>
        <Input
          id="order-cost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00 (opcional)"
          className="bg-background border-border text-foreground"
          {...register('cost', { valueAsNumber: true })}
        />
        {errors.cost && (
          <p className="text-xs text-destructive">{errors.cost.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Definir o custo lança uma despesa no módulo financeiro (LAB-02).
        </p>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="order-notes">Observações</Label>
        <Textarea
          id="order-notes"
          placeholder="Instruções especiais, cor, dimensões, etc. (opcional)"
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
        {isSubmitting ? 'Abrindo OS...' : 'Abrir Ordem de Serviço'}
      </Button>
    </form>
  )
}
