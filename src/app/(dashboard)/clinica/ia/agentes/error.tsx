'use client'

// error.tsx — /clinica/ia/agentes
import { ErrorState } from '@/components/shell/ErrorState'

export default function AgentesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState reset={reset} />
    </main>
  )
}
