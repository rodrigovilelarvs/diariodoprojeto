'use client'
// app/(app)/projetos/[id]/assinaturas/page.tsx
// Configuração das assinaturas exigidas para aprovação de RDOs do projeto

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useResumoProjeto, useProjetoAssinaturas, useAtualizarAssinaturasProjeto,
} from '@/hooks/useEmpresa'
import { Topbar } from '@/components/layout/Topbar'
import { Skeleton, Select, Btn } from '@/components/ui'
import { ProjetoTabs } from '@/components/projetos/ProjetoTabs'
import type { ProjetoAssinaturaModo } from '@/lib/types'
import { mensagemErro } from '@/lib/api'

export default function ProjetoAssinaturasPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: resumo, isLoading: carregandoResumo } = useResumoProjeto(id)
  const { data, isLoading } = useProjetoAssinaturas(id)
  const atualizar = useAtualizarAssinaturasProjeto()

  const [modo, setModo] = useState<ProjetoAssinaturaModo>('ABERTA')
  const [assinante1Id, setAssinante1Id] = useState('')
  const [assinante2Id, setAssinante2Id] = useState('')
  const [assinante3Id, setAssinante3Id] = useState('')

  useEffect(() => {
    if (!data) return
    setModo(data.assinaturaModo)
    setAssinante1Id(data.assinante1?.id ?? '')
    setAssinante2Id(data.assinante2?.id ?? '')
    setAssinante3Id(data.assinante3?.id ?? '')
  }, [data])

  async function handleSalvar() {
    const ids = [assinante1Id, assinante2Id, assinante3Id].filter(Boolean)
    if (new Set(ids).size !== ids.length) {
      toast.error('Cada assinante só pode ser escolhido uma vez.')
      return
    }
    try {
      await atualizar.mutateAsync({
        projetoId: id,
        assinaturaModo: modo,
        assinante1Id: assinante1Id || null,
        assinante2Id: assinante2Id || null,
        assinante3Id: assinante3Id || null,
      })
      toast.success('Configuração de assinaturas salva!')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar.'))
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
        <Topbar titulo={resumo.projeto.nome} subtitulo="Assinaturas" />
        <div className="content">
          <div className="sec"><div className="sec-body" style={{ textAlign: 'center', padding: 32, color: 'var(--tm)' }}>
            <i className="ti ti-lock" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            Você não tem permissão para gerenciar as assinaturas deste projeto.
          </div></div>
        </div>
      </div>
    )
  }

  const usuariosElegiveis = data?.usuariosElegiveis ?? []
  const slots = [
    { label: 'Assinante 1', valor: assinante1Id, set: setAssinante1Id },
    { label: 'Assinante 2', valor: assinante2Id, set: setAssinante2Id },
    { label: 'Assinante 3', valor: assinante3Id, set: setAssinante3Id },
  ]
  const escolhidos = [assinante1Id, assinante2Id, assinante3Id].filter(Boolean)

  return (
    <div className="main">
      <Topbar
        titulo={resumo.projeto.nome}
        subtitulo="Assinaturas exigidas"
        acoes={
          <button className="btn btn-sm" onClick={() => router.push(`/projetos/${id}`)}>
            <i className="ti ti-arrow-left" /> Voltar ao projeto
          </button>
        }
      />
      <div className="content">
        <ProjetoTabs projetoId={id} ativo="assinaturas" />

        <div className="sec">
          <div className="sec-h"><span className="sec-title">Quem precisa assinar os RDOs deste projeto</span></div>
          <div className="sec-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setModo('ABERTA')}
                style={{
                  flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--r)',
                  border: modo === 'ABERTA' ? '1.5px solid var(--ta)' : '.5px solid var(--b)',
                  background: modo === 'ABERTA' ? 'var(--bga)' : 'var(--s1)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: modo === 'ABERTA' ? 'var(--ta)' : 'var(--tp)', marginBottom: 4 }}>
                  <i className="ti ti-users-group" /> Aberta
                </div>
                <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                  Qualquer aprovador do time (Admin, Gestor ou Aprovador) pode assinar. Comportamento padrão.
                </div>
              </button>
              <button onClick={() => setModo('DEFINIDA')}
                style={{
                  flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--r)',
                  border: modo === 'DEFINIDA' ? '1.5px solid var(--ta)' : '.5px solid var(--b)',
                  background: modo === 'DEFINIDA' ? 'var(--bga)' : 'var(--s1)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: modo === 'DEFINIDA' ? 'var(--ta)' : 'var(--tp)', marginBottom: 4 }}>
                  <i className="ti ti-writing-sign" /> Pré-definida
                </div>
                <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                  Escolha até 3 pessoas específicas — só elas poderão assinar os RDOs deste projeto.
                </div>
              </button>
            </div>

            {modo === 'DEFINIDA' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                {slots.map((s, i) => (
                  <div key={i}>
                    <label className="fl">{s.label}{i === 0 ? '' : ' (opcional)'}</label>
                    <Select value={s.valor} onChange={e => s.set(e.target.value)}>
                      <option value="">— Nenhum —</option>
                      {usuariosElegiveis
                        .filter(u => u.id === s.valor || !escolhidos.includes(u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                        ))}
                    </Select>
                  </div>
                ))}
                {usuariosElegiveis.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>
                    Nenhum usuário com perfil de Admin, Gestor ou Aprovador cadastrado no time ainda.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '.5px solid var(--b)', display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="primary" onClick={handleSalvar} disabled={atualizar.isPending}>
                {atualizar.isPending ? 'Salvando...' : 'Salvar'}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
