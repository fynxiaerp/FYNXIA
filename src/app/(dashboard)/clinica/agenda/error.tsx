'use client'

// error.tsx — /clinica/agenda
import { ErrorState } from '@/components/shell/ErrorState'

export default function AgendaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState reset={reset} />
    </main>
  )
}
