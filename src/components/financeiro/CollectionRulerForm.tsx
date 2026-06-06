'use client'
/**
 * CollectionRulerForm — admin-only form for configuring the collection ruler.
 *
 * FIN-07 / D-10 / 03-UI-SPEC §Régua de Cobrança
 *
 * Controls:
 * - Switch: "Lembrete no vencimento" (due_date_reminder_enabled)
 * - Switch: "Lembretes por atraso" (overdue_reminder_enabled)
 *   └─ Input[number]: "Intervalo (dias)" — enabled only when overdue switch is ON
 * - Muted note: WhatsApp deferred to Fase 4 (D-10)
 * - "Salvar Configurações" → saveCollectionRuler Server Action
 *
 * Accessibility (03-UI-SPEC §Accessibility):
 * - Each Switch has an associated <Label htmlFor> (aria link)
 * - No auto-save — explicit submit required
 */
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveCollectionRuler } from '@/actions/collection-ruler'

// ─── Schema ────────────────────────────────────────────────────────────────────
// No z.default() with RHF resolver — use RHF defaultValues instead (CLAUDE.md decision)

const formSchema = z.object({
  dueDateReminderEnabled: z.boolean(),
  overdueReminderEnabled: z.boolean(),
  overdueIntervalDays: z.number().int().min(1).max(30),
})

type FormValues = z.infer<typeof formSchema>

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CollectionRulerFormProps {
  initialValues?: {
    due_date_reminder_enabled: boolean
    overdue_reminder_enabled: boolean
    overdue_interval_days: number
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CollectionRulerForm({ initialValues }: CollectionRulerFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dueDateReminderEnabled: initialValues?.due_date_reminder_enabled ?? false,
      overdueReminderEnabled: initialValues?.overdue_reminder_enabled ?? false,
      overdueIntervalDays: initialValues?.overdue_interval_days ?? 7,
    },
  })

  // Watch overdue switch to conditionally enable/disable interval input
  const overdueEnabled = useWatch({
    control: form.control,
    name: 'overdueReminderEnabled',
  })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const result = await saveCollectionRuler(data)
      if (result.success) {
        setSuccessMessage('Configurações salvas com sucesso.')
      } else {
        setServerError(result.error ?? 'Erro ao salvar configurações.')
      }
    } catch {
      setServerError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Success / Error feedback ─────────────────────────────────────── */}
        {successMessage && (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* ── Due-date reminder ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold leading-snug">Lembrete no vencimento</h3>
          <FormField
            control={form.control}
            name="dueDateReminderEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <Switch
                    id="due-date-reminder"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="due-date-reminder-desc"
                  />
                </FormControl>
                {/* htmlFor links label to switch for accessibility (03-UI-SPEC §Accessibility) */}
                <Label htmlFor="due-date-reminder" className="cursor-pointer">
                  Ativo — envia e-mail no dia do vencimento
                </Label>
                <FormMessage />
              </FormItem>
            )}
          />
          <p
            id="due-date-reminder-desc"
            className="text-xs text-muted-foreground pl-12"
          >
            Um e-mail de lembrete é enviado automaticamente ao paciente no dia do vencimento da cobrança.
          </p>
        </div>

        {/* ── Overdue reminder ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold leading-snug">Lembretes por atraso</h3>
          <FormField
            control={form.control}
            name="overdueReminderEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <Switch
                    id="overdue-reminder"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="overdue-reminder-desc"
                  />
                </FormControl>
                <Label htmlFor="overdue-reminder" className="cursor-pointer">
                  Ativo — envia a cada N dias de atraso
                </Label>
                <FormMessage />
              </FormItem>
            )}
          />
          <p
            id="overdue-reminder-desc"
            className="text-xs text-muted-foreground pl-12"
          >
            Lembrete repetido enviado a cada intervalo configurado abaixo enquanto a cobrança estiver em atraso.
          </p>

          {/* Interval input — enabled only when overdue switch is ON (useWatch) */}
          <div className="pl-12">
            <FormField
              control={form.control}
              name="overdueIntervalDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="overdue-interval">Intervalo (dias) *</FormLabel>
                  <FormControl>
                    <Input
                      id="overdue-interval"
                      type="number"
                      min={1}
                      max={30}
                      disabled={!overdueEnabled}
                      className="w-24"
                      aria-label="Intervalo em dias entre lembretes de atraso"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Canal de envio ────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-snug">Canal de envio</h3>
          <p className="text-sm text-muted-foreground">
            E-mail (Resend) — ativo
          </p>
          {/* D-10: WhatsApp deferred to Phase 4 — muted informational note */}
          <p className="text-sm text-muted-foreground">
            O canal WhatsApp será habilitado na Fase 4 após verificação Meta Business.
          </p>
        </div>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </form>
    </Form>
  )
}
