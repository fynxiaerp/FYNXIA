'use client'

// ManualDrawDialog — baixa manual de estoque com confirmação destructive (D-19).
// Pattern: Dialog + RHF + zodResolver(stockDrawSchema) — mirrors StockEntryFormDialog.tsx.
// Aviso de irreversibilidade (Alert variant="destructive") + botão de submit
// variant="destructive" — T-17-17: repudiation mitigado pelo aviso explícito +
// createManualDraw grava logBusinessEvent (Plan 05).
// "children" wrapper: usado tanto como link auto-aberto (?produto=&acao=baixa vindo
// de ProductsTable, Plan 06) quanto potencialmente como trigger direto.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertTriangle } from 'lucide-react'

import { createManualDraw } from '@/actions/stock-draws'
import { stockDrawSchema, DRAW_MOTIVOS, type StockDrawInput } from '@/lib/validators/product'

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductOption = {
  id: string
  name: string
  category: 'insumo' | 'medicamento' | 'implante'
  unidade_medida: string
  custo_medio: number
  saldo: number
}

interface ManualDrawDialogProps {
  products: ProductOption[]
  unitId: string
  autoOpen?: boolean
  initialProductId?: string
  children: React.ReactNode
}

const MOTIVO_LABELS: Record<(typeof DRAW_MOTIVOS)[number], string> = {
  perda: 'Perda',
  quebra: 'Quebra',
  vencimento: 'Vencimento',
  ajuste_inventario: 'Ajuste de inventário',
}

function defaultValuesFor(initialProductId?: string): StockDrawInput {
  return {
    product_id: initialProductId ?? '',
    qtd: 0,
    motivo: 'ajuste_inventario',
    observacao: null,
  }
}

// ─── ManualDrawDialog ─────────────────────────────────────────────────────────

export function ManualDrawDialog({
  products,
  unitId,
  autoOpen,
  initialProductId,
  children,
}: ManualDrawDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen ?? false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<StockDrawInput>({
    resolver: zodResolver(stockDrawSchema),
    defaultValues: defaultValuesFor(initialProductId),
  })

  function handleOpen(value: boolean) {
    if (value) {
      form.reset(defaultValuesFor(initialProductId))
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: StockDrawInput) {
    setServerError(null)
    const result = await createManualDraw({ ...values, unit_id: unitId })

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao registrar baixa. Tente novamente.')
    }
  }

  const productId = form.watch('product_id')
  const selectedProduct = products.find((p) => p.id === productId)
  const motivoValue = form.watch('motivo')

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
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Confirmar Baixa Manual</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Aviso de irreversibilidade — Copywriting Contract */}
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Esta operação é irreversível. A baixa será registrada com trilha de auditoria.
                </AlertDescription>
              </Alert>

              {/* Produto — pré-selecionado quando vindo do contexto (dropdown do catálogo) */}
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto *</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione o produto">
                            {selectedProduct?.name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedProduct && (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: {selectedProduct.saldo} {selectedProduct.unidade_medida}
                </p>
              )}

              {/* Qtd */}
              <FormField
                control={form.control}
                name="qtd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Motivo */}
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo *</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione o motivo">
                            {MOTIVO_LABELS[motivoValue]}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DRAW_MOTIVOS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {MOTIVO_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observação (opcional) */}
              <FormField
                control={form.control}
                name="observacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações adicionais (opcional)"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Registrar Baixa
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
