'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { fecharLote } from '@/actions/tiss'

interface InsurerOption {
  id: string
  name: string
}

interface FecharLoteButtonProps {
  insurers: InsurerOption[]
}

export function FecharLoteButton({ insurers }: FecharLoteButtonProps) {
  const [pending, setPending] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  async function handleConfirm() {
    if (insurers.length === 0) return
    setPending(true)
    // Use first insurer as default target (UI can be extended with a select)
    const ins = insurers[0]!
    const competencia = new Date().toISOString().slice(0, 7) // YYYY-MM
    // fecharLote expects a loteId — for now pass insurerId as placeholder pending lote creation
    const res = await fecharLote(ins.id)
    setPending(false)
    if (res.success && res.protocolo) {
      setResult(`Protocolo: ${res.protocolo}`)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" disabled={insurers.length === 0} />}
      >
        Fechar lote
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fechar lote</AlertDialogTitle>
          <AlertDialogDescription>
            {result
              ? result
              : 'As guias do período serão agrupadas e enviadas para a operadora. Confirma?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          {!result && (
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              {pending ? 'Enviando…' : 'Fechar lote'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
