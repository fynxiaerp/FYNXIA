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
// FCAD-02: manual transaction — tipo (receita/despesa), categoria, valor, data, descrição.
// + classification fields: accountId (required), costCenterId (required), bankAccountId (optional).
// D-133 / D-14-04-01: NO .default() — RHF defaultValues supplies initial values.
// required_error fires on missing/undefined; uuid message fires on invalid-format present value.

const modalSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  categoryId: z.string().uuid().optional().nullable(),
  amountStr: z.string().min(1, 'Informe o valor'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione uma data'),
  description: z.string().max(500).optional().nullable(),
  // FCAD-02 classification fields
  accountId: z
    .string({
      required_error: 'Conta contábil obrigatória',
      invalid_type_error: 'Conta contábil obrigatória',
    })
    .uuid({ message: 'Conta contábil obrigatória' }),
  costCenterId: z
    .string({
      required_error: 'Centro de custo obrigatório',
      invalid_type_error: 'Centro de custo obrigatório',
    })
    .uuid({ message: 'Centro de custo obrigatório' }),
  bankAccountId: z.string().uuid().optional().nullable(),
})

type ModalFormValues = z.infer<typeof modalSchema>

// ─── TransactionModal ─────────────────────────────────────────────────────────
// Dialog triggered by "+ Lançamento" button.
// On submit → createTransaction Server Action; on success close + router.refresh().
// FCAD-02: Conta Contábil auto-fills from selected category's account_id.
// Phase 2 lesson: @base-ui/react primitives use render prop (NOT asChild).

interface CategoryOption {
  id: string
  name: string
  type: string | null
  account_id?: string | null
}

interface LeafAccount {
  id: string
  name: string
  code: string
  type: string
}

interface CostCenterOption {
  id: string
  name: string
  is_default?: boolean
}

interface BankAccountOption {
  id: string
  name: string
}

interface TransactionModalProps {
  categories: CategoryOption[]
  leafAccounts: LeafAccount[]
  costCenters: CostCenterOption[]
  bankAccounts: BankAccountOption[]
  defaultCostCenterId?: string
  children: React.ReactNode
}

export function TransactionModal({
  categories,
  leafAccounts,
  costCenters,
  bankAccounts,
  defaultCostCenterId,
  children,
}: TransactionModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Tracks whether Conta Contábil was auto-filled from category (shows helper text)
  const [accountAutoFilled, setAccountAutoFilled] = useState(false)

  const form = useForm<ModalFormValues>({
    resolver: zodResolver(modalSchema),
    defaultValues: {
      type: 'receita',
      categoryId: null,
      amountStr: '',
      transactionDate: '',
      description: '',
      accountId: '',
      costCenterId: defaultCostCenterId ?? '',
      bankAccountId: null,
    },
  })

  // Current transaction type — used to filter leaf accounts by type
  const currentType = form.watch('type')

  // Leaf accounts filtered to match the current transaction type
  const filteredLeafAccounts = leafAccounts.filter((acc) => acc.type === currentType)

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
        accountId: values.accountId,
        costCenterId: values.costCenterId,
        bankAccountId: values.bankAccountId ?? null,
      })

      if (!result.success) {
        setServerError(result.error ?? 'Erro ao salvar lançamento')
        return
      }

      // Success: close dialog, refresh server component data
      setOpen(false)
      form.reset({
        type: 'receita',
        categoryId: null,
        amountStr: '',
        transactionDate: '',
        description: '',
        accountId: '',
        costCenterId: defaultCostCenterId ?? '',
        bankAccountId: null,
      })
      setAccountAutoFilled(false)
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

  // When user picks a Categoria, auto-fill Conta Contábil from category's mapped account
  function handleCategoryChange(value: string | null) {
    if (!value) return
    const categoryId = value === 'none' ? null : value
    form.setValue('categoryId', categoryId)

    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId)
      if (cat?.account_id) {
        form.setValue('accountId', cat.account_id, { shouldValidate: true })
        setAccountAutoFilled(true)
      } else {
        // Category has no mapped account — clear auto-fill state
        setAccountAutoFilled(false)
      }
    } else {
      setAccountAutoFilled(false)
    }
  }

  // When transaction type changes, clear accountId if it no longer matches the type
  function handleTypeChange(value: string | null) {
    if (!value) return
    form.setValue('type', value as 'receita' | 'despesa')
    // Clear accountId when type changes — prior auto-filled or selected account may be wrong type
    const currentAccountId = form.getValues('accountId')
    if (currentAccountId) {
      const acct = leafAccounts.find((a) => a.id === currentAccountId)
      if (acct && acct.type !== value) {
        form.setValue('accountId', '', { shouldValidate: false })
        setAccountAutoFilled(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) {
        form.reset({
          type: 'receita',
          categoryId: null,
          amountStr: '',
          transactionDate: '',
          description: '',
          accountId: '',
          costCenterId: defaultCostCenterId ?? '',
          bankAccountId: null,
        })
        setAccountAutoFilled(false)
        setServerError(null)
      }
    }}>
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
                  <Select
                    onValueChange={(v) => {
                      if (!v) return
                      field.onChange(v)
                      handleTypeChange(v)
                    }}
                    defaultValue={field.value}
                  >
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
                    onValueChange={(v) => {
                      field.onChange(v === 'none' ? null : v)
                      handleCategoryChange(v)
                    }}
                    value={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories
                        .filter((cat) => cat.type === currentType || cat.type === null)
                        .map((cat) => (
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

            {/* Conta Contábil (FCAD-02, required) */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Contábil</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v)
                      // User manually picked — clear auto-fill helper
                      setAccountAutoFilled(false)
                    }}
                    value={field.value ?? ''}
                  >
                    <FormControl>
                      <SelectTrigger aria-required="true">
                        <SelectValue placeholder="Selecione a conta contábil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredLeafAccounts.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma conta disponível para {currentType}
                        </SelectItem>
                      ) : (
                        filteredLeafAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} — {acc.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {accountAutoFilled && (
                    <p
                      className="text-xs text-muted-foreground"
                      id="account-auto-filled-hint"
                    >
                      Preenchido automaticamente pela categoria
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Centro de Custo (FCAD-02, required) */}
            <FormField
              control={form.control}
              name="costCenterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Centro de Custo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                  >
                    <FormControl>
                      <SelectTrigger aria-required="true">
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

            {/* Conta Corrente (optional) */}
            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Corrente (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    value={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma conta corrente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma conta corrente</SelectItem>
                      {bankAccounts.map((ba) => (
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
