'use client'

// PayableFormDialog — create / edit a Conta a Pagar.
// Pattern: Dialog + RHF + zodResolver — mirrors BankAccountFormDialog.tsx + TransactionModal.tsx.
// BRL mask on blur: handleAmountBlur from TransactionModal pattern.
// Date picker: Popover + Calendar, dd/MM/yyyy ptBR — mirrors TransactionModal transactionDate.
// No .default() in schema (D-133).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { createPayable } from '@/actions/payables'
import { cn } from '@/lib/utils'

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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

type SupplierOption = { id: string; name: string; tipo: string; ativo: boolean | null }
type LeafAccount = { id: string; name: string; code: string; type: string }
type CostCenterOption = { id: string; name: string; ativo: boolean; is_default?: boolean }
type UnitOption = { id: string; name: string }

type PayableRow = {
  id: string
  descricao: string
  valor_total: number
  supplier_id: string | null
  unit_id: string | null
}

interface PayableFormDialogProps {
  mode: 'create' | 'edit'
  payable?: PayableRow
  suppliers: SupplierOption[]
  leafAccounts: LeafAccount[]
  costCenters: CostCenterOption[]
  units: UnitOption[]
  children: React.ReactNode
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() — RHF defaultValues supply all values (D-133).

const payableFormSchema = z.object({
  supplierId: z
    .string({ required_error: 'Fornecedor obrigatório', invalid_type_error: 'Fornecedor obrigatório' })
    .uuid({ message: 'Fornecedor obrigatório' }),

  descricao: z.string().min(1, 'Descrição obrigatória').max(500),

  accountId: z
    .string({ required_error: 'Conta contábil obrigatória', invalid_type_error: 'Conta contábil obrigatória' })
    .uuid({ message: 'Conta contábil obrigatória' }),

  costCenterId: z
    .string({ required_error: 'Centro de custo obrigatório', invalid_type_error: 'Centro de custo obrigatório' })
    .uuid({ message: 'Centro de custo obrigatório' }),

  unitId: z.string().uuid().optional().nullable(),

  valorStr: z.string().min(1, 'Informe o valor'),

  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione a data de vencimento'),

  parcelas: z.coerce.number().int().min(1).max(60),

  notes: z.string().max(2000).optional().nullable(),
})

type PayableFormValues = z.infer<typeof payableFormSchema>

// ─── BRL mask helper ──────────────────────────────────────────────────────────

function handleAmountBlur(value: string, setValue: (v: string) => void) {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return
  const num = parseInt(digits, 10) / 100
  setValue(num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
}

function parseBRLToNumber(masked: string): number {
  const cleaned = masked
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── PayableFormDialog ────────────────────────────────────────────────────────

export function PayableFormDialog({
  mode,
  payable,
  suppliers,
  leafAccounts,
  costCenters,
  units,
  children,
}: PayableFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const defaultCC = costCenters.find((cc) => cc.is_default) ?? costCenters[0]

  const form = useForm<PayableFormValues>({
    resolver: zodResolver(payableFormSchema),
    defaultValues: {
      supplierId: payable?.supplier_id ?? '',
      descricao: payable?.descricao ?? '',
      accountId: '',
      costCenterId: defaultCC?.id ?? '',
      unitId: payable?.unit_id ?? null,
      valorStr: payable?.valor_total
        ? payable.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '',
      dueDate: '',
      parcelas: 1,
      notes: '',
    },
  })

  function handleOpen(value: boolean) {
    if (value) {
      form.reset({
        supplierId: payable?.supplier_id ?? '',
        descricao: payable?.descricao ?? '',
        accountId: '',
        costCenterId: defaultCC?.id ?? '',
        unitId: payable?.unit_id ?? null,
        valorStr: payable?.valor_total
          ? payable.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '',
        dueDate: '',
        parcelas: 1,
        notes: '',
      })
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: PayableFormValues) {
    setServerError(null)
    const valorTotal = parseBRLToNumber(values.valorStr)
    if (isNaN(valorTotal) || valorTotal <= 0) {
      form.setError('valorStr', { message: 'Valor inválido' })
      return
    }

    const result = await createPayable({
      supplierId: values.supplierId,
      descricao: values.descricao,
      accountId: values.accountId,
      costCenterId: values.costCenterId,
      unitId: values.unitId ?? null,
      valorTotal,
      dueDate: values.dueDate,
      parcelas: values.parcelas,
      notes: values.notes ?? null,
    })

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const title = mode === 'create' ? 'Nova Conta a Pagar' : 'Editar Conta a Pagar'
  const parcelasValue = form.watch('parcelas')
  const dueDateValue = form.watch('dueDate')

  return (
    <>
      <div
        className="contents"
        onClick={() => handleOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen(true)}
        role="presentation"
      >
        {children}
      </div>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-lg bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Fornecedor */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição */}
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Aluguel outubro/2026"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conta Contábil */}
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Contábil *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione a conta contábil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leafAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Centro de Custo */}
              <FormField
                control={form.control}
                name="costCenterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de Custo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione o centro de custo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {costCenters.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unidade (optional) */}
              {units.length > 0 && (
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        value={field.value ?? 'none'}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder="Todas as unidades" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Todas as unidades</SelectItem>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Valor Total — BRL mask */}
              <FormField
                control={form.control}
                name="valorStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        className="bg-background border-border text-foreground tabular-nums"
                        aria-label="Valor total em reais"
                        {...field}
                        onBlur={(e) => {
                          handleAmountBlur(e.target.value, (v) =>
                            form.setValue('valorStr', v, { shouldValidate: true })
                          )
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data de Vencimento — Popover + Calendar (mirrors TransactionModal) */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento *</FormLabel>
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

              {/* Parcelas */}
              <FormField
                control={form.control}
                name="parcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcelas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        className="bg-background border-border text-foreground w-24"
                        {...field}
                      />
                    </FormControl>
                    {parcelasValue > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Gera {parcelasValue} parcelas com vencimentos mensais
                        {dueDateValue ? ` a partir de ${format(new Date(dueDateValue + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}` : ''}.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações adicionais (opcional)"
                        className="bg-background border-border text-foreground resize-none"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
