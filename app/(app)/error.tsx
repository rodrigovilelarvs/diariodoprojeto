'use client'
// Boundary de erro das telas autenticadas. Se qualquer página do app quebrar
// ao renderizar, cai aqui em vez de mostrar tela branca — e o erro é
// registrado no backend pra a gente ficar sabendo antes do cliente reclamar.

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log no console do navegador
    console.error('[app error boundary]', error)
    // Envia pro backend (best-effort — não bloqueia nem quebra se falhar)
    try {
      fetch('/api/app/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: error.message,
          stack:    error.stack,
          digest:   error.digest,
          url:      typeof window !== 'undefined' ? window.location.href : undefined,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div className="sec" style={{ maxWidth: 440, width: '100%' }}>
        <div className="sec-h"><span className="sec-title">Algo deu errado nesta tela</span></div>
        <div className="sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5, margin: 0 }}>
            A tela não pôde ser carregada. Nossa equipe foi avisada automaticamente.
            Você pode tentar recarregar ou voltar ao painel.
          </p>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn btn-p" onClick={() => reset()}>
              <i className="ti ti-refresh" /> Tentar de novo
            </button>
            <button className="btn" onClick={() => { window.location.href = '/painel' }}>
              <i className="ti ti-arrow-left" /> Voltar ao painel
            </button>
          </div>
          {error.digest && (
            <span style={{ fontSize: 10, color: 'var(--tm)' }}>Código: {error.digest}</span>
          )}
        </div>
      </div>
    </div>
  )
}
