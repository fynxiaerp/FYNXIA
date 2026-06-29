'use client'
// src/components/financeiro/SupplierFormDialog.tsx
// Create / edit suppliers entry.
// Pattern: shadcn Dialog + RHF + zodResolver — mirrors CostCenterFormDialog.tsx.
// No .default() in Zod schema (D-133).
// T-ivj-01: UI canEdit is cosmetic; real gate is WRITER_ROLES in suppliers.ts.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createSupplier, updateSupplier } from '@/actions/suppliers'

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

export interface SupplierRow {
  id: string
  name: string
  tipo: string
  cnpj_cpf: string | null
  vinculo: string | null
  professional_id: string | null
  lab_id: string | null
  ativo: boolean | null
}

interface SupplierFormDialogProps {
  mode: 'create' | 'edit'
  supplier?: SupplierRow
  trigger: React.ReactNode
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() — RHF defaultValues supply all values (D-133 pattern).

const supplierFormSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),
  tipo: z.enum(['laboratorio', 'material', 'servico', 'autonomo', 'pj', 'outro']),
  cnpjCpf: z.string().max(20).optional().nullable(),
  pixKey: z.string().max(100).optional().nullable(),
  banco: z.string().max(100).optional().nullable(),
  agencia: z.string().max(20).optional().nullable(),
  conta: z.string().max(30).optional().nullable(),
  vinculo: z.enum(['clt', 'pj', 'autonomo']).optional().nullable(),
  ativo: z.boolean(),
})

type SupplierFormValues = z.infer<typeof supplierFormSchema>

// ─── Label maps ──────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  laboratorio: 'Laboratório',
  material: 'Material/Insumo',
  servico: 'Serviço',
  autonomo: 'Autônomo',
  pj: 'Pessoa Jurídica (PJ)',
  outro: 'Outro',
}

const VINCULO_LABELS: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  autonomo: 'Autônomo',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SupplierFormDialog({ mode, supplier, trigger }: SupplierFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      tipo: (supplier?.tipo as SupplierFormValues['tipo']) ?? undefined,
      cnpjCpf: supplier?.cnpj_cpf ?? null,
      pixKey: null,
      banco: null,
      agencia: null,
      conta: null,
      vinculo: (supplier?.vinculo as SupplierFormValues['vinculo']) ?? null,
      ativo: supplier?.ativo ?? true,
    },
  })

  function handleOpen(value: boolean) {
    if (value) {
      // Reset form to current supplier values (or blanks for create)
      form.reset({
        name: supplier?.name ?? '',
        tipo: (supplier?.tipo as SupplierFormValues['tipo']) ?? undefined,
        cnpjCpf: supplier?.cnpj_cpf ?? null,
        pixKey: null,
        banco: null,
        agencia: null,
        conta: null,
        vinculo: (supplier?.vinculo as SupplierFormValues['vinculo']) ?? null,
        ativo: supplier?.ativo ?? true,
      })
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: SupplierFormValues) {
    setServerError(null)

    // Map empty string vinculo to null
    const input = {
      name: values.name,
      tipo: values.tipo,
      cnpjCpf: values.cnpjCpf ?? null,
      pixKey: values.pixKey ?? null,
      banco: values.banco ?? null,
      agencia: values.agencia ?? null,
      conta: values.conta ?? null,
      vinculo: values.vinculo ?? null,
      ativo: values.ativo,
    }

    if (mode === 'edit' && supplier) {
      const result = await updateSupplier(supplier.id, input)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    } else {
      const result = await createSupplier(input)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
      }
    }
  }

  const title = mode === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'

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
        <DialogContent className="sm:max-w-lg bg-background text-foreground">
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
                        placeholder="Ex.: Laboratório Central"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TIPO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vínculo */}
              <FormField
                control={form.control}
                name="vinculo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vínculo</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === '' ? null : val)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione o vínculo (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {Object.entries(VINCULO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CNPJ/CPF */}
              <FormField
                control={form.control}
                name="cnpjCpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00.000.000/0000-00 ou 000.000.000-00"
                        className="bg-background border-border text-foreground"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PIX */}
              <FormField
                control={form.control}
                name="pixKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                        className="bg-background border-border text-foreground"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
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
                        placeholder="Ex.: Itaú, Bradesco, Nubank"
                        className="bg-background border-border text-foreground"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Agência + Conta side-by-side */}
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="agencia"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0000"
                          className="bg-background border-border text-foreground"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="conta"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Conta</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-0"
                          className="bg-background border-border text-foreground"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        aria-label="Fornecedor ativo"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Fornecedor ativo</FormLabel>
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
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Fornecedor'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
