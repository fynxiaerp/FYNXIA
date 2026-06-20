'use client'
// src/components/financeiro/CostCenterFormDialog.tsx
// FCAD-01: Create / edit cost_centers entry.
// Pattern: shadcn Dialog + RHF + zodResolver — mirrors UnitsManager.tsx.
// UI-SPEC §"Cost Center Form Dialog", §"Copywriting Contract", no .default() (D-133).
// T-14-16: units Select is populated only with tenant's own units (RLS-filtered from RSC).
// T-14-17: UI hides form when !canEdit; real gate is admin role + RLS in cost-centers.ts.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createCostCenter, updateCostCenter } from '@/actions/cost-centers'
import type { CostCenterRow } from '@/actions/cost-centers'

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitOption {
  id: string
  name: string
}

interface CostCenterFormDialogProps {
  mode: 'create' | 'edit'
  center?: CostCenterRow
  units: UnitOption[]
  trigger: React.ReactNode
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() — RHF defaultValues supply all values (D-133 pattern).

const costCenterFormSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  unitId: z.string().uuid('Unidade obrigatória'),
  ativo: z.boolean(),
})

type CostCenterFormValues = z.infer<typeof costCenterFormSchema>

// ─── Component ────────────────────────────────────────────────────────────────

export function CostCenterFormDialog({
  mode,
  center,
  units,
  trigger,
}: CostCenterFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CostCenterFormValues>({
    resolver: zodResolver(costCenterFormSchema),
    defaultValues: {
      name: center?.name ?? '',
      unitId: center?.unit_id ?? '',
      ativo: center?.ativo ?? true,
    },
  })

  function handleOpen(value: boolean) {
    if (value) {
      // Reset form to current center values (or blanks for create)
      form.reset({
        name: center?.name ?? '',
        unitId: center?.unit_id ?? '',
        ativo: center?.ativo ?? true,
      })
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: CostCenterFormValues) {
    setServerError(null)

    if (mode === 'edit' && center) {
      const result = await updateCostCenter({
        id: center.id,
        name: values.name,
        ativo: values.ativo,
      })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    } else {
      const result = await createCostCenter({
        name: values.name,
        unitId: values.unitId,
        ativo: values.ativo,
      })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    }
  }

  const title = mode === 'create' ? 'Novo Centro de Custo' : 'Editar Centro de Custo'

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

              {/* Nome */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Marketing"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unidade */}
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={mode === 'edit'} // unit is immutable in edit mode
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Ativo */}
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Centro de custo ativo"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Centro de custo ativo</FormLabel>
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
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Centro de Custo'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
