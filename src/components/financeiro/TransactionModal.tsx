'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { createTransaction } from '@/actions/transactions'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from '@/lib/utils'

// ─── Schema ───────────────────────────────────────────────────────────────────
// FIN-02: manual transaction — tipo (receita/despesa), categoria, valor, data, descrição.
// T-3-ui-V: Zod validation; amount parsed as number (not string).

const modalSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  categoryId: z.string().uuid().optional().nullable(),
  amountStr: z.string().min(1, 'Informe o valor'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione uma data'),
  description: z.string().max(500).optional().nullable(),
})

type ModalFormValues = z.infer<typeof modalSchema>

// ─── TransactionModal ─────────────────────────────────────────────────────────
// Dialog triggered by "+ Lançamento" button.
// On submit → createTransaction Server Action; on success close + router.refresh().
// Phase 2 lesson: @base-ui/react primitives use render prop (NOT asChild).

interface TransactionModalProps {
  categories: { id: string; name: string; type: string | null }[]
  children: React.ReactNode
}

export function TransactionModal({ categories, children }: TransactionModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ModalFormValues>({
    resolver: zodResolver(modalSchema),
    defaultValues: {
      type: 'receita',
      categoryId: null,
      amountStr: '',
      transactionDate: '',
      description: '',
    },
  })

  async function onSubmit(values: ModalFormValues) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      // Strip non-numeric chars from BRL masked input and parse as float
      const numericStr = values.amountStr.replace(/[^\d,]/g, '').replace(',', '.')
      const amount = parseFloat(numericStr)
      if (isNaN(amount) || amount <= 0) {
        form.setError('amountStr', { message: 'Valor inválido' })
        return
      }

      const result = await createTransaction({
        type: values.type,
        categoryId: values.categoryId ?? null,
        amount,
        transactionDate: values.transactionDate,
        description: values.description ?? null,
      })

      if (!result.success) {
        setServerError(result.error ?? 'Erro ao salvar lançamento')
        return
      }

      // Success: close dialog, refresh server component data
      setOpen(false)
      form.reset()
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  // BRL mask on blur: "1234.56" → "R$ 1.234,56"
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* @base-ui/react DialogTrigger renders a <button>; children are its content */}
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="receita">Receita (Entrada)</SelectItem>
                      <SelectItem value="despesa">Despesa (Saída)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Categoria */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    defaultValue={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor */}
            <FormField
              control={form.control}
              name="amountStr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
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

            {/* Data — Popover + Calendar using @base-ui render prop pattern */}
            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    {/* @base-ui PopoverTrigger: use render prop, not asChild */}
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
                            ? format(
                                new Date(field.value + 'T12:00:00'),
                                'dd/MM/yyyy',
                                { locale: ptBR }
                              )
                            : 'Selecione a data'}
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
                          if (date) {
                            field.onChange(format(date, 'yyyy-MM-dd'))
                          }
                        }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="Descrição opcional"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Lançar Transação'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
