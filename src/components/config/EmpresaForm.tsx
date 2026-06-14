'use client'
/**
 * EmpresaForm — admin form to edit the rede (clinic) record.
 *
 * SYS-01 / Plan 07-05:
 * Fields: name, documento (CNPJ ou CPF), regime_tributario, phone, address.
 * Submits to saveEmpresa Server Action.
 * Feedback: Alert (success/error) — design token classes only, no raw slate/gray/white.
 *
 * Design system:
 * - bg-background, text-foreground, border-border tokens only
 * - shadcn Select for regime_tributario (wired to RHF via Controller)
 * - @base-ui render-prop pattern (used internally by the Select component)
 */
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveEmpresa, EmpresaActionInput } from '@/actions/empresa'
import { empresaSchema, REGIME_TRIBUTARIO_VALUES } from '@/lib/validators/empresa'

// ─── Regime labels ────────────────────────────────────────────────────────────

const REGIME_LABELS: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmpresaFormProps {
  initial?: {
    id: string
    name: string
    cnpj: string | null
    regime_tributario: string | null
    phone: string | null
    address: string | null
    slug: string
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmpresaForm({ initial }: EmpresaFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EmpresaActionInput>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      name: initial?.name ?? '',
      cnpj_or_cpf: initial?.cnpj ?? '',
      regime_tributario:
        (initial?.regime_tributario as EmpresaActionInput['regime_tributario']) ??
        'simples_nacional',
      phone: initial?.phone ?? '',
      address: initial?.address ?? '',
    },
  })

  async function onSubmit(data: EmpresaActionInput) {
    setServerError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const result = await saveEmpresa(data)
      if (result.success) {
        setSuccessMessage('Dados da empresa salvos com sucesso.')
      } else {
        setServerError(result.error ?? 'Erro ao salvar dados.')
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

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
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

        {/* ── Nome da Rede ─────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Rede *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex.: Clínica Fynxia"
                  className="bg-background border-border text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── CNPJ / CPF ───────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="cnpj_or_cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CNPJ ou CPF *</FormLabel>
              <FormControl>
                <Input
                  placeholder="00.000.000/0001-00 ou 000.000.000-00"
                  className="bg-background border-border text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Regime Tributário ─────────────────────────────────────────────── */}
        <Controller
          control={form.control}
          name="regime_tributario"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Regime Tributário *</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione o regime" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIME_TRIBUTARIO_VALUES.map((regime) => (
                      <SelectItem key={regime} value={regime}>
                        {REGIME_LABELS[regime]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              {fieldState.error && (
                <p className="text-sm font-medium text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* ── Telefone ─────────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input
                  placeholder="(11) 99999-9999"
                  className="bg-background border-border text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Endereço ─────────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endereço</FormLabel>
              <FormControl>
                <Input
                  placeholder="Rua, número, bairro, cidade"
                  className="bg-background border-border text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar Dados da Empresa'}
        </Button>
      </form>
    </Form>
  )
}
