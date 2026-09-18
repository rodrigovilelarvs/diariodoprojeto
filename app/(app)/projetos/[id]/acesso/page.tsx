'use client'
// app/(app)/projetos/[id]/acesso/page.tsx
// Controle de acesso à pasta do projeto — quem pode ver/editar/gerenciar

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useResumoProjeto, useProjetoAcesso, useDefinirAcessoProjeto, useRemoverAcessoProjeto,
} from '@/hooks/useEmpresa'
import { Topbar } from '@/components/layout/Topbar'
import { Skeleton, Select, Btn, Badge } from '@/components/ui'
import { ProjetoTabs } from '@/components/projetos/ProjetoTabs'
import type { ProjetoAcessoNivel } from '@/lib/types'

const NIVEL_L: Record<ProjetoAcessoNivel, string> = {
  VISUALIZAR: 'Visualizar', EDITAR: 'Editar', GERENCIAMENTO: 'Gerenciamento total',
}
const NIVEL_DESC: Record<ProjetoAcessoNivel, string> = {
  VISUALIZAR:    'Só vê os dados e RDOs do projeto — não pode criar ou editar nada nele.',
  EDITAR:        'Pode criar e editar RDOs deste projeto.',
  GERENCIAMENTO: 'Além de editar, pode gerenciar o acesso e as assinaturas do projeto.',
}

export default function ProjetoAcessoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: resumo, isLoading: carregandoResumo } = useResumoProjeto(id)
  const { data, isLoading } = useProjetoAcesso(id)
  const definirAcesso = useDefinirAcessoProjeto()
  const removerAcesso = useRemoverAcessoProjeto()

  const [novoUsuarioId, setNovoUsuarioId] = useState('')
  const [novoNivel, setNovoNivel] = useState<ProjetoAcessoNivel>('VISUALIZAR')

  async function handleAdicionar() {
    if (!novoUsuarioId) { toast.error('Selecione um usuário.'); return }
    try {
      await definirAcesso.mutateAsync({ projetoId: id, usuarioId: novoUsuarioId, nivel: novoNivel })
      toast.success('Acesso definido!')
      setNovoUsuarioId('')
      setNovoNivel('VISUALIZAR')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao definir acesso.')
    }
  }

  async function handleAlterarNivel(usuarioId: string, nivel: ProjetoAcessoNivel) {
    try {
      await definirAcesso.mutateAsync({ projetoId: id, usuarioId, nivel })
      toast.success('Nível atualizado!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao atualizar nível.')
    }
  }

  async function handleRemover(usuarioId: string, nome: string) {
    if (!window.confirm(`Remover o acesso de "${nome}" a este projeto?`)) return
    try {
      await removerAcesso.mutateAsync({ projetoId: id, usuarioId })
      toast.success('Acesso removido.')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao remover acesso.')
    }
  }

  if (carregandoResumo || isLoading || !resumo) {
    return (
      <div className="main">
        <Topbar titulo="Carregando..." />
        <div className="content"><Skeleton h={300} /></div>
      </div>
    )
  }

  if (!resumo.projeto.podeGerenciar) {
    return (
      <div className="main">
        <Topbar titulo={resumo.projeto.nome} subtitulo="Acesso" />
        <div className="content">
          <div className="sec"><div className="sec-body" style={{ textAlign: 'center', padding: 32, color: 'var(--tm)' }}>
            <i className="ti ti-lock" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            Você não tem permissão para gerenciar o acesso deste projeto.
          </div></div>
        </div>
      </div>
    )
  }

  const acessos = data?.acessos ?? []
  const usuariosDisponiveis = (data?.usuarios ?? []).filter(u => !acessos.some(a => a.usuarioId === u.id))

  return (
    <div className="main">
      <Topbar
        titulo={resumo.projeto.nome}
        subtitulo="Acesso à pasta do projeto"
        acoes={
          <button className="btn btn-sm" onClick={() => router.push(`/projetos/${id}`)}>
            <i className="ti ti-arrow-left" /> Voltar ao projeto
          </button>
        }
      />
      <div className="content">
        <ProjetoTabs projetoId={id} ativo="acesso" />

        <div style={{ background: 'var(--bga)', border: '.5px solid var(--ba)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12, fontSize: 11, color: 'var(--ta)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <i className="ti ti-info-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
          <span>
            {acessos.length === 0
              ? 'Nenhum acesso configurado — este projeto está visível para todo o time, como padrão. Assim que você adicionar a primeira pessoa aqui, o projeto passa a ser restrito só a quem estiver nesta lista.'
              : 'Este projeto está restrito — só as pessoas listadas abaixo conseguem vê-lo ou acessá-lo.'}
          </span>
        </div>

        <div className="sec">
          <div className="sec-h">
            <span className="sec-title">Pessoas com acesso</span>
            {acessos.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--ts)', background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 20, padding: '2px 7px' }}>
                {acessos.length} pessoa{acessos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="sec-body">
            {acessos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--tm)', fontSize: 11 }}>
                Nenhuma restrição configurada ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {acessos.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '.5px solid var(--b)', borderRadius: 'var(--r)', background: 'var(--s1)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.usuario.nome}</div>
                      <div style={{ fontSize: 10, color: 'var(--tm)' }}>{a.usuario.email}</div>
                    </div>
                    <Select value={a.nivel} style={{ width: 190 }}
                      onChange={e => handleAlterarNivel(a.usuarioId, e.target.value as ProjetoAcessoNivel)}>
                      {(Object.keys(NIVEL_L) as ProjetoAcessoNivel[]).map(n => (
                        <option key={n} value={n}>{NIVEL_L[n]}</option>
                      ))}
                    </Select>
                    <button onClick={() => handleRemover(a.usuarioId, a.usuario.nome)}
                      title="Remover acesso"
                      style={{ background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.5)', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--td)', fontSize: 12, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: '.5px solid var(--b)' }}>
              <div style={{ flex: 1 }}>
                <label className="fl">Adicionar pessoa</label>
                <Select value={novoUsuarioId} onChange={e => setNovoUsuarioId(e.target.value)}>
                  <option value="">Selecione um usuário...</option>
                  {usuariosDisponiveis.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                  ))}
                </Select>
              </div>
              <div style={{ width: 190 }}>
                <label className="fl">Nível</label>
                <Select value={novoNivel} onChange={e => setNovoNivel(e.target.value as ProjetoAcessoNivel)}>
                  {(Object.keys(NIVEL_L) as ProjetoAcessoNivel[]).map(n => (
                    <option key={n} value={n}>{NIVEL_L[n]}</option>
                  ))}
                </Select>
              </div>
              <Btn variant="primary" onClick={handleAdicionar} disabled={definirAcesso.isPending}>
                <i className="ti ti-plus" /> Adicionar
              </Btn>
            </div>
            <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 6 }}>{NIVEL_DESC[novoNivel]}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
