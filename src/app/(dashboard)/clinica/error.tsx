'use client'
// Error boundary for the /clinica segment — graceful fallback (no raw crash, no message leak).
import { ErrorState } from '@/components/shell/ErrorState'

export default function ClinicaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} />
}
