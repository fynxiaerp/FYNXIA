'use client'
// src/components/config/UnitFormDialog.tsx
// Create / edit unit (filial) dialog.
// Pattern: shadcn Dialog + RHF + zodResolver — mirrors CostCenterFormDialog.tsx exactly.
// Reuses unitSchema from @/lib/validators/unit (no .default() — D-133).
// T-qji-01: defaultValues supply all values; schema has no .default() calls.
// T-qji-02: ativo Switch disabled for is_default unit in edit mode (cannot deactivate).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { createUnit, updateUnit } from '@/actions/units'
import type { UnitRow } from '@/actions/units'
import { unitSchema, UnitInput } from '@/lib/validators/unit'

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
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Props ────────────────────────────────────────────────────────────────────

interface UnitFormDialogProps {
  mode: 'create' | 'edit'
  unit?: UnitRow
  trigger: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UnitFormDialog({ mode, unit, trigger }: UnitFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: unit?.name ?? '',
      cnpj: unit?.cnpj ?? '',
      slug: unit?.slug ?? '',
      phone: unit?.phone ?? '',
      address: unit?.address ?? '',
      ativo: unit?.ativo ?? true,
    },
  })

  function handleOpen(value: boolean) {
    if (value) {
      // Reset to current unit values (or blanks for create) on every open
      form.reset({
        name: unit?.name ?? '',
        cnpj: unit?.cnpj ?? '',
        slug: unit?.slug ?? '',
        phone: unit?.phone ?? '',
        address: unit?.address ?? '',
        ativo: unit?.ativo ?? true,
      })
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: UnitInput) {
    setServerError(null)

    if (mode === 'edit' && unit) {
      const result = await updateUnit(unit.id, values)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    } else {
      const result = await createUnit(values)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    }
  }

  const title = mode === 'create' ? 'Nova Unidade' : 'Editar Unidade'

  return (
    <>
      {/* Trigger — wrapper div avoids nested button (mirrors CostCenterFormDialog pattern) */}
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

              {/* Nome */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Unidade Centro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slug */}
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="unidade-centro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CNPJ */}
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00.000.000/0001-00"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Telefone */}
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

              {/* Endereço */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rua, número, bairro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unidade ativa */}
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={mode === 'edit' && (unit?.is_default ?? false)}
                        aria-label="Unidade ativa"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Unidade ativa</FormLabel>
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
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Unidade'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
