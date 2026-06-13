'use client'
// TEMP-DEBUG — raw error boundary for /clinica to surface the real crash message.
// For client-component errors, error.message is the REAL message on the client
// (server-side messages are redacted in prod, but the digest links to Vercel logs).
// REMOVE after diagnosis.
export default function ClinicaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-lg font-semibold text-destructive">
        DEBUG · erro em /clinica
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Instrumentação temporária. Copie o texto abaixo (ou tire um print).
      </p>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 text-xs">
        {`name: ${error?.name}\nmessage: ${error?.message}\ndigest: ${error?.digest ?? '(sem digest)'}\n\nstack:\n${error?.stack ?? '(sem stack)'}`}
      </pre>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  )
}
