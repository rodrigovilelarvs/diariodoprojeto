'use client'
// src/components/layout/ThemeToggle.tsx
// Botão para alternar entre tema escuro (padrão) e tema claro.

import { useEffect, useState } from 'react'
import { aplicarTema, lerTemaSalvo, type Tema } from '@/lib/theme'

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>('dark')

  useEffect(() => {
    setTema(lerTemaSalvo())
  }, [])

  function alternar() {
    const proximo: Tema = tema === 'dark' ? 'light' : 'dark'
    setTema(proximo)
    aplicarTema(proximo)
  }

  return (
    <button
      onClick={alternar}
      title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
        flexShrink: 0, marginLeft: 'auto', borderRadius: 7, border: '.5px solid var(--bs)',
        background: 'var(--s2)', color: 'var(--ts)', cursor: 'pointer', transition: 'all .15s',
      }}
    >
      <i className={`ti ${tema === 'dark' ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: 14 }} />
    </button>
  )
}
