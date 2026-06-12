'use client'

// ErrorState — reusable error body for error.tsx route segments.
// Per 06-UI-SPEC lines 462-477: AlertTriangle icon + heading + body + retry button.
// T-06-07: never renders error.message to the user — static copy only.
// Accessibility: h2 is focused on mount so screen readers announce the error state.
import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ErrorStateProps {
  /** Next.js error.tsx reset callback */
  reset: () => void
}

export function ErrorState({ reset }: ErrorStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Focus heading on mount so screen readers announce the error state (06-UI-SPEC line 842)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold font-display outline-none"
      >
        Algo deu errado
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
