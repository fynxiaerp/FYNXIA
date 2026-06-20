'use client'
// src/app/(dashboard)/clinica/financeiro/contas-correntes/error.tsx
// UI-SPEC §"Error States" — standard error.tsx pattern.

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ContasCorrentesError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold font-display">Algo deu errado</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
