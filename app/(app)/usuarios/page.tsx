'use client'
// src/app/usuarios/page.tsx

import { useState } from 'react'
import {
  useUsuarios, useConvidarUsuario, useAtualizarUsuario, useCancelarConvite,
  useUsuarioAcessos, useDefinirAcessoUsuario, useRemoverAcessoUsuario,
  useNotificacoesUsuario, useAtualizarNotificacoesUsuario,
} from '@/hooks/useEmpresa'
import { GRUPOS_NOTIFICACAO } from '@/lib/notificacao-eventos'
import { useAppAuth } from '@/contexts/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Badge, Modal, Field, Input, Select, Btn, Skeleton } from '@/components/ui'
import { toast } from 'sonner'
import type { Usuario, UsuarioPerfil, ProjetoAcessoNivel } from '@/lib/types'

const NIVEL_L: Record<ProjetoAcessoNivel, string> = {
  VISUALIZAR: 'Visualizar', EDITAR: 'Editar', GERENCIAMENTO: 'Gerenciamento total',
}

const PERFIL_L: Record<string, string> = {
  ADMIN: 'Administrador', PERSONALIZADO: 'Personalizado',
}
const PERFIL_V: Record<string, string> = {
  ADMIN: 'blue', PERSONALIZADO: 'gray',
}

interface PermissoesForm {
  permEmitirRdo:         boolean
  permAprovarRdo:        boolean
  permGerenciarProjetos: boolean
  permGerenciarEquipe:   boolean
  permVerRelatorios:     boolean
  permGerenciarTarefas:  boolean
}
const PERM_VAZIO: PermissoesForm = {
  permEmitirRdo: false, permAprovarRdo: false,
  permGerenciarProjetos: false, permGerenciarEquipe: false, permVerRelatorios: false,
  permGerenciarTarefas: false,
}
const PERM_ITENS: Array<{ key: keyof PermissoesForm; label: string; desc: string }> = [
  { key: 'permVerRelatorios',     label: 'Ver relatórios',     desc: 'Acessar a tela de Relatórios' },
  { key: 'permEmitirRdo',         label: 'Emitir RDOs',        desc: 'Criar e editar Registros Diários de Obra' },
  { key: 'permGerenciarTarefas',  label: 'Gerenciar tarefas',  desc: 'Criar, editar e excluir itens da lista de tarefas (EAP)' },
  { key: 'permAprovarRdo',        label: 'Aprovar RDOs',       desc: 'Aprovar ou rejeitar RDOs enviados' },
  { key: 'permGerenciarProjetos', label: 'Gerenciar projetos', desc: 'Criar/editar projetos e ver todos (sem isso, só os projetos liberados)' },
  { key: 'permGerenciarEquipe',   label: 'Gerenciar equipe',   desc: 'Convidar, remover e editar usuários' },
]

function perfilDoUsuario(u: any): PermissoesForm {
  return {
    permEmitirRdo:         !!u.permEmitirRdo,
    permAprovarRdo:        !!u.permAprovarRdo,
    permGerenciarProjetos: !!u.permGerenciarProjetos,
    permGerenciarEquipe:   !!u.permGerenciarEquipe,
    permVerRelatorios:     !!u.permVerRelatorios,
    permGerenciarTarefas:  !!u.permGerenciarTarefas,
  }
}

// Toggle Administrador/Personalizado + checklist de permissões — reaproveitado
// no convite e na edição.
function PerfilCampos({ perfil, setPerfil, perms, setPerms }: {
  perfil:   UsuarioPerfil
  setPerfil: (p: UsuarioPerfil) => void
  perms:    PermissoesForm
  setPerms: (p: PermissoesForm) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--ts)', display: 'block', marginBottom: 6 }}>Perfil</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: perfil === 'PERSONALIZADO' ? 10 : 0 }}>
        {(['ADMIN', 'PERSONALIZADO'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPerfil(p)}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              border: `.5px solid ${perfil === p ? 'var(--ba)' : 'var(--b)'}`,
              background: perfil === p ? 'var(--bga)' : 'var(--s1)',
              color: perfil === p ? 'var(--ta)' : 'var(--tp)',
              fontFamily: 'inherit',
            }}
          >
            {PERFIL_L[p]}
          </button>
        ))}
      </div>
      {perfil === 'PERSONALIZADO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--s1)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
          {PERM_ITENS.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={perms[item.key]}
                onChange={e => setPerms({ ...perms, [item.key]: e.target.checked })}
                style={{ marginTop: 2 }} />
              <span>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ts)' }}>{item.desc}</div>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Modal "Projetos" — visão inversa da tela de Acesso de cada projeto: aqui o
// ponto de partida é a pessoa, não o projeto (pra vincular tudo de uma vez).
function ProjetosUsuarioModal({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const { data, isLoading } = useUsuarioAcessos(usuario.id)
  const definir = useDefinirAcessoUsuario()
  const remover = useRemoverAcessoUsuario()
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({})
  const [novoNivel, setNovoNivel] = useState<ProjetoAcessoNivel>('VISUALIZAR')
  const [aplicando, setAplicando] = useState(false)
  const [busca, setBusca] = useState('')

  const projetos = data?.projetos ?? []
  const comAcesso = projetos.filter(p => p.nivel != null)
  const semAcesso = projetos.filter(p => p.nivel == null)
  const buscaNorm = busca.trim().toLowerCase()
  const semAcessoFiltrado = buscaNorm
    ? semAcesso.filter(p => p.nome.toLowerCase().includes(buscaNorm) || p.grupo?.toLowerCase().includes(buscaNorm))
    : semAcesso
  const idsSelecionados = Object.keys(selecionados).filter(id => selecionados[id])

  function nomeComGrupo(p: { nome: string; grupo?: string | null }) {
    return p.grupo ? `${p.grupo} — ${p.nome}` : p.nome
  }

  function toggleSelecionado(id: string) {
    setSelecionados(s => ({ ...s, [id]: !s[id] }))
  }

  async function handleAdicionar() {
    if (idsSelecionados.length === 0) { toast.error('Selecione ao menos um projeto.'); return }
    setAplicando(true)
    try {
      await Promise.all(idsSelecionados.map(projetoId =>
        definir.mutateAsync({ usuarioId: usuario.id, projetoId, nivel: novoNivel })
      ))
      toast.success(idsSelecionados.length === 1 ? 'Acesso concedido!' : `Acesso concedido a ${idsSelecionados.length} projetos!`)
      setSelecionados({}); setNovoNivel('VISUALIZAR')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao conceder acesso.')
    } finally {
      setAplicando(false)
    }
  }

  async function handleAlterarNivel(projetoId: string, nivel: ProjetoAcessoNivel) {
    try {
      await definir.mutateAsync({ usuarioId: usuario.id, projetoId, nivel })
      toast.success('Nível atualizado!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao atualizar nível.')
    }
  }

  async function handleRemover(projetoId: string, nome: string) {
    if (!window.confirm(`Remover o acesso de "${usuario.nome}" ao projeto "${nome}"?`)) return
    try {
      await remover.mutateAsync({ usuarioId: usuario.id, projetoId })
      toast.success('Acesso removido.')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao remover acesso.')
    }
  }

  const algumAbertoATodoTime = idsSelecionados.some(id => semAcesso.find(p => p.id === id)?.restrito === false)

  return (
    <Modal open onClose={onClose} titulo={`Projetos de ${usuario.nome}`} icon="ti-folder" width={480}
      rodape={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      {isLoading ? <Skeleton h={160} /> : (
        <>
          <div style={{ background: 'var(--bga)', border: '.5px solid var(--ba)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 12, fontSize: 10.5, color: 'var(--ta)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <i className="ti ti-info-circle" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }} />
            <span>
              Por padrão, sem nenhum acesso configurado aqui, este usuário vê todos os projetos sem restrição.
              Ao conceder acesso a um projeto, ele passa a ficar restrito — só quem estiver na lista de acesso dele consegue vê-lo.
            </span>
          </div>

          {comAcesso.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--tm)', fontSize: 11 }}>
              Nenhum acesso específico configurado ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {comAcesso.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '.5px solid var(--b)', borderRadius: 'var(--r)', background: 'var(--s1)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }} title={nomeComGrupo(p)}>
                    {p.grupo && <span style={{ color: 'var(--ts)', fontWeight: 400 }}>{p.grupo} — </span>}
                    {p.nome}
                  </div>
                  <Select value={p.nivel ?? 'VISUALIZAR'} style={{ width: 170 }}
                    onChange={e => handleAlterarNivel(p.id, e.target.value as ProjetoAcessoNivel)}>
                    {(Object.keys(NIVEL_L) as ProjetoAcessoNivel[]).map(n => (
                      <option key={n} value={n}>{NIVEL_L[n]}</option>
                    ))}
                  </Select>
                  <button onClick={() => handleRemover(p.id, p.nome)}
                    title="Remover acesso"
                    style={{ background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.5)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--td)', fontSize: 11, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ paddingTop: 12, borderTop: '.5px solid var(--b)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="fl" style={{ margin: 0 }}>Conceder acesso a</label>
              {semAcessoFiltrado.length > 0 && (
                <button type="button" className="linklike"
                  style={{ fontSize: 10.5, color: 'var(--ta)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => {
                    const todosMarcados = semAcessoFiltrado.every(p => selecionados[p.id])
                    setSelecionados(s => {
                      const novo = { ...s }
                      semAcessoFiltrado.forEach(p => { novo[p.id] = !todosMarcados })
                      return novo
                    })
                  }}
                >
                  {semAcessoFiltrado.every(p => selecionados[p.id]) ? 'Limpar seleção' : 'Selecionar todos'}
                </button>
              )}
            </div>

            {semAcesso.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 14, color: 'var(--tm)', fontSize: 11 }}>
                Todos os projetos já têm acesso configurado para este usuário.
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--tm)' }} />
                  <Input value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar projeto pelo nome..." style={{ paddingLeft: 30 }} />
                </div>

                <div style={{ maxHeight: 160, overflowY: 'auto', border: '.5px solid var(--b)', borderRadius: 'var(--r)', background: 'var(--s1)' }}>
                  {semAcessoFiltrado.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 14, color: 'var(--tm)', fontSize: 11 }}>
                      Nenhum projeto encontrado para &quot;{busca}&quot;.
                    </div>
                  ) : semAcessoFiltrado.map(p => (
                    <label key={p.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '.5px solid var(--b)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selecionados[p.id]} onChange={() => toggleSelecionado(p.id)} />
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={nomeComGrupo(p)}>
                        {p.grupo && <span style={{ color: 'var(--ts)' }}>{p.grupo} — </span>}
                        {p.nome}
                      </span>
                      {p.restrito && <span style={{ fontSize: 9, color: 'var(--tm)', flexShrink: 0 }}>já restrito</span>}
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
                  <div style={{ width: 170 }}>
                    <label className="fl">Nível</label>
                    <Select value={novoNivel} onChange={e => setNovoNivel(e.target.value as ProjetoAcessoNivel)}>
                      {(Object.keys(NIVEL_L) as ProjetoAcessoNivel[]).map(n => (
                        <option key={n} value={n}>{NIVEL_L[n]}</option>
                      ))}
                    </Select>
                  </div>
                  <Btn variant="primary" onClick={handleAdicionar} disabled={aplicando || idsSelecionados.length === 0} style={{ flex: 1 }}>
                    <i className="ti ti-plus" /> {idsSelecionados.length > 1 ? `Adicionar (${idsSelecionados.length})` : 'Adicionar'}
                  </Btn>
                </div>
                {algumAbertoATodoTime && (
                  <div style={{ fontSize: 10, color: 'var(--tw)', marginTop: 6 }}>
                    <i className="ti ti-alert-triangle" /> Algum projeto selecionado está aberto a todo o time hoje — ao conceder acesso aqui, ele passa a ficar restrito só a quem estiver na lista.
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

// Modal "Notificações" — o admin ajusta as preferências de e-mail de outra
// pessoa (mesmos toggles de /notificacoes, só que vistos/editados por fora).
function NotificacoesUsuarioModal({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const { data, isLoading } = useNotificacoesUsuario(usuario.id)
  const atualizar = useAtualizarNotificacoesUsuario(usuario.id)

  async function toggle(campo: string, valorAtual: boolean) {
    try {
      await atualizar.mutateAsync({ [campo]: !valorAtual })
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar preferência.')
    }
  }

  async function mudarModo(modo: 'IMEDIATO' | 'DIGEST_DIARIO') {
    try {
      await atualizar.mutateAsync({ modoNotificacao: modo })
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar preferência.')
    }
  }

  return (
    <Modal open onClose={onClose} titulo={`Notificações de ${usuario.nome}`} icon="ti-bell" width={440}
      rodape={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      {isLoading || !data ? <Skeleton h={220} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ border: '.5px solid var(--b)', borderRadius: 'var(--r)', padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 8 }}>Como recebe</div>
            <div className="ta-row" style={{ marginBottom: 0 }}>
              <button className={`ta-tab ${data.modoNotificacao === 'IMEDIATO' ? 'on' : ''}`} onClick={() => mudarModo('IMEDIATO')}>
                <i className="ti ti-bolt" /> Por notificação
              </button>
              <button className={`ta-tab ${data.modoNotificacao === 'DIGEST_DIARIO' ? 'on' : ''}`} onClick={() => mudarModo('DIGEST_DIARIO')}>
                <i className="ti ti-calendar-event" /> Resumo diário
              </button>
            </div>
          </div>
          {GRUPOS_NOTIFICACAO.map(g => (
            <div key={g.id} style={{ border: '.5px solid var(--b)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: 'var(--s1)', fontSize: 11, fontWeight: 500, borderBottom: '.5px solid var(--b)' }}>
                {g.titulo}
              </div>
              {g.eventos.map((ev, idx) => {
                const ativo = !!data[ev.campo]
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: idx < g.eventos.length - 1 ? '.5px solid var(--b)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{ev.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ts)' }}>{ev.desc}</div>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={ativo} onChange={() => toggle(ev.campo, ativo)} />
                      <div className="ttrack" />
                      <div className="tthumb" />
                    </label>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function UsuariosPage() {
  const { data, isLoading } = useUsuarios()
  const convidar = useConvidarUsuario()
  const atualizar = useAtualizarUsuario()
  const cancelarConvite = useCancelarConvite()
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)
  const { session } = useAppAuth()
  const [aba, setAba]           = useState<'usuarios' | 'convites'>('usuarios')
  const [modalConv, setModalConv] = useState(false)
  const [convModo, setConvModo]   = useState<'convite' | 'cadastro'>('convite')
  const [convNome, setConvNome]   = useState('')
  const [convEmail, setConvEmail] = useState('')
  const [convFuncao, setConvFuncao] = useState('')
  const [convSenha, setConvSenha] = useState('')
  const [mostrarSenhaConv, setMostrarSenhaConv] = useState(false)
  const [convPerfil, setConvPerfil] = useState<UsuarioPerfil>('PERSONALIZADO')
  const [convPerms, setConvPerms]   = useState<PermissoesForm>(PERM_VAZIO)

  const [modalEdit, setModalEdit] = useState<Usuario | null>(null)
  const [modalProjetos, setModalProjetos] = useState<Usuario | null>(null)
  const [modalNotif, setModalNotif] = useState<Usuario | null>(null)
  const [editNome, setEditNome]   = useState('')
  const [editFuncao, setEditFuncao] = useState('')
  const [editPerfil, setEditPerfil] = useState<UsuarioPerfil>('PERSONALIZADO')
  const [editPerms, setEditPerms]   = useState<PermissoesForm>(PERM_VAZIO)

  const usuarios = data?.usuarios ?? []
  const convites = data?.convites  ?? []
  const uso      = data?.uso       ?? { atual: 0, limite: 999 }

  function limparFormConvite() {
    setModalConv(false); setConvModo('convite')
    setConvNome(''); setConvEmail(''); setConvFuncao(''); setConvSenha(''); setMostrarSenhaConv(false)
    setConvPerfil('PERSONALIZADO'); setConvPerms(PERM_VAZIO)
  }

  async function handleConvidar(e: React.FormEvent) {
    e.preventDefault()
    if (convModo === 'cadastro') {
      if (!convNome.trim()) { toast.error('Informe o nome.'); return }
      if (convSenha.length < 8) { toast.error('A senha deve ter pelo menos 8 caracteres.'); return }
    }
    try {
      await convidar.mutateAsync({
        email: convEmail, perfil: convPerfil, funcao: convFuncao.trim() || undefined,
        ...(convModo === 'cadastro' ? { nome: convNome, senha: convSenha } : {}),
        ...(convPerfil === 'PERSONALIZADO' ? convPerms : {}),
      })
      toast.success(convModo === 'cadastro'
        ? `"${convNome}" cadastrado! Já pode logar com a senha definida.`
        : `Convite enviado para ${convEmail}!`)
      limparFormConvite()
    } catch (err: any) {
      toast.error(err?.message ?? (convModo === 'cadastro' ? 'Erro ao cadastrar usuário.' : 'Erro ao enviar convite.'))
    }
  }

  const iniciais = (nome: string) => nome.split(' ').slice(0, 2).map(n => n[0]).join('')

  function abrirEdicao(u: Usuario) {
    setModalEdit(u)
    setEditNome(u.nome)
    setEditFuncao(u.funcao ?? '')
    setEditPerfil(u.perfil)
    setEditPerms(perfilDoUsuario(u))
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!modalEdit) return
    if (!editNome.trim()) { toast.error('Informe o nome.'); return }
    try {
      await atualizar.mutateAsync({
        id: modalEdit.id, nome: editNome, funcao: editFuncao.trim(), perfil: editPerfil,
        ...(editPerfil === 'PERSONALIZADO' ? editPerms : PERM_VAZIO),
      })
      toast.success(`"${editNome}" atualizado!`)
      setModalEdit(null)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao atualizar usuário.')
    }
  }

  async function reenviarConvite(c: { id: string; email: string; perfil: UsuarioPerfil }) {
    setReenviandoId(c.id)
    try {
      await convidar.mutateAsync({ email: c.email, perfil: c.perfil })
      toast.success(`Convite reenviado para ${c.email}!`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao reenviar convite.')
    } finally {
      setReenviandoId(null)
    }
  }

  async function cancelarConviteAcao(c: { id: string; email: string }) {
    try {
      await cancelarConvite.mutateAsync(c.id)
      toast.success(`Convite para ${c.email} cancelado.`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao cancelar convite.')
    }
  }

  async function alternarStatus(u: Usuario) {
    const novoStatus = u.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    try {
      await atualizar.mutateAsync({ id: u.id, status: novoStatus })
      toast.success(novoStatus === 'ATIVO' ? `"${u.nome}" reativado!` : `"${u.nome}" desativado.`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao alterar status.')
    }
  }

  function tituloPermissoes(u: any): string | undefined {
    if (u.perfil !== 'PERSONALIZADO') return undefined
    const ativas = PERM_ITENS.filter(i => u[i.key]).map(i => i.label)
    return ativas.length ? ativas.join(', ') : 'Nenhuma permissão marcada'
  }

  return (
    <div className="main">
      <Topbar
        titulo="Usuários e permissões"
        subtitulo={`Gerencie equipes, perfis e convites · ${uso.atual}/${uso.limite === 999 ? '∞' : uso.limite} usuários`}
        acoes={
          <button className="btn btn-p btn-sm" onClick={() => { setAba('convites'); setModalConv(true) }}>
            <i className="ti ti-user-plus" /> Convidar usuário
          </button>
        }
      />
      <div className="content">
        <div className="ta-row">
          {[
            { id: 'usuarios', icon: 'ti-users',        label: 'Usuários' },
            { id: 'convites', icon: 'ti-mail-forward', label: 'Cadastro de usuário' },
          ].map(t => (
            <button key={t.id} className={`ta-tab ${aba === t.id ? 'on' : ''}`} onClick={() => setAba(t.id as any)}>
              <i className={`ti ${t.icon}`} /> {t.label}
              {t.id === 'convites' && convites.length > 0 && (
                <span style={{ background: 'var(--fw)', color: 'var(--oa)', fontSize: 9, padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>
                  {convites.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ABA USUÁRIOS */}
        {aba === 'usuarios' && (
          <div className="tw">
            <table className="tbl">
              <thead><tr><th>Usuário</th><th>Perfil</th><th style={{ textAlign: 'center' }}>Projetos</th><th>Último acesso</th><th>Status</th><th style={{ width: 80 }}></th></tr></thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6}><Skeleton h={200} /></td></tr>
                : usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="av" style={{ width: 30, height: 30, fontSize: 11, background: 'var(--bga)', color: 'var(--ta)' }}>
                          {iniciais(u.nome)}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{u.nome}</div>
                          <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                            {u.email}{u.funcao ? ` · ${u.funcao}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td title={tituloPermissoes(u)}>
                      <Badge variant={PERFIL_V[u.perfil] as any}>{PERFIL_L[u.perfil] ?? u.perfil}</Badge>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--ts)' }}>
                      {u.perfil === 'ADMIN' || u.permGerenciarProjetos ? (
                        <span title="Administrador/Gerenciar projetos: enxerga todos os projetos, sem restrição.">Todos</span>
                      ) : u._count?.projetoAcessos ? (
                        <span title="Quantidade de projetos com acesso especificamente configurado para este usuário.">
                          {u._count.projetoAcessos} configurado{u._count.projetoAcessos !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span title="Nenhum acesso específico configurado — vê todos os projetos sem restrição.">Padrão</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ts)' }}>
                      {u.ultimoAcessoEm ? new Date(u.ultimoAcessoEm).toLocaleDateString('pt-BR') : 'Nunca'}
                    </td>
                    <td>
                      <Badge variant={u.status === 'ATIVO' ? 'ok' : u.status === 'CONVIDADO' ? 'warn' : 'gray'}>
                        {u.status === 'ATIVO' ? 'Ativo' : u.status === 'CONVIDADO' ? 'Convidado' : 'Inativo'}
                      </Badge>
                    </td>
                    <td>
                      <div className="proj-ac" style={{ justifyContent: 'flex-end' }}>
                        <button className="proj-ab" title="Editar" onClick={() => abrirEdicao(u)}><i className="ti ti-pencil" /> Editar</button>
                        <button className="proj-ab" title="Projetos" onClick={() => setModalProjetos(u)}><i className="ti ti-folder" /> Projetos</button>
                        <button className="proj-ab" title="Notificações" onClick={() => setModalNotif(u)}><i className="ti ti-bell" /> Notificações</button>
                        <button
                          className="proj-ab"
                          title={u.status === 'ATIVO' ? 'Desativar' : 'Reativar'}
                          disabled={u.id === session?.usuario.id}
                          style={u.id === session?.usuario.id ? { opacity: .4, cursor: 'not-allowed' } : undefined}
                          onClick={() => alternarStatus(u)}
                        >
                          <i className={`ti ${u.status === 'ATIVO' ? 'ti-user-off' : 'ti-user-check'}`} /> {u.status === 'ATIVO' ? 'Desativar' : 'Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA CONVITES */}
        {aba === 'convites' && (
          <>
            <div className="sec">
              <div className="sec-h"><span className="sec-title">Adicionar usuário</span></div>
              <div className="sec-body">
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {([
                    { id: 'convite',  icon: 'ti-mail',       label: 'Enviar convite por e-mail' },
                    { id: 'cadastro', icon: 'ti-user-plus',  label: 'Cadastrar agora com senha' },
                  ] as const).map(m => (
                    <button key={m.id} type="button" onClick={() => setConvModo(m.id)}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        border: `.5px solid ${convModo === m.id ? 'var(--ba)' : 'var(--b)'}`,
                        background: convModo === m.id ? 'var(--bga)' : 'var(--s1)',
                        color: convModo === m.id ? 'var(--ta)' : 'var(--tp)',
                        fontFamily: 'inherit',
                      }}
                    >
                      <i className={`ti ${m.icon}`} /> {m.label}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleConvidar}>
                  <div className={convModo === 'cadastro' ? 'g3' : 'g2'} style={{ marginBottom: 12 }}>
                    {convModo === 'cadastro' && (
                      <Field label="Nome *"><Input required value={convNome} onChange={e => setConvNome(e.target.value)} placeholder="Nome completo" /></Field>
                    )}
                    <Field label="E-mail *"><Input type="email" required value={convEmail} onChange={e => setConvEmail(e.target.value)} placeholder="email@empresa.com" /></Field>
                    <Field label="Função">
                      <Input value={convFuncao} onChange={e => setConvFuncao(e.target.value)} placeholder="Ex: Engenheiro Civil..." />
                    </Field>
                  </div>
                  {convModo === 'cadastro' && (
                    <div className="fr">
                      <label className="fl">Senha inicial *</label>
                      <div style={{ position: 'relative' }}>
                        <input className="fi" type={mostrarSenhaConv ? 'text' : 'password'} required minLength={8}
                          value={convSenha} onChange={e => setConvSenha(e.target.value)}
                          placeholder="Mínimo 8 caracteres" style={{ paddingRight: 34 }} />
                        <button type="button" onClick={() => setMostrarSenhaConv(v => !v)}
                          aria-label={mostrarSenhaConv ? 'Ocultar senha' : 'Mostrar senha'}
                          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ts)', padding: 0 }}>
                          <i className={`ti ${mostrarSenhaConv ? 'ti-eye-off' : 'ti-eye'}`} />
                        </button>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ts)', marginTop: 4 }}>
                        O usuário já nasce ativo e pode logar direto com essa senha — sem depender de e-mail de convite.
                      </div>
                    </div>
                  )}
                  <PerfilCampos perfil={convPerfil} setPerfil={setConvPerfil} perms={convPerms} setPerms={setConvPerms} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-p btn-sm" disabled={convidar.isPending}>
                      <i className={`ti ${convModo === 'cadastro' ? 'ti-user-plus' : 'ti-send'}`} />{' '}
                      {convidar.isPending
                        ? (convModo === 'cadastro' ? 'Cadastrando...' : 'Enviando...')
                        : (convModo === 'cadastro' ? 'Cadastrar usuário' : 'Enviar convite')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {convites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--tm)', fontSize: 11 }}>
                Nenhum convite pendente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {convites.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--s1)', borderRadius: 'var(--r)', border: '.5px solid var(--b)' }}>
                    <div className="av" style={{ width: 28, height: 28, fontSize: 10, background: 'var(--s2)', color: 'var(--tm)' }}>
                      {c.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{c.email}</div>
                      <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                        {PERFIL_L[c.perfil]} · Expira {new Date(c.expiradoEm).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <button className="btn btn-sm" disabled={reenviandoId === c.id} onClick={() => reenviarConvite(c)}>
                      <i className="ti ti-send" /> {reenviandoId === c.id ? 'Enviando...' : 'Reenviar'}
                    </button>
                    <button className="btn btn-sm" style={{ color: 'var(--td)', borderColor: 'rgba(224,92,92,.3)' }} onClick={() => cancelarConviteAcao(c)}>
                      <i className="ti ti-x" /> Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={!!modalEdit} onClose={() => setModalEdit(null)}
        titulo="Editar usuário" icon="ti-pencil" width={420}
        rodape={
          <>
            <button className="btn" onClick={() => setModalEdit(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarEdicao} disabled={atualizar.isPending}>
              <i className="ti ti-check" /> {atualizar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <form onSubmit={salvarEdicao}>
          <Field label="Nome"><Input value={editNome} onChange={e => setEditNome(e.target.value)} /></Field>
          <Field label="E-mail">
            <Input value={modalEdit?.email ?? ''} disabled style={{ opacity: .6, cursor: 'not-allowed' }} />
          </Field>
          <Field label="Função">
            <Input value={editFuncao} onChange={e => setEditFuncao(e.target.value)} placeholder="Ex: Engenheiro Civil, Mestre de obras..." />
          </Field>
          <PerfilCampos perfil={editPerfil} setPerfil={setEditPerfil} perms={editPerms} setPerms={setEditPerms} />
        </form>
      </Modal>

      {modalProjetos && (
        <ProjetosUsuarioModal usuario={modalProjetos} onClose={() => setModalProjetos(null)} />
      )}

      {modalNotif && (
        <NotificacoesUsuarioModal usuario={modalNotif} onClose={() => setModalNotif(null)} />
      )}
    </div>
  )
}
