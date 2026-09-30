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
        // flexWrap sempre ligado: no desktop nunca precisa (os botões cabem
        // numa linha só), mas no celular evita que o grupo de ações de
        // páginas com vários botões saia cortado fora da tela.
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>
          {acoes}
        </div>
      )}
    </div>
  )
}
