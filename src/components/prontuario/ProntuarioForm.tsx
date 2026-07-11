'use client'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createMedicalRecord } from '@/actions/medical-records'
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
import { MaterialsUsedSection } from '@/components/estoque/MaterialsUsedSection'

// Client-side Zod schema — mirrors server validator but for RHF integration
const prontuarioFormSchema = z
  .object({
    diagnosis: z.string().optional(),
    treatment_plan: z.string().optional(),
    prescription: z.string().optional(),
  })
  .refine(
    (data) =>
      !!(data.diagnosis?.trim() || data.treatment_plan?.trim() || data.prescription?.trim()),
    {
      message: 'Ao menos um campo deve ser preenchido',
      path: ['diagnosis'],
    }
  )

type ProntuarioFormValues = z.infer<typeof prontuarioFormSchema>

interface ProntuarioFormProps {
  patientId: string
  /**
   * Serviço/procedimento do atendimento — opcional (D-22). O fluxo atual de
   * ProntuarioForm não tem seleção de procedimento; quando um parent futuro
   * passar serviceId, a seção "Materiais Utilizados" aparece automaticamente
   * (auto-oculta quando o serviço não tem templates configurados).
   */
  serviceId?: string
}

export function ProntuarioForm({ patientId, serviceId }: ProntuarioFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProntuarioFormValues>({
    resolver: zodResolver(prontuarioFormSchema),
    defaultValues: {
      diagnosis: '',
      treatment_plan: '',
      prescription: '',
    },
  })

  function onSubmit(values: ProntuarioFormValues) {
    setServerError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await createMedicalRecord({
        patient_id: patientId,
        diagnosis: values.diagnosis ?? undefined,
        treatment_plan: values.treatment_plan ?? undefined,
        prescription: values.prescription ?? undefined,
      })

      if (result.success) {
        setSuccess(true)
        form.reset()
        // Reload to show new record in history
        window.location.reload()
      } else {
        setServerError(result.error ?? 'Erro ao registrar atendimento')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="diagnosis"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Diagnóstico</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Ex: Cárie classe II no dente 16..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="treatment_plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Plano de Tratamento</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Ex: Restauração direta com resina composta..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Prescrição</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Ex: Amoxicilina 500mg 8/8h por 7 dias..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Materiais Utilizados (D-22) — auto-oculta quando serviceId ausente ou sem templates */}
        <MaterialsUsedSection serviceId={serviceId} />

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Registrando...' : 'Registrar Atendimento'}
        </Button>
      </form>
    </Form>
  )
}
