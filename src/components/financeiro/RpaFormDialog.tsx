'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatBRL } from '@/lib/format/money'
import { gerarRpa } from '@/actions/rpa'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierOption {
  id: string
  name: string
  iss_retido_fonte?: boolean
}

interface RpaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: SupplierOption[]
  unitId?: string
  defaultSupplierId?: string
  defaultCompetencia?: string
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// No .default() in Zod (D-133 pattern — RHF defaultValues provide the values).

const rpaFormSchema = z.object({
  supplierId: z.string({ required_error: 'Selecione o autônomo' }).min(1, 'Selecione o autônomo'),
  competencia: z.string({ required_error: 'Informe a competência' }).regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  dataPagamento: z.date({ required_error: 'Selecione a data de pagamento' }),
  valorBrutoStr: z.string({ required_error: 'Informe o valor bruto' }).min(1, 'Informe o valor bruto'),
  modalidadeInss: z.enum(['11pct', 'progressiva']),
  issOverrideEnabled: z.boolean(),
  issOverridePct: z.string(),
})

type RpaFormValues = z.infer<typeof rpaFormSchema>

// ─── Client-side Estimativa preview ──────────────────────────────────────────
// Mirrors computeRpaWithholdings logic for display only.
// Server recalculates authoritative values on emit (T-16-52).

function computePreview(
  valorBruto: number,
  modalidade: '11pct' | 'progressiva',
): { inss: number; irrf: number; iss: number; liquido: number } {
  // INSS: 11% flat (teto simplified — full bracket on server)
  const inss = modalidade === '11pct' ? Math.min(valorBruto * 0.11, 908.86) : valorBruto * 0.11

  // IRRF base = bruto − INSS (Pitfall 4)
  const baseIrrf = valorBruto - inss
  // Simplified progressive table (2025 reference)
  let irrf = 0
  if (baseIrrf > 4664.68) {
    irrf = baseIrrf * 0.275 - 869.36
  } else if (baseIrrf > 3751.05) {
    irrf = baseIrrf * 0.225 - 636.13
  } else if (baseIrrf > 2826.65) {
    irrf = baseIrrf * 0.15 - 354.8
  } else if (baseIrrf > 2259.2) {
    irrf = baseIrrf * 0.075 - 169.44
  }
  if (irrf < 0) irrf = 0

  const iss = 0 // ISS override handled separately
  const liquido = valorBruto - inss - irrf - iss

  return {
    inss: Math.round(inss * 100) / 100,
    irrf: Math.round(irrf * 100) / 100,
    iss,
    liquido: Math.round(liquido * 100) / 100,
  }
}

function parseBRL(str: string): number {
  const clean = str.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

function handleAmountBlur(
  e: React.FocusEvent<HTMLInputElement>,
  onChange: (v: string) => void,
) {
  const raw = e.target.value.replace(/[^\d,]/g, '').replace(',', '.')
  const num = parseFloat(raw) || 0
  onChange(formatBRL(num))
}

// ─── RpaFormDialog ────────────────────────────────────────────────────────────

export function RpaFormDialog({
  open,
  onOpenChange,
  suppliers,
  unitId,
  defaultSupplierId,
  defaultCompetencia,
}: RpaFormDialogProps) {
  const router = useRouter()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RpaFormValues>({
    resolver: zodResolver(rpaFormSchema),
    defaultValues: {
      supplierId: defaultSupplierId ?? '',
      competencia: defaultCompetencia ?? new Date().toISOString().slice(0, 7),
      valorBrutoStr: '',
      modalidadeInss: '11pct',
      issOverrideEnabled: false,
      issOverridePct: '',
    },
  })

  const valorBrutoStr = watch('valorBrutoStr')
  const modalidadeInss = watch('modalidadeInss')
  const issOverrideEnabled = watch('issOverrideEnabled')
  const issOverridePct = watch('issOverridePct')

  // Client-side Estimativa (D-17 / T-16-52: labeled as Estimativa)
  const valorBruto = parseBRL(valorBrutoStr)
  const preview = React.useMemo(
    () => computePreview(valorBruto, modalidadeInss),
    [valorBruto, modalidadeInss],
  )
  const issPreview =
    issOverrideEnabled && issOverridePct
      ? Math.round(valorBruto * (parseFloat(issOverridePct) / 100) * 100) / 100
      : 0
  const liquidoTotal = preview.liquido - issPreview

  async function onSubmit(data: RpaFormValues) {
    setServerError(null)
    setSuccessMsg(null)
    const rawInput = {
      supplierId: data.supplierId,
      competencia: data.competencia,
      dataPagamento: format(data.dataPagamento, 'yyyy-MM-dd'),
      valorBruto: parseBRL(data.valorBrutoStr),
      modalidadeInss: data.modalidadeInss,
      issOverride: data.issOverrideEnabled && data.issOverridePct
        ? parseFloat(data.issOverridePct) / 100
        : undefined,
      unitId,
    }
    const res = await gerarRpa(rawInput)
    if (res.success && res.numero) {
      setSuccessMsg(`${res.numero} emitido. PDF disponível em Documentos.`)
      router.refresh()
      setTimeout(() => {
        onOpenChange(false)
        setSuccessMsg(null)
      }, 2000)
    } else {
      setServerError(res.error ?? 'Não foi possível emitir o RPA. Tente novamente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Emitir RPA</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Autônomo */}
          <div className="space-y-1.5">
            <Label htmlFor="rpa-supplier">Autônomo</Label>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger id="rpa-supplier">
                    <SelectValue placeholder="Selecione o autônomo" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplierId && (
              <p className="text-xs text-destructive">{errors.supplierId.message}</p>
            )}
          </div>

          {/* Competência */}
          <div className="space-y-1.5">
            <Label htmlFor="rpa-competencia">Competência</Label>
            <Input
              id="rpa-competencia"
              type="month"
              {...register('competencia')}
            />
            {errors.competencia && (
              <p className="text-xs text-destructive">{errors.competencia.message}</p>
            )}
          </div>

          {/* Data de Pagamento */}
          <div className="space-y-1.5">
            <Label>Data de Pagamento</Label>
            <Controller
              name="dataPagamento"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
                    {field.value
                      ? format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione a data'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => d && field.onChange(d)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.dataPagamento && (
              <p className="text-xs text-destructive">{errors.dataPagamento.message}</p>
            )}
          </div>

          {/* Valor Bruto */}
          <div className="space-y-1.5">
            <Label htmlFor="rpa-valor">Valor Bruto</Label>
            <Controller
              name="valorBrutoStr"
              control={control}
              render={({ field }) => (
                <Input
                  id="rpa-valor"
                  placeholder="R$ 0,00"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={(e) => handleAmountBlur(e, field.onChange)}
                />
              )}
            />
            {errors.valorBrutoStr && (
              <p className="text-xs text-destructive">{errors.valorBrutoStr.message}</p>
            )}
          </div>

          {/* Modalidade INSS */}
          <div className="space-y-1.5">
            <Label>Modalidade INSS</Label>
            <Controller
              name="modalidadeInss"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="11pct">11% Flat (Prestador a Empresa)</SelectItem>
                    <SelectItem value="progressiva">Progressiva</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* ISS Override */}
          <div className="flex items-center gap-3">
            <Controller
              name="issOverrideEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="iss-override"
                />
              )}
            />
            <Label htmlFor="iss-override">ISS retido na fonte</Label>
            {issOverrideEnabled && (
              <Input
                className="w-24"
                placeholder="2.0"
                {...register('issOverridePct')}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value) || 0
                  setValue('issOverridePct', v.toFixed(2))
                }}
              />
            )}
            {issOverrideEnabled && <span className="text-sm text-muted-foreground">%</span>}
          </div>

          {/* Estimativa preview */}
          {valorBruto > 0 && (
            <div className="rounded-lg border border-border bg-muted p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Estimativa — valores definitivos calculados no servidor ao emitir.
              </p>
              <div className="flex justify-between">
                <span>Valor Bruto</span>
                <span className="tabular-nums">{formatBRL(valorBruto)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>(−) INSS ({modalidadeInss === '11pct' ? '11%' : 'Progressivo'})</span>
                <span className="tabular-nums">{formatBRL(preview.inss)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>(−) IRRF</span>
                <span className="tabular-nums">
                  {preview.irrf > 0 ? formatBRL(preview.irrf) : 'Isento'}
                </span>
              </div>
              {issOverrideEnabled && (
                <div className="flex justify-between text-muted-foreground">
                  <span>(−) ISS ({issOverridePct || '0'}%)</span>
                  <span className="tabular-nums">{formatBRL(issPreview)}</span>
                </div>
              )}
              {!issOverrideEnabled && (
                <div className="flex justify-between text-muted-foreground">
                  <span>(−) ISS</span>
                  <span className="tabular-nums">N/A</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>= Valor Líquido</span>
                <span className="tabular-nums">{formatBRL(liquidoTotal)}</span>
              </div>
            </div>
          )}

          {/* Inline note */}
          <p className="text-xs text-muted-foreground">
            Após emissão, o RPA não pode ser editado. As retenções serão lançadas como Contas a
            Pagar para recolhimento.
          </p>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert>
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Emitindo...' : 'Emitir RPA'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
