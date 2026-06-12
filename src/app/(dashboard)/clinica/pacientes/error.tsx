'use client'

// error.tsx — /clinica/pacientes
// 3-line wrapper around the reusable ErrorState primitive.
import { ErrorState } from '@/components/shell/ErrorState'

export default function PacientesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState reset={reset} />
    </main>
  )
}
