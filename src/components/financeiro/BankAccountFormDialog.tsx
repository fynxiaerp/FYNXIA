'use client'
// src/components/financeiro/BankAccountFormDialog.tsx
// FCAD-01: Create / edit bank_accounts entry.
// Pattern: shadcn Dialog + RHF + zodResolver — mirrors UnitsManager.tsx.
// UI-SPEC §"Bank Account Form Dialog", §"Copywriting Contract", no .default() (D-133).
// BRL mask on blur reuses handleAmountBlur pattern from TransactionModal.tsx.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createBankAccount, updateBankAccount } from '@/actions/bank-accounts'
import type { BankAccountRow } from '@/actions/bank-accounts'

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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccountFormDialogProps {
  mode: 'create' | 'edit'
  account?: BankAccountRow
  trigger: React.ReactNode
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() — RHF defaultValues supply all values (D-133 pattern).
// saldoInitialStr: BRL-masked string field; parsed to number on submit.

const bankAccountFormSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  banco: z.string().max(100).optional(),
  agencia: z.string().max(20).optional(),
  conta: z.string().max(30).optional(),
  saldoInicialStr: z.string(),
})

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRLMask(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBRLToNumber(masked: string): number {
  const cleaned = masked
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BankAccountFormDialog({
  mode,
  account,
  trigger,
}: BankAccountFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      name: account?.name ?? '',
      banco: account?.banco ?? '',
      agencia: account?.agencia ?? '',
      conta: account?.conta ?? '',
      saldoInicialStr: account?.saldo_inicial
        ? account.saldo_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '',
    },
  })

  function handleOpen(value: boolean) {
    if (value) {
      form.reset({
        name: account?.name ?? '',
        banco: account?.banco ?? '',
        agencia: account?.agencia ?? '',
        conta: account?.conta ?? '',
        saldoInicialStr: account?.saldo_inicial
          ? account.saldo_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '',
      })
      setServerError(null)
    }
    setOpen(value)
  }

  // BRL mask on blur — mirrors TransactionModal.tsx handleAmountBlur pattern
  function handleSaldoBlur(value: string) {
    const masked = formatBRLMask(value)
    if (masked) {
      form.setValue('saldoInicialStr', masked, { shouldValidate: true })
    }
  }

  async function onSubmit(values: BankAccountFormValues) {
    setServerError(null)

    const saldoInicial = parseBRLToNumber(values.saldoInicialStr)

    if (mode === 'edit' && account) {
      const result = await updateBankAccount({
        id: account.id,
        name: values.name,
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        saldoInicial,
      })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    } else {
      const result = await createBankAccount({
        name: values.name,
        banco: values.banco || null,
        agencia: values.agencia || null,
        conta: values.conta || null,
        saldoInicial,
      })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    }
  }

  const title = mode === 'create' ? 'Nova Conta Corrente' : 'Editar Conta Corrente'

  return (
    <>
      {/* Trigger — wrapper div avoids nested button (D-14-05-01 pattern) */}
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
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Nome / Apelido */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Apelido *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Conta Itaú"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Banco */}
              <FormField
                control={form.control}
                name="banco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Itaú"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Agência */}
              <FormField
                control={form.control}
                name="agencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agência</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0001"
                        className="bg-background border-border text-foreground font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conta */}
              <FormField
                control={form.control}
                name="conta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345-6"
                        className="bg-background border-border text-foreground font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Saldo Inicial — BRL mask */}
              <FormField
                control={form.control}
                name="saldoInicialStr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo Inicial</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        className="bg-background border-border text-foreground tabular-nums"
                        aria-label="Saldo inicial em reais"
                        {...field}
                        onBlur={(e) => {
                          handleSaldoBlur(e.target.value)
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
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Conta Corrente'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
