'use client'
/**
 * SoapEditor — structured SOAP clinical note editor (TEL-02)
 *
 * Phase 12:
 * - RHF v7 + zodResolver(soapSchema); defaultValues (NO .default() on schema)
 * - Four SOAP textareas: Subjetivo (S), Objetivo (O), Avaliação (A), Plano (P)
 * - Links to both teleconsultation_id (session) and appointment_id (atendimento)
 * - On success: shows confirmation that the record was linked to prontuário + atendimento
 *
 * Design: @base-ui Button render-prop (NEVER asChild), design tokens, pt-BR, Alert for errors.
 *
 * Phase: 12-receitu-rio-teleodontologia (TEL-02)
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle } from 'lucide-react'
import { soapSchema, type SoapInput } from '@/lib/validators/teleconsultation'
import { createSoapRecord } from '@/actions/teleconsultations'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── SOAP field definitions (pt-BR labels + helpers) ─────────────────────────

const SOAP_FIELDS = [
  {
    name: 'soap_subjective' as const,
    label: 'S — Subjetivo',
    helper: 'Queixa principal e sintomas relatados pelo paciente (em suas próprias palavras).',
    placeholder: 'Ex.: Paciente relata dor na região inferior esquerda há 3 dias…',
  },
  {
    name: 'soap_objective' as const,
    label: 'O — Objetivo',
    helper: 'Achados clínicos e resultados do exame objetivo (dados mensuráveis/observáveis).',
    placeholder: 'Ex.: Dente 36 com sensibilidade à percussão, sem mobilidade…',
  },
  {
    name: 'soap_assessment' as const,
    label: 'A — Avaliação',
    helper: 'Avaliação/diagnóstico e raciocínio clínico.',
    placeholder: 'Ex.: Pulpite irreversível em dente 36…',
  },
  {
    name: 'soap_plan' as const,
    label: 'P — Plano',
    helper: 'Plano de tratamento, conduta e próximos passos.',
    placeholder: 'Ex.: Indicado tratamento endodôntico. Prescrição de analgésico…',
  },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface SoapEditorProps {
  patientId: string
  teleconsultationId?: string
  appointmentId?: string
  isReadOnly?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SoapEditor({
  patientId,
  teleconsultationId,
  appointmentId,
  isReadOnly = false,
}: SoapEditorProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const form = useForm<SoapInput>({
    resolver: zodResolver(soapSchema),
    defaultValues: {
      patient_id: patientId,
      teleconsultation_id: teleconsultationId,
      appointment_id: appointmentId,
      soap_subjective: '',
      soap_objective: '',
      soap_assessment: '',
      soap_plan: '',
    },
  })

  async function onSubmit(values: SoapInput) {
    setServerError(null)
    const result = await createSoapRecord({
      ...values,
      patient_id: patientId,
      teleconsultation_id: teleconsultationId,
      appointment_id: appointmentId,
    })
    if (result.success && result.id) {
      setSavedId(result.id)
    } else {
      setServerError(result.error ?? 'Erro ao registrar SOAP.')
    }
  }

  if (isReadOnly) {
    return (
      <Alert>
        <AlertDescription>
          Acesso somente leitura. Seu papel não permite registrar notas clínicas.
        </AlertDescription>
      </Alert>
    )
  }

  if (savedId) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <CheckCircle className="size-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Registro SOAP salvo com sucesso.
          </p>
          <p className="text-xs text-muted-foreground">
            O registro foi vinculado ao prontuário do paciente
            {teleconsultationId ? ' e à sessão de teleconsulta' : ''}
            {appointmentId ? ' e ao atendimento' : ''}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {SOAP_FIELDS.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel className="font-semibold">{field.label}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={field.placeholder}
                    className="min-h-[100px] resize-y"
                    {...rhfField}
                    value={rhfField.value ?? ''}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">{field.helper}</p>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Salvando…' : 'Salvar registro SOAP'}
        </Button>
      </form>
    </Form>
  )
}
