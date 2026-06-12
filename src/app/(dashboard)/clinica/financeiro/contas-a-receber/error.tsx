'use client'

// error.tsx — /clinica/financeiro/contas-a-receber
import { ErrorState } from '@/components/shell/ErrorState'

export default function ContasAReceberError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState reset={reset} />
    </main>
  )
}
