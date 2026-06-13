'use client'
// TEMP-DEBUG — global error boundary (catches errors in the root layout too).
// REMOVE after diagnosis.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'monospace', padding: 24 }}>
        <h1 style={{ color: '#c0392b', fontSize: 18 }}>DEBUG · global error</h1>
        <p style={{ fontSize: 13, color: '#666' }}>Copie o texto abaixo.</p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            border: '1px solid #ccc',
            padding: 16,
            fontSize: 12,
            marginTop: 16,
          }}
        >
          {`name: ${error?.name}\nmessage: ${error?.message}\ndigest: ${error?.digest ?? '(sem digest)'}\n\nstack:\n${error?.stack ?? '(sem stack)'}`}
        </pre>
        <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px' }}>
          Tentar novamente
        </button>
      </body>
    </html>
  )
}
