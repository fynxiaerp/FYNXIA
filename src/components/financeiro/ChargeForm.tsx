'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { createCharge } from '@/actions/charges'
import { PixQRDisplay } from '@/components/financeiro/PixQRDisplay'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

// ─── Schema ───────────────────────────────────────────────────────────────────
// FIN-04/05: charge creation — patient, billing type, amount, installments, due date.
// T-3-ui-V: Zod validation; amount stored as number (not string) in RHF state.

// Note: avoid z.default() on fields — it makes them optional in input type causing
// RHF resolver type mismatch. Provide defaults via RHF defaultValues instead.
const chargeFormSchema = z.object({
  patientId: z.string().uuid('Selecione um paciente'),
  description: z.string().min(1, 'Descrição obrigatória').max(500),
  billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Selecione o método de pagamento' }),
  }),
  amountStr: z.string().min(1, 'Informe o valor'),
  installments: z.boolean(),
  installmentCount: z.number().int().min(2).max(12),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione a data de vencimento'),
})

type ChargeFormValues = z.infer<typeof chargeFormSchema>

// ─── ChargeResult ─────────────────────────────────────────────────────────────

interface ChargeResult {
  success: boolean
  chargeId?: string
  pix?: { encodedImage: string; payload: string }
  bankSlipUrl?: string
  error?: string
}

// ─── ChargeForm ───────────────────────────────────────────────────────────────
// FIN-04/05/06: charge creation form wired to createCharge Server Action.
// Parcelamento toggle via Switch (FIN-06).
// On success: renders PIX QR (PixQRDisplay) or boleto link inline.
// Phase 2 lesson: @base-ui/react Button/Popover use render prop (not asChild).

interface Patient {
  id: string
  full_name: string
  cpf: string
}

interface ChargeFormProps {
  patients: Patient[]
}

export function ChargeForm({ patients }: ChargeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null)
  const [patientSearch, setPatientSearch] = useState('')

  const form = useForm<ChargeFormValues>({
    resolver: zodResolver(chargeFormSchema),
    defaultValues: {
      patientId: '',
      description: '',
      billingType: 'PIX',
      amountStr: '',
      installments: false,
      installmentCount: 2,
      dueDate: '',
    },
  })

  // Watch installments toggle to conditionally show installment count
  const watchInstallments = useWatch({ control: form.control, name: 'installments' })
  const watchPatientId = useWatch({ control: form.control, name: 'patientId' })

  const selectedPatient = patients.find((p) => p.id === watchPatientId)

  // Filter patients by search
  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true
    const q = patientSearch.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  })

  // BRL mask on blur
  function handleAmountBlur(value: string) {
    const digits = value.replace(/[^\d]/g, '')
    if (!digits) return
    const num = parseInt(digits, 10) / 100
    form.setValue(
      'amountStr',
      num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      { shouldValidate: true }
    )
  }

  // Parse BRL masked string to number
  function parseBRLToNumber(masked: string): number {
    const cleaned = masked
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    return parseFloat(cleaned)
  }

  async function onSubmit(values: ChargeFormValues) {
    setChargeResult(null)
    setIsSubmitting(true)
    try {
      const amount = parseBRLToNumber(values.amountStr)
      if (isNaN(amount) || amount <= 0) {
        form.setError('amountStr', { message: 'Valor inválido' })
        return
      }

      const result = await createCharge({
        patientId: values.patientId,
        description: values.description,
        billingType: values.billingType,
        value: amount,
        dueDate: values.dueDate,
        installmentCount: values.installments ? values.installmentCount : 1,
      })

      setChargeResult(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Paciente */}
          <FormField
            control={form.control}
            name="patientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente *</FormLabel>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredPatients.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Paciente não encontrado.{' '}
                          <Link
                            href="/clinica/pacientes/novo"
                            className="text-primary underline"
                          >
                            Cadastrar paciente
                          </Link>
                        </div>
                      ) : (
                        filteredPatients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} — {p.cpf}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrição */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Consulta, tratamento de canal..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Método de pagamento */}
          <FormField
            control={form.control}
            name="billingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de pagamento</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="BOLETO">Boleto bancário</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Valor total */}
          <FormField
            control={form.control}
            name="amountStr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor total (R$) *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="decimal"
                    aria-label="Valor em reais"
                    placeholder="R$ 0,00"
                    onBlur={(e) => {
                      handleAmountBlur(e.target.value)
                      field.onBlur()
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Parcelado? — Switch (FIN-06) */}
          <FormField
            control={form.control}
            name="installments"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-3">
                  <Switch
                    id="installments-switch"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="installments-switch" className="cursor-pointer">
                    Parcelado?
                  </Label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Número de parcelas — shown when Switch is on */}
          {watchInstallments && (
            <FormField
              control={form.control}
              name="installmentCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº de parcelas</FormLabel>
                  <Select
                    onValueChange={(v) => { if (v) field.onChange(parseInt(v, 10)) }}
                    defaultValue={field.value != null ? String(field.value) : '2'}
                  >
                    <FormControl>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Parcelas" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[2, 3, 6, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Vencimento — @base-ui PopoverTrigger render prop pattern */}
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento *</FormLabel>
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          'flex h-9 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value
                          ? format(new Date(field.value + 'T12:00:00'), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })
                          : 'Selecione o vencimento'}
                      </button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        field.value ? new Date(field.value + 'T12:00:00') : undefined
                      }
                      onSelect={(date) => {
                        if (date) field.onChange(format(date, 'yyyy-MM-dd'))
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Emitindo…
              </>
            ) : (
              'Emitir Cobrança'
            )}
          </Button>
        </form>
      </Form>

      {/* Result block — rendered inline after successful charge creation */}
      {chargeResult && (
        <div className="rounded-lg border border-border p-6">
          {chargeResult.success ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-green-700">
                  Cobrança emitida com sucesso
                </p>
                {chargeResult.chargeId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {chargeResult.chargeId}
                  </p>
                )}
              </div>

              {/* PIX: QR code + copia-e-cola */}
              {chargeResult.pix && (
                <PixQRDisplay
                  encodedImage={chargeResult.pix.encodedImage}
                  payload={chargeResult.pix.payload}
                  patientName={selectedPatient?.full_name}
                />
              )}

              {/* Boleto: link + barcode */}
              {chargeResult.bankSlipUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Boleto bancário</p>
                  <a
                    href={chargeResult.bankSlipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    Abrir boleto em nova aba
                  </a>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {chargeResult.bankSlipUrl}
                  </p>
                </div>
              )}

              {/* Receipt PDF link */}
              {chargeResult.chargeId && (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/api/financeiro/charges/${chargeResult.chargeId}/recibo.pdf`}
                    />
                  }
                >
                  Baixar Recibo PDF
                </Button>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                {chargeResult.error
                  ? `Não foi possível gerar a cobrança: ${chargeResult.error}. Verifique os dados e tente novamente.`
                  : 'Erro ao emitir cobrança. Tente novamente.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
