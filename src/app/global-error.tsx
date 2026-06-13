'use client'
// Global error boundary — catches errors in the root layout. Graceful, no message leak.
// Must render its own <html>/<body> (it replaces the root layout when it fires).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
            Não foi possível carregar o aplicativo. Tente novamente.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
