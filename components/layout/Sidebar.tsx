'use client'
// src/components/layout/Sidebar.tsx

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAppAuth } from '@/contexts/AuthContext'
import { useRdos, useResumoProjeto } from '@/hooks/useEmpresa'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useNovoRdo } from '@/components/rdos/NovoRdoModal'

type ItemNav = { href: string; icon: string; label: string; modal?: boolean }
const NAV: Array<{ group: string; items: ItemNav[] }> = [
  { group: 'Geral', items: [
    { href: '/painel',       icon: 'ti-layout-dashboard', label: 'Painel de Projetos' },
    { href: '/rdos',         icon: 'ti-list',             label: 'Lista de RDOs' },
    { href: '/rdos/novo',    icon: 'ti-file-plus',        label: 'Novo RDO', modal: true }, // abre a janela de Novo RDO, não uma página
  ]},
  { group: 'Projeto', items: [
    { href: '/rdos?status=PENDENTE_APROVACAO', icon: 'ti-writing',    label: 'Aprovação' },
    { href: '/tarefas',      icon: 'ti-list-check',       label: 'Lista de tarefas' },
    { href: '/relatorios',   icon: 'ti-chart-bar',        label: 'Relatórios' },
  ]},
  { group: 'Config.', items: [
    { href: '/notificacoes', icon: 'ti-bell',             label: 'Notificações' },
    { href: '/usuarios',     icon: 'ti-users',            label: 'Usuários' },
    { href: '/empresa',      icon: 'ti-building-skyscraper', label: 'Dados da empresa' },
  ]},
]

// Dentro da pasta de um projeto, o item "Painel de Projetos" ganha um submenu (que se recolhe)
// com as telas do projeto: Visão geral, Acesso e Assinaturas. Acesso e Assinaturas só aparecem
// para quem pode gerenciar o projeto.
const SUBITENS_PROJETO = [
  { path: '',             icon: 'ti-layout-dashboard', label: 'Visão geral',  soGerencia: false },
  { path: '/acesso',      icon: 'ti-users',            label: 'Acesso',       soGerencia: true  },
  { path: '/assinaturas', icon: 'ti-writing',          label: 'Assinaturas',  soGerencia: true  },
]

function SubmenuProjeto({ projetoId, aberto, onNavegar }: { projetoId: string; aberto: boolean; onNavegar: () => void }) {
  const pathname = usePathname()
  const { data: resumo } = useResumoProjeto(projetoId)
  if (!aberto) return null
  const base = `/projetos/${projetoId}`
  const podeGerenciar = !!resumo?.projeto.podeGerenciar
  return (
    <div className="sb-sub" aria-label="Telas do projeto">
      {resumo?.projeto.nome && <div className="sb-sub-nome" title={resumo.projeto.nome}>{resumo.projeto.nome}</div>}
      {SUBITENS_PROJETO.filter(i => !i.soGerencia || podeGerenciar).map(i => (
        <Link key={i.path} href={base + i.path} onClick={onNavegar} className={`ni ${pathname === base + i.path ? 'on' : ''}`}>
          <i className={`ti ${i.icon}`} />
          {i.label}
        </Link>
      ))}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session, logout } = useAppAuth()
  const { data: pendentes } = useRdos({ status: 'PENDENTE_APROVACAO' })
  const { abrirNovoRdo } = useNovoRdo()

  // Pasta de projeto aberta (/projetos/{id}, /projetos/{id}/acesso...) → submenu sob "Painel de Projetos"
  const projetoAtualId = pathname.match(/^\/projetos\/([^/]+)/)?.[1]
  const [submenuAberto, setSubmenuAberto] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem('sb-projeto-recolhido') === '1') setSubmenuAberto(false) } catch { /* sem storage: fica aberto */ }
  }, [])
  function alternarSubmenu() {
    setSubmenuAberto(a => {
      try { localStorage.setItem('sb-projeto-recolhido', a ? '1' : '0') } catch { /* ignora */ }
      return !a
    })
  }

  // Alguns itens compartilham o mesmo caminho mas com querys diferentes
  // (ex.: "Lista de RDOs" → /rdos, "Aprovação" → /rdos?status=...) — por isso
  // a comparação precisa considerar a query, não só o caminho, senão os dois
  // acendem juntos sempre que a URL começa com /rdos.
  const todosItens = NAV.flatMap(g => g.items)
  function isActive(href: string) {
    const [path, query] = href.split('?')
    if (path === '/painel') return pathname === '/painel'
    if (pathname !== path) return false
    if (query) return searchParams.toString() === query
    // Item sem query: só fica ativo se a URL atual não for a query específica de outro item do mesmo caminho
    return !todosItens.some(i => {
      if (i.href === href) return false
      const [p, q] = i.href.split('?')
      return p === path && q && searchParams.toString() === q
    })
  }

  const iniciais = session?.usuario.nome
    .split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'U'

  // Fecha a gaveta do menu no celular ao navegar — sem isso o menu ficava
  // aberto por cima da tela seguinte até a pessoa tocar fora dele de novo.
  function fecharMenuMobile() {
    const cb = document.getElementById('sb-toggle') as HTMLInputElement | null
    if (cb) cb.checked = false
  }

  return (
    <div className="sb">
      <div className="sb-logo">
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ta)', letterSpacing: '.5px' }}>
          DIÁRIO DO PROJETO
        </div>
        <div style={{ fontSize: 10, color: 'var(--ts)', marginTop: 2 }}>
          {session?.tenantNome}
        </div>
      </div>

      <nav className="sb-nav">
        {NAV.map(group => (
          <div key={group.group}>
            <span className="nl">{group.group}</span>
            {group.items.map(item => item.modal ? (
              <button key={item.href} type="button" className="ni" onClick={() => { fecharMenuMobile(); abrirNovoRdo() }}>
                <i className={`ti ${item.icon}`} />
                {item.label}
              </button>
            ) : (
              <Fragment key={item.href}>
                <div style={{ position: 'relative' }}>
                  <Link
                    href={item.href}
                    onClick={fecharMenuMobile}
                    className={`ni ${isActive(item.href) ? 'on' : ''}`}
                  >
                    <i className={`ti ${item.icon}`} />
                    {item.label}
                    {item.label === 'Aprovação' && !!pendentes?.total && (
                      <span className="nb">{pendentes.total}</span>
                    )}
                  </Link>
                  {item.href === '/painel' && projetoAtualId && (
                    <button type="button" className="sb-sub-toggle" onClick={alternarSubmenu}
                      aria-expanded={submenuAberto} aria-label={submenuAberto ? 'Recolher telas do projeto' : 'Mostrar telas do projeto'}>
                      <i className={`ti ${submenuAberto ? 'ti-chevron-down' : 'ti-chevron-right'}`} />
                    </button>
                  )}
                </div>
                {item.href === '/painel' && projetoAtualId && (
                  <SubmenuProjeto projetoId={projetoAtualId} aberto={submenuAberto} onNavegar={fecharMenuMobile} />
                )}
              </Fragment>
            ))}
          </div>
        ))}
        <span className="nl">Conta</span>
        <Link href="/perfil" onClick={fecharMenuMobile} className={`ni ${isActive('/perfil') ? 'on' : ''}`}>
          <i className="ti ti-user-circle" />
          Meu perfil
        </Link>
        <Link href="/ajuda" onClick={fecharMenuMobile} className={`ni ${isActive('/ajuda') ? 'on' : ''}`}>
          <i className="ti ti-help-circle" />
          Ajuda
        </Link>
        <button className="ni" onClick={logout}>
          <i className="ti ti-logout" />
          Sair
        </button>
      </nav>

      <div className="sb-user">
        <div className="av" style={{
          width: 26, height: 26, fontSize: 10,
          background: 'var(--bga)', color: 'var(--ta)',
        }}>
          {iniciais}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.usuario.nome}</div>
          <div style={{ fontSize: 10, color: 'var(--ts)' }}>
            {PERFIL_LABEL[session?.usuario.perfil ?? ''] ?? session?.usuario.perfil}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}

const PERFIL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador', PERSONALIZADO: 'Personalizado',
}
