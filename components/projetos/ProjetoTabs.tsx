'use client'
// components/projetos/ProjetoTabs.tsx
// Navegação em abas entre Visão geral / Acesso / Assinaturas de um projeto
// Só renderizada quando o usuário pode gerenciar o projeto (Gerenciamento total ou admin/gestor)

import { useRouter } from 'next/navigation'

interface Props {
  projetoId: string
  ativo: 'geral' | 'acesso' | 'assinaturas'
}

const ABAS = [
  { key: 'geral'       as const, label: 'Visão geral', icon: 'ti-layout-dashboard', path: '' },
  { key: 'acesso'      as const, label: 'Acesso',       icon: 'ti-users',           path: '/acesso' },
  { key: 'assinaturas' as const, label: 'Assinaturas',  icon: 'ti-writing',         path: '/assinaturas' },
]

export function ProjetoTabs({ projetoId, ativo }: Props) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {ABAS.map(a => (
        <button
          key={a.key}
          onClick={() => router.push(`/projetos/${projetoId}${a.path}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 'var(--r)', border: '.5px solid var(--bs)',
            background: ativo === a.key ? 'var(--ta)' : 'var(--s1)',
            color: ativo === a.key ? 'var(--oa)' : 'var(--ts)',
            fontSize: 12, fontWeight: ativo === a.key ? 600 : 400,
            fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
          }}
        >
          <i className={`ti ${a.icon}`} style={{ fontSize: 13 }} /> {a.label}
        </button>
      ))}
    </div>
  )
}
