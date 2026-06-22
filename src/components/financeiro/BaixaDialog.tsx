'use client'

// BaixaDialog — Baixar parcela de Conta a Pagar.
// Pattern: Dialog + RHF — mirrors BankAccountFormDialog.tsx.
// BRL mask on blur: handleAmountBlur pattern.
// Date picker: Popover + Calendar, dd/MM/yyyy ptBR.
// Shows partial-baixa Alert when valorPago < saldoPendente.
// No .default() in schema (D-133).

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { baixarPayable } from '@/actions/payables'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format/money'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

type BankAccountOption = { id: string; name: string; ativo: boolean }

interface BaixaDialogProps {
  installmentId: string
  saldoPendente: number
  bankAccounts: BankAccountOption[]
  trigger: React.ReactNode
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const baixaSchema = z.object({
  bankAccountId: z
    .string({ required_error: 'Conta corrente obrigatória' })
    .uuid({ message: 'Conta corrente obrigatória' }),

  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione a data de pagamento'),

  valorStr: z.string().min(1, 'Informe o valor pago'),
})

type BaixaFormValues = z.infer<typeof baixaSchema>

// ─── BRL helpers ──────────────────────────────────────────────────────────────

function parseBRLToNumber(masked: string): number {
  const cleaned = masked
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── BaixaDialog ──────────────────────────────────────────────────────────────

export function BaixaDialog({
  installmentId,
  saldoPendente,
  bankAccounts,
  trigger,
}: BaixaDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [isPartial, setIsPartial] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const form = useForm<BaixaFormValues>({
    resolver: zodResolver(baixaSchema),
    defaultValues: {
      bankAccountId: '',
      dataPagamento: today,
      valorStr: saldoPendente
        ? saldoPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '',
    },
  })

  const valorStrValue = form.watch('valorStr')

  // Detect partial baixa
  useEffect(() => {
    const valorPago = parseBRLToNumber(valorStrValue)
    setIsPartial(valorPago > 0 && valorPago < saldoPendente - 0.005)
  }, [valorStrValue, saldoPendente])

  function handleOpen(value: boolean) {
    if (value) {
      form.reset({
        bankAccountId: '',
        dataPagamento: today,
        valorStr: saldoPendente
          ? saldoPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '',
      })
      setServerError(null)
      setIsPartial(false)
    }
    setOpen(value)
  }

  function handleValorBlur(value: string) {
    const digits = value.replace(/[^\d]/g, '')
    if (!digits) return
    const num = parseInt(digits, 10) / 100
    form.setValue(
      'valorStr',
      num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      { shouldValidate: true }
    )
  }

  async function onSubmit(values: BaixaFormValues) {
    setServerError(null)
    const valorPago = parseBRLToNumber(values.valorStr)
    if (isNaN(valorPago) || valorPago <= 0) {
      form.setError('valorStr', { message: 'Valor inválido' })
      return
    }

    const result = await baixarPayable({
      installmentId,
      bankAccountId: values.bankAccountId,
      valorPago,
      dataPagamento: values.dataPagamento,
    })

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao registrar baixa. Tente novamente.')
    }
  }

  const activeAccounts = bankAccounts.filter((ba) => ba.ativo)

  return (
    <>
      <div
        className="contents"
        onClick={() => handleOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen(true)}
        role="presentation"
      >
        {trigger}
      </div>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Registrar Baixa</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Saldo pendente: <span className="font-semibold tabular-nums text-foreground">{formatBRL(saldoPendente)}</span>
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Partial baixa warning */}
              {isPartial && (
                <Alert>
                  <AlertDescription>
                    Baixa parcial — o saldo restante permanece em aberto.
                  </AlertDescription>
                </Alert>
              )}

              {/* Conta Corrente */}
              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Corrente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione a conta corrente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeAccounts.map((ba) => (
                          <SelectItem key={ba.id} value={ba.id}>
                            {ba.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data do Pagamento */}
              <FormField
                control={form.control}
                name="dataPagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Pagamento *</FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal bg-background border-border',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value
                              ? format(new Date(field.value + 'T12:00:00'), 'dd/MM/yyyy', {
                                  locale: ptBR,
                                })
                              : 'Selecione a data'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(format(date, 'yyyy-MM-dd'))
                              setCalendarOpen(false)
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor Pago — BRL mask */}
              <FormField
                control={form.control}
                name="valorStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Pago *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        className="bg-background border-border text-foreground tabular-nums"
                        aria-label="Valor pago em reais"
                        {...field}
                        onBlur={(e) => {
                          handleValorBlur(e.target.value)
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Registrando...' : 'Confirmar Baixa'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
