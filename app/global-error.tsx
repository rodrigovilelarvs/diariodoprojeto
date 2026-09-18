'use client'
// Rede de segurança de último nível: pega erros que acontecem no próprio
// layout raiz (fora do alcance dos boundaries aninhados). Precisa renderizar
// a própria <html>/<body> e não pode depender de CSS externo.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
    try {
      fetch('/api/app/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: error.message,
          stack:    error.stack,
          digest:   error.digest,
          escopo:   'global',
          url:      typeof window !== 'undefined' ? window.location.href : undefined,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f1115', color: '#e5e7eb' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ocorreu um erro inesperado</h1>
            <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 20 }}>
              Recarregue a página. Se continuar, tente novamente em alguns minutos —
              o problema já foi registrado.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#29B6D8', color: '#04212b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Recarregar
            </button>
            {error.digest && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 14 }}>Código: {error.digest}</div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
