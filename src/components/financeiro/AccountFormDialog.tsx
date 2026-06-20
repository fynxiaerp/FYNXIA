'use client'
// src/components/financeiro/AccountFormDialog.tsx
// FCAD-01: Create / edit chart_of_accounts entry.
// Pattern: @base-ui/react Dialog + RHF + zodResolver — mirrors TransactionModal.tsx.
// UI-SPEC: sm:max-w-md, Copywriting Contract, Zod inline schema (no .default()).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createAccount, updateAccount } from '@/actions/chart-of-accounts'
import type { AccountNode } from '@/lib/financeiro/chart-tree'

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
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() — RHF defaultValues supply all values (D-133 pattern).

const accountFormSchema = z.object({
  code: z.string().max(20).optional().nullable(),
  name: z.string().min(1, 'Nome obrigatório').max(255),
  type: z.enum(['grupo', 'receita', 'despesa'], {
    errorMap: () => ({ message: 'Selecione o tipo de conta' }),
  }),
  parentId: z.string().uuid().optional().nullable(),
  ativo: z.boolean(),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

// ─── Flat account for parent selector ────────────────────────────────────────

export type AccountFlat = {
  id: string
  code: string
  name: string
  type: 'grupo' | 'receita' | 'despesa'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AccountFormDialogProps {
  mode: 'create' | 'edit'
  /** Existing account to edit (required when mode=edit) */
  account?: {
    id: string
    code: string
    name: string
    type: 'grupo' | 'receita' | 'despesa'
    ativo: boolean
    parent_id: string | null
  }
  /** Pre-set parent for "add child" action */
  parentId?: string | null
  /** Flattened list of all accounts (used for conta pai Select) */
  parents: AccountFlat[]
  /** Trigger element rendered inside DialogTrigger */
  trigger: React.ReactNode
}

// ─── AccountFormDialog ────────────────────────────────────────────────────────

export function AccountFormDialog({
  mode,
  account,
  parentId,
  parents,
  trigger,
}: AccountFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = mode === 'edit'
  const dialogTitle = isEdit ? 'Editar Conta Contábil' : 'Nova Conta Contábil'

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      code: isEdit ? (account?.code ?? '') : '',
      name: isEdit ? (account?.name ?? '') : '',
      type: isEdit ? (account?.type ?? 'grupo') : 'grupo',
      parentId: isEdit ? (account?.parent_id ?? null) : (parentId ?? null),
      ativo: isEdit ? (account?.ativo ?? true) : true,
    },
  })

  async function onSubmit(values: AccountFormValues) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      let result: { success: boolean; error?: string }

      if (isEdit && account) {
        result = await updateAccount({
          id: account.id,
          name: values.name,
          ativo: values.ativo,
          code: values.code ?? undefined,
        })
      } else {
        result = await createAccount({
          name: values.name,
          type: values.type,
          parentId: values.parentId ?? null,
          code: values.code ?? null,
          ativo: values.ativo,
        })
      }

      if (!result.success) {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
        return
      }

      setOpen(false)
      form.reset()
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset()
      setServerError(null)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* @base-ui/react DialogTrigger: children are the trigger content */}
      <div
        role="none"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="contents"
      >
        {trigger}
      </div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Código */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      className="font-mono"
                      placeholder="Ex: 1.1.1 (calculado automaticamente)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome da conta contábil" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo — disabled in edit mode (type is immutable) */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value)
                    }}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="grupo">Grupo</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conta Pai — hidden in edit mode (parent_id is immutable) */}
            {!isEdit && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Pai (opcional)</FormLabel>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(value) => {
                        field.onChange(value === 'none' ? null : value)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem conta pai (raiz)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem conta pai (raiz)</SelectItem>
                        {parents.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-mono text-muted-foreground mr-2">{p.code}</span>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Ativo Switch */}
            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="account-ativo"
                    />
                    <Label htmlFor="account-ativo">Conta ativa</Label>
                  </div>
                  {!field.value && (
                    <p className="text-sm text-muted-foreground">
                      Contas inativas ficam ocultas nos seletores de lançamento, mas lançamentos existentes são preservados.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Salvar Conta'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
