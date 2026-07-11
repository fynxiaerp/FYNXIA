'use client'

// ProductFormDialog — cadastro/edição de produto (EST-01).
// Pattern: Dialog + RHF + zodResolver(productSchema) — mirrors PayableFormDialog.tsx.
// "children" wrapper opens the dialog on click, so it can be used both as the page's
// primary CTA button AND as a DropdownMenuItem trigger inside ProductsTable ("Editar").
// productSchema reused verbatim from Plan 01 (no .default() — D-133).
// Campo condicional: numero_anvisa_produto obrigatório apenas quando category === 'implante'.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { createProduct, updateProduct } from '@/actions/products'
import {
  productSchema,
  PRODUCT_CATEGORIES,
  UNIDADES_MEDIDA,
  type ProductInput,
} from '@/lib/validators/product'

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
  sku: string | null
  category: string
  unidade_medida: string
  estoque_minimo: number
  estoque_maximo: number | null
  preferred_supplier_id: string | null
  numero_anvisa: string | null
}

type SupplierOption = { id: string; name: string }

interface ProductFormDialogProps {
  mode: 'create' | 'edit'
  product?: ProductOption
  suppliers: SupplierOption[]
  children: React.ReactNode
}

const CATEGORY_LABELS: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  insumo: 'Insumo',
  medicamento: 'Medicamento',
  implante: 'Implante',
}

const UNIDADE_LABELS: Record<(typeof UNIDADES_MEDIDA)[number], string> = {
  un: 'Unidade (un)',
  ml: 'Mililitro (ml)',
  g: 'Grama (g)',
  cx: 'Caixa (cx)',
  fr: 'Frasco (fr)',
}

function defaultValuesFor(product?: ProductOption): ProductInput {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? null,
    category: (product?.category as ProductInput['category']) ?? 'insumo',
    unidade_medida: (product?.unidade_medida as ProductInput['unidade_medida']) ?? 'un',
    estoque_minimo: product?.estoque_minimo ?? 0,
    estoque_maximo: product?.estoque_maximo ?? null,
    preferred_supplier_id: product?.preferred_supplier_id ?? null,
    numero_anvisa_produto: product?.numero_anvisa ?? null,
  }
}

// ─── ProductFormDialog ────────────────────────────────────────────────────────

export function ProductFormDialog({ mode, product, suppliers, children }: ProductFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValuesFor(product),
  })

  function handleOpen(value: boolean) {
    if (value) {
      form.reset(defaultValuesFor(product))
      setServerError(null)
    }
    setOpen(value)
  }

  async function onSubmit(values: ProductInput) {
    setServerError(null)

    const result =
      mode === 'create'
        ? await createProduct(values)
        : await updateProduct(product!.id, values)

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const category = form.watch('category')
  const isImplante = category === 'implante'
  const title = mode === 'create' ? 'Cadastrar Produto' : 'Editar Produto'
  const submitLabel = mode === 'create' ? 'Salvar Produto' : 'Atualizar Produto'

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
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
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
                      <Input placeholder="Ex.: Anestésico Articaína 4%" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SKU (opcional) */}
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Código interno (opcional)"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Categoria */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione a categoria">
                            {CATEGORY_LABELS[field.value]}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo condicional: Número ANVISA (obrigatório apenas para implante) */}
              {isImplante && (
                <FormField
                  control={form.control}
                  name="numero_anvisa_produto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número ANVISA *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Registro ANVISA do produto"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : e.target.value)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Unidade de Medida */}
              <FormField
                control={form.control}
                name="unidade_medida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade de Medida *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione a unidade">
                            {UNIDADE_LABELS[field.value]}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIDADES_MEDIDA.map((u) => (
                          <SelectItem key={u} value={u}>
                            {UNIDADE_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estoque Mínimo */}
              <FormField
                control={form.control}
                name="estoque_minimo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estoque Máximo (opcional) */}
              <FormField
                control={form.control}
                name="estoque_maximo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Máximo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        placeholder="Opcional — usado pelo agente de reposição"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fornecedor Preferido (opcional) */}
              <FormField
                control={form.control}
                name="preferred_supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor Preferido</FormLabel>
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

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
