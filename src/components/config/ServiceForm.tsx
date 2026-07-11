'use client'

// ServiceForm — cadastro/edição de serviço + aba "Materiais" (D-21).
// Pattern: Dialog + Tabs + RHF + zodResolver(serviceSchema) — mirrors UnitFormDialog.tsx /
// ProductFormDialog.tsx trigger-wrapper convention (works both as page CTA and per-row
// "Editar" trigger).
//
// Aba "Dados": campos essenciais do serviço (nome, código, descrição, valor, ativo).
// Aba "Materiais": MaterialsTemplateTab habilitada apenas em modo edição (serviço já
// tem id). Em modo create, exibe aviso "Salve o serviço primeiro para configurar
// materiais." — templates de consumo exigem service_id existente (FK NOT NULL).
//
// Valor Particular usa máscara BRL no blur (mirrors StockEntryFormDialog.custo_unitario /
// TransactionModal.amountStr) — campo RHF real permanece number.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { createService, updateService } from '@/actions/services'
import { serviceSchema, type ServiceInput } from '@/lib/validators/service'
import { formatBRL } from '@/lib/format/money'
import { MaterialsTemplateTab } from '@/components/estoque/MaterialsTemplateTab'

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceRow = {
  id: string
  name: string
  code: string | null
  tuss_code: string | null
  description: string | null
  valor_particular: number
  account_id: string | null
  aliquota_iss_override: number | null
  item_lista_servico_override: string | null
  ativo: boolean
}

interface ServiceFormProps {
  mode: 'create' | 'edit'
  service?: ServiceRow
  trigger: React.ReactNode
}

function defaultValuesFor(service?: ServiceRow): ServiceInput {
  return {
    name: service?.name ?? '',
    code: service?.code ?? '',
    tussCode: service?.tuss_code ?? '',
    description: service?.description ?? '',
    valorParticular: service?.valor_particular ?? 0,
    accountId: service?.account_id ?? null,
    aliquotaIssOverride: service?.aliquota_iss_override ?? null,
    itemListaServicoOverride: service?.item_lista_servico_override ?? null,
    ativo: service?.ativo ?? true,
  }
}

// ─── ServiceForm ──────────────────────────────────────────────────────────────

export function ServiceForm({ mode, service, trigger }: ServiceFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [valorDisplay, setValorDisplay] = useState('')

  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaultValuesFor(service),
  })

  function handleOpen(value: boolean) {
    if (value) {
      form.reset(defaultValuesFor(service))
      const v = service?.valor_particular ?? 0
      setValorDisplay(v > 0 ? formatBRL(v) : '')
      setServerError(null)
    }
    setOpen(value)
  }

  function handleValorBlur() {
    const digits = valorDisplay.replace(/[^\d]/g, '')
    const num = digits ? parseInt(digits, 10) / 100 : 0
    form.setValue('valorParticular', num, { shouldValidate: true })
    setValorDisplay(num > 0 ? formatBRL(num) : '')
  }

  async function onSubmit(values: ServiceInput) {
    setServerError(null)

    const result =
      mode === 'create' ? await createService(values) : await updateService(service!.id, values)

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const title = mode === 'create' ? 'Novo Serviço' : 'Editar Serviço'
  const submitLabel = mode === 'create' ? 'Salvar Serviço' : 'Atualizar Serviço'
  const hasId = mode === 'edit' && !!service?.id

  return (
    <>
      {/* Trigger — wrapper div avoids nested button (mirrors UnitFormDialog pattern) */}
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

          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="materiais">Materiais</TabsTrigger>
            </TabsList>

            {/* ── Aba Dados ─────────────────────────────────────────────────── */}
            <TabsContent value="dados">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 pt-2"
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
                          <Input placeholder="Ex.: Restauração em Resina Composta" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Código (opcional) */}
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="Código interno (opcional)" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descrição (opcional) */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição do serviço (opcional)"
                            rows={3}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Valor Particular — máscara BRL no blur */}
                  <FormField
                    control={form.control}
                    name="valorParticular"
                    render={() => (
                      <FormItem>
                        <FormLabel>Valor Particular *</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            placeholder="R$ 0,00"
                            value={valorDisplay}
                            onChange={(e) => setValorDisplay(e.target.value)}
                            onBlur={handleValorBlur}
                          />
                        </FormControl>
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
                            aria-label="Serviço ativo"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Serviço ativo</FormLabel>
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
            </TabsContent>

            {/* ── Aba Materiais (D-21) ──────────────────────────────────────── */}
            <TabsContent value="materiais">
              {hasId ? (
                <MaterialsTemplateTab serviceId={service!.id} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Salve o serviço primeiro para configurar materiais.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
