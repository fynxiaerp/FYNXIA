'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBRL } from '@/lib/format/money'
import { computeIss, computeValorLiquido } from '@/lib/fiscal/iss'
import { emitirNfse } from '@/actions/nfse'

// Default ISS aliquota (5% = 0.05) shown when no OS selected
const DEFAULT_ALIQUOTA = 0.05
const DEFAULT_ISS_RETIDO = false

const schema = z.object({
  osId: z.string().uuid({ message: 'Selecione uma OS faturada' }),
})

type FormValues = z.infer<typeof schema>

export interface FaturadaOsOption {
  id: string
  numero: string
  total: number
  patient_maskedName: string | null
  aliquota?: number
  issRetido?: boolean
}

interface NfseEmitFormProps {
  faturadaOs: FaturadaOsOption[]
}

export function NfseEmitForm({ faturadaOs }: NfseEmitFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { osId: '' },
  })

  const osId = watch('osId')
  const selectedOs = faturadaOs.find((o) => o.id === osId)

  // ISS preview
  const valor = selectedOs?.total ?? 0
  const aliquota = selectedOs?.aliquota ?? DEFAULT_ALIQUOTA
  const issRetido = selectedOs?.issRetido ?? DEFAULT_ISS_RETIDO
  const valorIss = computeIss(valor, aliquota)
  const valorLiquido = computeValorLiquido(valor, valorIss, issRetido)

  async function onSubmit(data: FormValues) {
    setServerError(null)
    setSuccess(false)
    const res = await emitirNfse(data.osId, {})
    if (res.success) {
      setSuccess(true)
      setValue('osId', '')
      router.refresh()
    } else {
      setServerError(res.error ?? 'Não foi possível emitir a nota. Verifique a configuração fiscal da unidade e tente novamente.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {faturadaOs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma OS faturada disponível para emissão de NFS-e.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="emit-os-select">OS faturada</Label>
          <Select
            value={osId}
            onValueChange={(v) => v && setValue('osId', v)}
          >
            <SelectTrigger id="emit-os-select">
              <SelectValue placeholder="Selecione uma OS" />
            </SelectTrigger>
            <SelectContent>
              {faturadaOs.map((os) => (
                <SelectItem key={os.id} value={os.id}>
                  OS #{os.numero} — {os.patient_maskedName ?? 'Paciente'} — {formatBRL(os.total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.osId && (
            <p className="text-xs text-destructive">{errors.osId.message}</p>
          )}
        </div>
      )}

      {/* ISS calculation panel — EXACTLY per UI-SPEC lines 104-113 */}
      {selectedOs && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>ISS retido</span>
            <span className="tabular-nums">{formatBRL(valorIss)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Valor líquido</span>
            <span className="tabular-nums">{formatBRL(valorLiquido)}</span>
          </div>
        </div>
      )}

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      {success && (
        <p className="text-sm text-green-700">NFS-e enviada com sucesso!</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || !osId || faturadaOs.length === 0}
      >
        <FilePlus className="size-4" />
        {isSubmitting ? 'Emitindo…' : 'Emitir NFS-e'}
      </Button>
    </form>
  )
}
