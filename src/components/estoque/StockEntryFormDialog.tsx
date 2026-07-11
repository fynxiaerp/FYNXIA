'use client'

// StockEntryFormDialog — registro de entrada de estoque (D-10).
// Pattern: Dialog + RHF + zodResolver(stockEntrySchema) — mirrors PayableFormDialog.tsx /
// ProductFormDialog.tsx. "children" wrapper opens the dialog on click, so it works both
// as the page's primary CTA ("Registrar Entrada") and as an auto-opened dialog when the
// page is reached via ?produto={id} (ProductsTable dropdown — Plan 06).
//
// categoria_produto é derivado do produto selecionado e alimenta a validação condicional
// de stockEntrySchema.superRefine (implante/medicamento exigem data_validade; implante
// exige numero_anvisa_lote).
//
// Custo Unitário usa máscara BRL no blur (mirrors TransactionModal.amountStr) — o campo
// RHF real (`custo_unitario`) permanece number (schema não muda); a exibição formatada
// vive em estado local separado (T-17-18: mitigação de custo mal formatado via number
// coerto no submit, nunca uma string livre chega ao Server Action).
//
// "Novo custo médio" é uma prévia calculada no cliente com a mesma fórmula do Server
// Action (calcularCustoMedioMovel, D-02) usando o saldo/custo do produto no momento em
// que a página carregou — suficiente para o informativo pós-submit (UI-SPEC).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { createStockEntry } from '@/actions/stock-entries'
import { calcularCustoMedioMovel } from '@/lib/stock/custo-medio'
import { formatBRL } from '@/lib/format/money'
import { stockEntrySchema, type StockEntryInput } from '@/lib/validators/product'

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductOption = {
  id: string
  name: string
  category: 'insumo' | 'medicamento' | 'implante'
  unidade_medida: string
  custo_medio: number
  saldo: number
}

type SupplierOption = { id: string; name: string }

interface StockEntryFormDialogProps {
  products: ProductOption[]
  suppliers: SupplierOption[]
  unitId: string
  autoOpen?: boolean
  initialProductId?: string
  children: React.ReactNode
}

function defaultValuesFor(initialProductId: string | undefined, products: ProductOption[]): StockEntryInput {
  const initial = products.find((p) => p.id === initialProductId)
  return {
    product_id: initial?.id ?? '',
    categoria_produto: initial?.category ?? 'insumo',
    supplier_id: null,
    numero_lote: '',
    data_validade: null,
    qtd: 0,
    custo_unitario: 0,
    nota_fiscal: null,
    numero_anvisa_lote: null,
  }
}

// ─── StockEntryFormDialog ─────────────────────────────────────────────────────

export function StockEntryFormDialog({
  products,
  suppliers,
  unitId,
  autoOpen,
  initialProductId,
  children,
}: StockEntryFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen ?? false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [custoUnitarioDisplay, setCustoUnitarioDisplay] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ novoCustoMedio: number } | null>(null)

  const form = useForm<StockEntryInput>({
    resolver: zodResolver(stockEntrySchema),
    defaultValues: defaultValuesFor(initialProductId, products),
  })

  function resetAll() {
    form.reset(defaultValuesFor(initialProductId, products))
    setCustoUnitarioDisplay('')
    setServerError(null)
    setSuccessInfo(null)
  }

  function handleOpen(value: boolean) {
    if (value) resetAll()
    setOpen(value)
  }

  function handleClose() {
    setOpen(false)
    resetAll()
    router.refresh()
  }

  const productId = form.watch('product_id')
  const selectedProduct = products.find((p) => p.id === productId)
  const categoriaProduto = form.watch('categoria_produto')
  const isImplante = categoriaProduto === 'implante'
  const requiresValidade = isImplante || categoriaProduto === 'medicamento'

  function handleProductChange(value: string | null) {
    if (!value) return
    form.setValue('product_id', value, { shouldValidate: true })
    const product = products.find((p) => p.id === value)
    if (product) {
      form.setValue('categoria_produto', product.category, { shouldValidate: true })
    }
  }

  function handleCustoBlur() {
    const digits = custoUnitarioDisplay.replace(/[^\d]/g, '')
    const num = digits ? parseInt(digits, 10) / 100 : 0
    form.setValue('custo_unitario', num, { shouldValidate: true })
    setCustoUnitarioDisplay(num > 0 ? formatBRL(num) : '')
  }

  async function onSubmit(values: StockEntryInput) {
    setServerError(null)
    const result = await createStockEntry({ ...values, unit_id: unitId })

    if (!result.success) {
      setServerError(result.error ?? 'Erro ao registrar entrada. Tente novamente.')
      return
    }

    // Preview do novo custo médio (D-02) — mesma fórmula do Server Action
    const saldoAtual = selectedProduct?.saldo ?? 0
    const custoAnterior = selectedProduct?.custo_medio ?? 0
    const novoCustoMedio = calcularCustoMedioMovel(saldoAtual, custoAnterior, values.qtd, values.custo_unitario)
    setSuccessInfo({ novoCustoMedio })
  }

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
            <DialogTitle>Registrar Entrada</DialogTitle>
          </DialogHeader>

          {successInfo ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Entrada registrada com sucesso. Novo custo médio: {formatBRL(successInfo.novoCustoMedio)}
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="button" onClick={handleClose}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
              >
                {serverError && (
                  <Alert variant="destructive">
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                )}

                {/* Produto */}
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto *</FormLabel>
                      <Select onValueChange={handleProductChange} value={field.value}>
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

                {/* Informativo: custo médio atual (UI-SPEC — exibido após escolha do produto) */}
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Custo médio atual: {formatBRL(selectedProduct.custo_medio)}
                  </p>
                )}

                {/* Fornecedor (opcional) */}
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        value={field.value ?? 'none'}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full bg-background border-border">
                            <SelectValue placeholder="Nenhum fornecedor">
                              {field.value
                                ? (suppliers.find((s) => s.id === field.value)?.name ?? 'Nenhum fornecedor')
                                : 'Nenhum fornecedor'}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum fornecedor</SelectItem>
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

                {/* Número de Lote */}
                <FormField
                  control={form.control}
                  name="numero_lote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Lote *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: L2026-0731" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número ANVISA (condicional — obrigatório apenas para implante) */}
                {isImplante && (
                  <FormField
                    control={form.control}
                    name="numero_anvisa_lote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número ANVISA *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Registro ANVISA do lote"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Data de Validade (obrigatória para implante/medicamento — D-03) */}
                <FormField
                  control={form.control}
                  name="data_validade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Validade{requiresValidade ? ' *' : ''}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Qtd Recebida */}
                <FormField
                  control={form.control}
                  name="qtd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade Recebida *</FormLabel>
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

                {/* Custo Unitário — máscara BRL no blur (mirrors TransactionModal.amountStr) */}
                <FormField
                  control={form.control}
                  name="custo_unitario"
                  render={() => (
                    <FormItem>
                      <FormLabel>Custo Unitário *</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="R$ 0,00"
                          value={custoUnitarioDisplay}
                          onChange={(e) => setCustoUnitarioDisplay(e.target.value)}
                          onBlur={handleCustoBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nota Fiscal (opcional) */}
                <FormField
                  control={form.control}
                  name="nota_fiscal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nota Fiscal</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Número da NF (opcional)"
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
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Registrar Entrada
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
