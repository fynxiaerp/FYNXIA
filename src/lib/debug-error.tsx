// TEMP-DEBUG — surfaces the real server error message/stack in the browser,
// bypassing Next.js production sanitization (which hides messages, leaving only a digest).
// REMOVE after the /clinica 500 is diagnosed.
export function DebugError({ where, error }: { where: string; error: unknown }) {
  const e = error as { message?: string; stack?: string; name?: string }
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-lg font-semibold text-destructive">
        DEBUG · erro em [{where}]
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Instrumentação temporária para diagnosticar o 500. Copie o texto abaixo.
      </p>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 text-xs">
        {`${e?.name ?? 'Error'}: ${e?.message ?? String(error)}\n\n${e?.stack ?? '(sem stack)'}`}
      </pre>
    </div>
  )
}
