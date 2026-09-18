'use client'
// src/components/layout/Topbar.tsx

interface Props {
  titulo:    string
  subtitulo?: string
  acoes?:    React.ReactNode
}

export function Topbar({ titulo, subtitulo, acoes }: Props) {
  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <label htmlFor="sb-toggle" className="sb-hamburger" aria-label="Abrir menu">
          <i className="ti ti-menu-2" />
        </label>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
          {subtitulo && (
            <div style={{ fontSize: 11, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitulo}</div>
          )}
        </div>
      </div>
      {acoes && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {acoes}
        </div>
      )}
    </div>
  )
}
