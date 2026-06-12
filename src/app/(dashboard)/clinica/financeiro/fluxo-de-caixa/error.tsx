'use client'

// error.tsx — /clinica/financeiro/fluxo-de-caixa
import { ErrorState } from '@/components/shell/ErrorState'

export default function FluxoDeCaixaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState reset={reset} />
    </main>
  )
}
